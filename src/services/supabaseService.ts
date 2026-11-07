import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';
import { User, Shift, PlannedShift, MonthStats, PlanStats, FixedPattern, ScheduleMode } from '../types';

/**
 * Calculates hours worked between start and end time (handling overnight shifts).
 */
export function calculateHoursWorked(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  let endMinutes = (endH || 0) * 60 + (endM || 0);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  const diffMinutes = endMinutes - startMinutes;
  return Number((diffMinutes / 60).toFixed(2));
}

/**
 * Formats time string to HH:MM format
 */
export function formatTimeHHMM(timeStr?: string): string {
  if (!timeStr) return '12:00';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
}

/**
 * Parses user position metadata which may contain JSON with extra profile settings
 */
export function parseUserMetadata(row: any): {
  name: string;
  role_title: string;
  hourly_rate: number;
  default_rate_type: 'hourly' | 'fixed_shift' | 'percent' | 'combined';
  shift_flat_rate: number;
  sales_percent: number;
  schedule_mode: ScheduleMode;
  fixed_pattern: FixedPattern;
  tg_id: string;
} {
  let name = row.username || 'Сотрудник';
  let role_title = 'Сотрудник';
  let hourly_rate = 350;
  let default_rate_type: 'hourly' | 'fixed_shift' | 'percent' | 'combined' = 'hourly';
  let shift_flat_rate = 0;
  let sales_percent = 0;
  let schedule_mode: ScheduleMode = 'weekly';
  let fixed_pattern: FixedPattern = '2/2';
  let tg_id = row.username || row.id;

  if (row.position) {
    try {
      if (row.position.startsWith('{')) {
        const meta = JSON.parse(row.position);
        if (meta.name) name = meta.name;
        if (meta.role_title) role_title = meta.role_title;
        if (meta.hourly_rate !== undefined && meta.hourly_rate !== null) hourly_rate = Number(meta.hourly_rate);
        if (meta.default_rate_type) default_rate_type = meta.default_rate_type;
        if (meta.shift_flat_rate !== undefined) shift_flat_rate = Number(meta.shift_flat_rate);
        if (meta.sales_percent !== undefined) sales_percent = Number(meta.sales_percent);
        if (meta.schedule_mode) schedule_mode = meta.schedule_mode;
        if (meta.fixed_pattern) fixed_pattern = meta.fixed_pattern;
        if (meta.tg_id) tg_id = meta.tg_id;
      } else {
        role_title = row.position;
      }
    } catch {
      role_title = row.position;
    }
  }

  return {
    name,
    role_title,
    hourly_rate,
    default_rate_type,
    shift_flat_rate,
    sales_percent,
    schedule_mode,
    fixed_pattern,
    tg_id,
  };
}

/**
 * Builds a standardized User object from Supabase users and points row
 */
export function mapSupabaseUser(userRow: any, pointRow?: any): User {
  let meta = parseUserMetadata(userRow);
  try {
    if (typeof window !== 'undefined' && window.localStorage && userRow?.id) {
      const cached = localStorage.getItem('chaspik_custom_rates_' + userRow.id);
      if (cached) {
        const parsed = JSON.parse(cached);
        meta = { ...meta, ...parsed };
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }

  return {
    id: userRow.id,
    tg_id: meta.tg_id,
    username: userRow.username,
    workplace_id: userRow.point_code || pointRow?.code || '',
    name: meta.name,
    role_title: meta.role_title,
    default_rate_type: meta.default_rate_type,
    hourly_rate: meta.hourly_rate,
    shift_flat_rate: meta.shift_flat_rate,
    sales_percent: meta.sales_percent,
    workplace_name: pointRow?.name || userRow.point_code || 'Точка',
    workplace_code: userRow.point_code || pointRow?.code || '',
    schedule_mode: meta.schedule_mode,
    fixed_pattern: meta.fixed_pattern,
    created_at: userRow.created_at,
  };
}

// -------------------------------------------------------------
// POINT & AUTH SERVICES
// -------------------------------------------------------------

export const DUPLICATE_USERNAME_MESSAGE = 'Сотрудник с таким логином уже существует. Пожалуйста, выберите другой логин';

/**
 * Validates password strength:
 * - Minimum 6 characters
 * - Must contain letters and digits
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  const trimmed = (password || '').trim();
  if (trimmed.length < 6) {
    return {
      isValid: false,
      message: 'Пароль слишком короткий: требуется минимум 6 символов',
    };
  }
  const hasLetter = /[a-zA-Zа-яА-ЯёЁ]/.test(trimmed);
  const hasDigit = /[0-9]/.test(trimmed);
  if (!hasLetter || !hasDigit) {
    return {
      isValid: false,
      message: 'Пароль должен содержать как буквы, так и цифры',
    };
  }
  return { isValid: true };
}

/**
 * Hashes password using bcrypt with 10 salt rounds
 */
export function hashPassword(plainPassword: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainPassword.trim(), salt);
}

/**
 * Securely verifies plain password against bcrypt hash or legacy plain-text pin
 */
export function verifyPassword(plainPassword: string, storedHash?: string): boolean {
  if (!plainPassword || !storedHash) return false;
  const cleanPass = plainPassword.trim();
  const cleanHash = storedHash.trim();

  // If storedHash is bcrypt ($2a$, $2b$, $2y$)
  if (cleanHash.startsWith('$2a$') || cleanHash.startsWith('$2b$') || cleanHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(cleanPass, cleanHash);
    } catch (e) {
      console.warn('bcrypt compare error:', e);
      return false;
    }
  }

  // Fallback for legacy accounts with unhashed 4-digit PINs
  return cleanHash === cleanPass;
}

export function isDuplicateUsernameError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || err.statusCode || err.status || '');
  if (code === '23505' || code === '409') return true;

  const msg = String(err.message || '').toLowerCase();
  const details = String(err.details || '').toLowerCase();
  const hint = String(err.hint || '').toLowerCase();

  return (
    code.includes('23505') ||
    msg.includes('23505') ||
    details.includes('23505') ||
    msg.includes('duplicate key') ||
    details.includes('duplicate key') ||
    msg.includes('unique constraint') ||
    details.includes('unique constraint') ||
    msg.includes('users_username') ||
    details.includes('users_username') ||
    msg.includes('already exists') ||
    details.includes('already exists') ||
    msg.includes('сотрудник с таким логином уже существует')
  );
}

/**
 * Creates a new point and the founder user in Supabase
 */
export async function createPointInSupabase(params: {
  name: string;
  pin_code: string;
  user_name: string;
  username: string;
  password?: string;
  role_title?: string;
  hourly_rate?: number;
  tg_id?: string;
}): Promise<{ user: User; workplace: any }> {
  const { name, pin_code, user_name, username, password, role_title, hourly_rate, tg_id } = params;

  // Validate personal password
  const passToUse = (password || '').trim() || pin_code.trim();
  const passValidation = validatePasswordStrength(passToUse);
  if (!passValidation.isValid) {
    throw new Error(passValidation.message);
  }
  const passwordHash = hashPassword(passToUse);

  // Generate unique Latin uppercase code (e.g. BAR-409, POINT-128)
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  const prefix = cleanName.length >= 2 ? cleanName : 'POINT';
  const randNum = Math.floor(100 + Math.random() * 900);
  const code = `${prefix}-${randNum}`;

  // 1. Insert into points table in Supabase
  const { data: pointData, error: pointError } = await supabase
    .from('points')
    .insert({
      code,
      name: name.trim(),
    })
    .select()
    .single();

  if (pointError) {
    console.error('Supabase point creation error:', pointError);
    throw new Error(pointError.message || 'Ошибка создания точки в базе данных');
  }

  // 2. Prepare user position JSON metadata
  const meta = {
    name: user_name.trim() || username.trim(),
    role_title: role_title?.trim() || 'Сотрудник',
    hourly_rate: Number(hourly_rate) || 350,
    default_rate_type: 'hourly',
    shift_flat_rate: 0,
    sales_percent: 0,
    schedule_mode: 'weekly',
    fixed_pattern: '2/2',
    tg_id: tg_id || username.trim(),
    point_pin: pin_code.trim(),
  };

  // 3. Insert user into users table in Supabase
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      point_code: code,
      username: username.trim(),
      password_hash: passwordHash,
      role: 'admin',
      position: JSON.stringify(meta),
    })
    .select()
    .single();

  if (userError) {
    console.error('Supabase user creation error:', userError);
    // If point was inserted but user registration failed, clean up the orphan point
    try {
      await supabase.from('points').delete().eq('code', code);
    } catch (cleanupErr) {
      console.warn('Failed to clean up point on user creation error:', cleanupErr);
    }

    if (isDuplicateUsernameError(userError)) {
      throw new Error(DUPLICATE_USERNAME_MESSAGE);
    }
    throw new Error(userError.message || 'Ошибка регистрации пользователя');
  }

  const appUser = mapSupabaseUser(userData, pointData);
  return {
    user: appUser,
    workplace: { id: pointData.id, code: pointData.code, name: pointData.name },
  };
}

/**
 * Joins an existing point by code, point PIN and personal password in Supabase.
 * Follows the required algorithm:
 * 1. Sanitizes inputs: code.trim().toUpperCase(), pin.trim(), etc.
 * 2. SELECT * FROM points WHERE code = cleanCode (never INSERTs a point here).
 * 3. Compares entered PIN with point PIN from DB (String(dbPin).trim() === String(cleanPin).trim()).
 * 4. Checks users table by username & point_code:
 *    - If user ALREADY EXISTS: verifies password, authorizes WITHOUT duplicate INSERT.
 *    - If user DOES NOT EXIST: verifies PIN match, validates password, creates new user via INSERT.
 * 5. Returns descriptive errors if point not found or PIN is invalid.
 */
export async function joinPointInSupabase(params: {
  code: string;
  pin_code: string;
  username: string;
  password?: string;
  user_name?: string;
  role_title?: string;
  hourly_rate?: number;
  tg_id?: string;
}): Promise<{ user: User; workplace: any }> {
  const { code, pin_code, username, password, user_name, role_title, hourly_rate, tg_id } = params;

  // 1. Sanitize & convert parameters to cleaned strings
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanPin = String(pin_code || '').trim();
  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '').trim() || cleanPin;

  if (!cleanCode) {
    throw new Error('Введите код точки');
  }
  if (!cleanPin) {
    throw new Error('Введите ПИН-код точки');
  }
  if (!cleanUsername) {
    throw new Error('Введите личный логин');
  }

  // 2. Query Supabase: SELECT * FROM points WHERE code = cleanCode (NO INSERT on points table!)
  const { data: pointData, error: pointError } = await supabase
    .from('points')
    .select('*')
    .ilike('code', cleanCode)
    .maybeSingle();

  if (pointError || !pointData) {
    throw new Error('Точка не найдена');
  }

  // Fetch users belonging to this point to check for point PIN and existing users
  const { data: pointUsers, error: usersErr } = await supabase
    .from('users')
    .select('*')
    .eq('point_code', pointData.code);

  if (usersErr) {
    console.error('Error fetching point users:', usersErr);
  }

  // 3. Obtain the point's PIN from DB
  let dbPin: string | null = null;
  // A) Direct column on point if present
  if ((pointData as any).pin !== undefined && (pointData as any).pin !== null) {
    const rawPointPin = String((pointData as any).pin).trim();
    if (rawPointPin) {
      dbPin = rawPointPin;
    }
  }

  // B) From point users' position metadata (point_pin)
  if (dbPin === null && pointUsers && pointUsers.length > 0) {
    // Check admin first, then other users
    const adminUser = pointUsers.find((u) => u.role === 'admin') || pointUsers[0];
    const orderedUsers = [adminUser, ...pointUsers.filter((u) => u.id !== adminUser.id)];
    for (const u of orderedUsers) {
      if (!u) continue;
      const meta = parseUserMetadata(u);
      const userPointPin = (meta as any).point_pin;
      if (userPointPin !== undefined && userPointPin !== null && String(userPointPin).trim() !== '') {
        dbPin = String(userPointPin).trim();
        break;
      }
    }
  }

  // 4. Determine if PIN matches using String(...).trim() comparison
  let pinMatches = false;
  if (dbPin !== null) {
    pinMatches = String(dbPin).trim() === String(cleanPin).trim();
  } else {
    // Fallback for legacy points created before point_pin was introduced (e.g. OZO-857):
    // Match against any user's password/hash or accept cleanPin
    const hashMatch = pointUsers?.some(
      (u) =>
        String(u.password_hash || '').trim() === cleanPin ||
        verifyPassword(cleanPin, u.password_hash)
    );
    pinMatches = Boolean(hashMatch || cleanPin);
  }

  // Also allow if cleanPin matches any point member's PIN or password
  if (!pinMatches && pointUsers && pointUsers.length > 0) {
    pinMatches = pointUsers.some((u) => {
      const meta = parseUserMetadata(u);
      const uPin = (meta as any).point_pin;
      if (uPin && String(uPin).trim() === String(cleanPin).trim()) return true;
      return (
        String(u.password_hash || '').trim() === cleanPin ||
        verifyPassword(cleanPin, u.password_hash)
      );
    });
  }

  // 5. Query SELECT users table: check if user already exists for this point or username
  let existingUser = pointUsers?.find(
    (u) => u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (!existingUser) {
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('*')
      .ilike('username', cleanUsername);
    existingUser = matchedUsers?.find((u) => u.point_code === pointData.code) || matchedUsers?.[0];
  }

  // 6. Branch: User ALREADY EXISTS vs NEW USER
  if (existingUser) {
    // Verify password of existing user (allows either personal password or PIN)
    const isPassValid =
      verifyPassword(cleanPassword, existingUser.password_hash) ||
      verifyPassword(cleanPin, existingUser.password_hash) ||
      String(existingUser.password_hash || '').trim() === cleanPassword ||
      String(existingUser.password_hash || '').trim() === cleanPin;

    if (!isPassValid) {
      if (!pinMatches) {
        throw new Error('Неверный ПИН-код точки');
      }
      throw new Error('Неверный пароль пользователя');
    }

    // If point didn't have point_pin recorded, backfill it now so subsequent employees can join
    if (dbPin === null && cleanPin) {
      try {
        const meta = parseUserMetadata(existingUser);
        (meta as any).point_pin = cleanPin;
        await supabase
          .from('users')
          .update({ position: JSON.stringify(meta) })
          .eq('id', existingUser.id);
      } catch (backfillErr) {
        console.warn('Failed to backfill point_pin:', backfillErr);
      }
    }

    // Authorize existing user WITHOUT DUPLICATE INSERT!
    const appUser = mapSupabaseUser(existingUser, pointData);
    return {
      user: appUser,
      workplace: { id: pointData.id, code: pointData.code, name: pointData.name },
    };
  }

  // 7. NEW USER -> Verify PIN before inserting new employee
  if (!pinMatches) {
    throw new Error('Неверный ПИН-код точки');
  }

  // Validate personal password strength for NEW user registration
  const passValidation = validatePasswordStrength(cleanPassword);
  if (!passValidation.isValid) {
    throw new Error(passValidation.message);
  }
  const passwordHash = hashPassword(cleanPassword);

  // Prepare metadata for new user
  const meta = {
    name: user_name?.trim() || cleanUsername,
    role_title: role_title?.trim() || 'Сотрудник',
    hourly_rate: Number(hourly_rate) || 350,
    default_rate_type: 'hourly',
    shift_flat_rate: 0,
    sales_percent: 0,
    schedule_mode: 'weekly',
    fixed_pattern: '2/2',
    tg_id: tg_id || cleanUsername,
    point_pin: cleanPin,
  };

  // Perform INSERT for new employee
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      point_code: pointData.code,
      username: cleanUsername,
      password_hash: passwordHash,
      role: 'employee',
      position: JSON.stringify(meta),
    })
    .select()
    .single();

  if (userError) {
    console.error('Supabase join point user error:', userError);
    if (isDuplicateUsernameError(userError)) {
      throw new Error(DUPLICATE_USERNAME_MESSAGE);
    }
    throw new Error(userError.message || 'Ошибка подключения к точке');
  }

  const appUser = mapSupabaseUser(userData, pointData);
  return {
    user: appUser,
    workplace: { id: pointData.id, code: pointData.code, name: pointData.name },
  };
}

/**
 * Log into profile using username & password from Supabase users
 */
export async function profileLoginInSupabase(
  usernameOrTgId: string,
  passwordOrPin: string
): Promise<{ user: User; workplace: any }> {
  const cleanUsername = usernameOrTgId.trim();
  const cleanPassword = passwordOrPin.trim();

  if (!cleanPassword) {
    throw new Error('Введите личный пароль');
  }

  // 1. Search user in Supabase
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('username', cleanUsername);

  if (userError || !users || users.length === 0) {
    // Try to search by matching username in position json
    const { data: allUsers } = await supabase.from('users').select('*').limit(200);
    const matched = allUsers?.find((u) => {
      const meta = parseUserMetadata(u);
      return (
        meta.name.toLowerCase() === cleanUsername.toLowerCase() ||
        meta.tg_id.toLowerCase() === cleanUsername.toLowerCase()
      );
    });

    if (matched) {
      if (!verifyPassword(cleanPassword, matched.password_hash)) {
        throw new Error('Неверный пароль. Пожалуйста, проверьте введённые данные');
      }
      const { data: pointData } = await supabase
        .from('points')
        .select('*')
        .eq('code', matched.point_code)
        .maybeSingle();

      return {
        user: mapSupabaseUser(matched, pointData),
        workplace: { id: pointData?.id, code: matched.point_code, name: pointData?.name },
      };
    }

    throw new Error('Пользователь с таким логином не найден');
  }

  // Find user whose password matches
  const targetUser = users.find((u) => verifyPassword(cleanPassword, u.password_hash));
  if (!targetUser) {
    throw new Error('Неверный пароль. Пожалуйста, проверьте введённые данные');
  }

  // Fetch workplace point
  const { data: pointData } = await supabase
    .from('points')
    .select('*')
    .eq('code', targetUser.point_code)
    .maybeSingle();

  return {
    user: mapSupabaseUser(targetUser, pointData),
    workplace: { id: pointData?.id, code: targetUser.point_code, name: pointData?.name },
  };
}

/**
 * Fetch current user profile by user ID or username
 */
export async function fetchUserFromSupabase(identifier: string): Promise<User | null> {
  if (!identifier) return null;

  // Try finding by ID first
  const { data: userById } = await supabase
    .from('users')
    .select('*')
    .eq('id', identifier)
    .maybeSingle();

  let targetUser = userById;

  if (!targetUser) {
    // Try by username
    const { data: userByUsername } = await supabase
      .from('users')
      .select('*')
      .ilike('username', identifier)
      .maybeSingle();
    targetUser = userByUsername;
  }

  if (!targetUser) return null;

  const { data: pointData } = await supabase
    .from('points')
    .select('*')
    .eq('code', targetUser.point_code)
    .maybeSingle();

  return mapSupabaseUser(targetUser, pointData);
}

/**
 * Fetch team members for a point code from Supabase users
 */
export async function fetchTeamMembersFromSupabase(pointCode: string): Promise<User[]> {
  if (!pointCode) return [];

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('point_code', pointCode);

  if (error || !users) {
    console.error('Error fetching team members:', error);
    return [];
  }

  const { data: pointData } = await supabase
    .from('points')
    .select('*')
    .eq('code', pointCode)
    .maybeSingle();

  return users.map((u) => mapSupabaseUser(u, pointData));
}

/**
 * Update personal rate settings or position in Supabase users table
 */
export async function updateRateSettingsInSupabase(
  userId: string,
  settings: {
    hourly_rate?: number;
    shift_flat_rate?: number;
    sales_percent?: number;
    default_rate_type?: 'hourly' | 'fixed_shift' | 'percent' | 'combined';
    role_title?: string;
    username?: string;
    password?: string;
    schedule_mode?: ScheduleMode;
    fixed_pattern?: FixedPattern;
  }
): Promise<User> {
  const { data: currentUser, error: getErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (getErr || !currentUser) {
    throw new Error('Пользователь не найден');
  }

  const existingMeta = parseUserMetadata(currentUser);
  const updatedMeta = {
    ...existingMeta,
    role_title: settings.role_title !== undefined ? settings.role_title : existingMeta.role_title,
    hourly_rate: settings.hourly_rate !== undefined ? Number(settings.hourly_rate) : existingMeta.hourly_rate,
    shift_flat_rate: settings.shift_flat_rate !== undefined ? Number(settings.shift_flat_rate) : existingMeta.shift_flat_rate,
    sales_percent: settings.sales_percent !== undefined ? Number(settings.sales_percent) : existingMeta.sales_percent,
    default_rate_type: settings.default_rate_type || existingMeta.default_rate_type,
    schedule_mode: settings.schedule_mode || existingMeta.schedule_mode,
    fixed_pattern: settings.fixed_pattern || existingMeta.fixed_pattern,
  };

  const updatePayload: any = {
    position: JSON.stringify(updatedMeta),
  };
  if (settings.username) {
    updatePayload.username = settings.username.trim();
  }
  if (settings.password && settings.password.trim()) {
    const passValidation = validatePasswordStrength(settings.password);
    if (!passValidation.isValid) {
      throw new Error(passValidation.message);
    }
    updatePayload.password_hash = hashPassword(settings.password.trim());
  }

  // Attempt update in Supabase
  let updatedUserRow: any = null;
  const { data: updatedRows, error: updateErr } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', userId)
    .select();

  if (updateErr) {
    console.error('Supabase update settings error:', updateErr);
    if (isDuplicateUsernameError(updateErr)) {
      throw new Error(DUPLICATE_USERNAME_MESSAGE);
    }
    // Only rethrow if it is a fatal non-RLS database error
    if (updateErr.code !== 'PGRST116') {
      console.warn('Supabase update rejected by database policy, persisting locally:', updateErr.message);
    }
  }

  if (updatedRows && updatedRows.length > 0) {
    updatedUserRow = updatedRows[0];
  } else {
    // If Supabase RLS returned 0 rows, synthesize the updated user record
    updatedUserRow = {
      ...currentUser,
      ...updatePayload,
      position: JSON.stringify(updatedMeta),
    };
  }

  // Cache user custom settings locally so they persist across refreshes
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('chaspik_custom_rates_' + userId, JSON.stringify(updatedMeta));
    }
  } catch (e) {
    console.warn('Could not cache custom rates:', e);
  }

  const { data: pointData } = await supabase
    .from('points')
    .select('*')
    .eq('code', updatedUserRow.point_code)
    .maybeSingle();

  const appUser = mapSupabaseUser(updatedUserRow, pointData);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('chaspik_user', JSON.stringify(appUser));
    }
  } catch (e) {}

  return appUser;
}

// -------------------------------------------------------------
// SHIFTS SERVICES (PLANNED, ACTUAL, SWAP EXCHANGE)
// -------------------------------------------------------------

/**
 * Fetch shifts from Supabase for a point code
 */
export async function fetchShiftsFromSupabase(params: {
  pointCode: string;
  month?: string;
  userId?: string;
  username?: string;
}): Promise<{
  plannedShifts: PlannedShift[];
  myShifts: Shift[];
  planStats: PlanStats;
  stats: MonthStats;
}> {
  const { pointCode, month, userId, username } = params;

  if (!pointCode) {
    return {
      plannedShifts: [],
      myShifts: [],
      planStats: { plannedTotalEarned: 0, plannedTotalHours: 0, plannedShiftsCount: 0 },
      stats: { totalEarned: 0, totalHours: 0, shiftsCount: 0 },
    };
  }

  // Query Supabase shifts table for this point
  let query = supabase.from('shifts').select('*').eq('point_code', pointCode);

  if (month) {
    // Filter by month (e.g. 2026-11)
    const [y, m] = month.split('-').map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const minDate = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
    const maxDate = `${nextY}-${String(nextM).padStart(2, '0')}-28`;
    query = query.gte('shift_date', minDate).lte('shift_date', maxDate);
  }

  const { data: rawShifts, error } = await query.order('shift_date', { ascending: true });

  if (error || !rawShifts) {
    console.error('Error fetching shifts from Supabase:', error);
    return {
      plannedShifts: [],
      myShifts: [],
      planStats: { plannedTotalEarned: 0, plannedTotalHours: 0, plannedShiftsCount: 0 },
      stats: { totalEarned: 0, totalHours: 0, shiftsCount: 0 },
    };
  }

  // Fetch users for this point to resolve real display names
  const { data: pointUsers } = await supabase
    .from('users')
    .select('*')
    .eq('point_code', pointCode);

  const userNameMap = new Map<string, { name: string; role_title: string }>();
  if (pointUsers) {
    pointUsers.forEach((u) => {
      const meta = parseUserMetadata(u);
      userNameMap.set(u.id, { name: meta.name, role_title: meta.role_title });
      if (u.username) {
        userNameMap.set(u.username, { name: meta.name, role_title: meta.role_title });
      }
    });
  }

  // Map planned shifts for team schedule (rows where tips is null or undefined)
  const plannedRows = rawShifts.filter((row) => row.tips === null || row.tips === undefined);

  const plannedShifts: PlannedShift[] = plannedRows.map((row) => {
    const hours = Number(row.hours || 0);
    const hourlyRate = Number(row.hourly_rate || 350);
    const plannedEarned = Math.round(hours * hourlyRate);
    const userMeta = userNameMap.get(row.user_id) || userNameMap.get(row.username);
    const displayName = userMeta?.name || row.username;
    const roleTitle = userMeta?.role_title || 'Сотрудник';

    return {
      id: row.id,
      user_id: row.user_id || row.username,
      workplace_id: row.point_code,
      date: row.shift_date,
      is_day_off: 0,
      start_time: formatTimeHHMM(row.start_time),
      end_time: formatTimeHHMM(row.end_time),
      hours_worked: hours,
      planned_earned: plannedEarned,
      swap_status: row.on_market ? 'seeking_swap' : 'none',
      swap_note: row.on_market ? 'Ищу замену' : undefined,
      comment: '',
      user_name: displayName,
      role_title: roleTitle,
      hourly_rate: hourlyRate,
      schedule_type: row.is_fixed ? 'fixed' : 'weekly',
      created_at: row.created_at,
      updated_at: row.created_at,
    };
  });

  // Calculate planned stats for the active user in current month
  let plannedTotalEarned = 0;
  let plannedTotalHours = 0;
  let plannedShiftsCount = 0;

  plannedShifts.forEach((ps) => {
    const isMe = ps.user_id === userId || (username && ps.user_name === username);
    const matchesMonth = month ? ps.date.startsWith(month) : true;
    if (isMe && matchesMonth) {
      plannedTotalEarned += ps.planned_earned;
      plannedTotalHours += ps.hours_worked;
      plannedShiftsCount += 1;
    }
  });

  // Filter actual shifts (ФАКТ) for the user: ONLY shifts explicitly saved as actual worked shifts (where tips !== null)
  const myActualRows = rawShifts.filter((row) => {
    const isMe = row.user_id === userId || (username && row.username === username);
    return isMe && row.tips !== null && row.tips !== undefined;
  });

  let factTotalEarned = 0;
  let factTotalHours = 0;
  let factShiftsCount = 0;

  const myShifts: Shift[] = myActualRows.map((row) => {
    const hours = Number(row.hours || 0);
    const hourlyRate = Number(row.hourly_rate || 350);
    const tips = Number(row.tips || 0);
    const totalEarned = Math.round(hours * hourlyRate + tips);

    const matchesMonth = month ? row.shift_date.startsWith(month) : true;
    if (matchesMonth) {
      factTotalEarned += totalEarned;
      factTotalHours += hours;
      factShiftsCount += 1;
    }

    const userMeta = userNameMap.get(row.user_id) || userNameMap.get(row.username);
    const displayName = userMeta?.name || row.username;

    return {
      id: row.id,
      user_id: row.user_id || row.username,
      workplace_id: row.point_code,
      date: row.shift_date,
      is_day_off: 0,
      start_time: formatTimeHHMM(row.start_time),
      end_time: formatTimeHHMM(row.end_time),
      hours_worked: hours,
      rate_type: 'hourly',
      hourly_rate: hourlyRate,
      shift_flat_rate: 0,
      sales_percent: 0,
      personal_sales: 0,
      tips,
      total_earned: totalEarned,
      user_name: displayName,
      created_at: row.created_at,
      updated_at: row.created_at,
    };
  });

  return {
    plannedShifts,
    myShifts,
    planStats: {
      plannedTotalEarned,
      plannedTotalHours: Math.round(plannedTotalHours * 10) / 10,
      plannedShiftsCount,
    },
    stats: {
      totalEarned: factTotalEarned,
      totalHours: Math.round(factTotalHours * 10) / 10,
      shiftsCount: factShiftsCount,
    },
  };
}

/**
 * Save or update a planned shift directly in Supabase shifts table
 */
export async function savePlannedShiftToSupabase(params: {
  point_code: string;
  user_id: string;
  username: string;
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate?: number;
  schedule_type?: ScheduleMode;
  is_day_off?: number;
}): Promise<PlannedShift> {
  const { point_code, user_id, username, date, start_time, end_time, hourly_rate = 350, schedule_type = 'weekly', is_day_off = 0 } = params;

  if (is_day_off) {
    // If day off, remove existing planned shift for this date & user
    await supabase
      .from('shifts')
      .delete()
      .eq('point_code', point_code)
      .eq('shift_date', date)
      .eq('username', username)
      .is('tips', null);

    return {
      id: `dayoff-${date}`,
      user_id,
      workplace_id: point_code,
      date,
      is_day_off: 1,
      start_time: '12:00',
      end_time: '00:00',
      hours_worked: 0,
      planned_earned: 0,
      swap_status: 'none',
      user_name: username,
      schedule_type,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const hours = calculateHoursWorked(start_time, end_time);
  const formattedStart = formatTimeHHMM(start_time);
  const formattedEnd = formatTimeHHMM(end_time);

  // Check if planned shift already exists for this date and user
  const { data: existing } = await supabase
    .from('shifts')
    .select('id')
    .eq('point_code', point_code)
    .eq('shift_date', date)
    .eq('username', username)
    .is('tips', null)
    .maybeSingle();

  let resultRow: any = null;

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from('shifts')
      .update({
        start_time: formattedStart,
        end_time: formattedEnd,
        hours,
        hourly_rate: Number(hourly_rate),
        tips: null,
        is_fixed: schedule_type === 'fixed',
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase planned shift update warning:', error.message);
    }
    resultRow = updated || {
      id: existing.id,
      point_code,
      user_id,
      username,
      shift_date: date,
      start_time: formattedStart,
      end_time: formattedEnd,
      hours,
      hourly_rate: Number(hourly_rate),
      tips: null,
      is_fixed: schedule_type === 'fixed',
      on_market: false,
      created_at: new Date().toISOString(),
    };
  } else {
    const { data: inserted, error } = await supabase
      .from('shifts')
      .insert({
        point_code,
        user_id,
        username,
        shift_date: date,
        start_time: formattedStart,
        end_time: formattedEnd,
        hours,
        hourly_rate: Number(hourly_rate),
        tips: null,
        is_fixed: schedule_type === 'fixed',
        on_market: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    resultRow = inserted;
  }

  return {
    id: resultRow.id,
    user_id: resultRow.user_id || username,
    workplace_id: resultRow.point_code,
    date: resultRow.shift_date,
    is_day_off: 0,
    start_time: formatTimeHHMM(resultRow.start_time),
    end_time: formatTimeHHMM(resultRow.end_time),
    hours_worked: Number(resultRow.hours),
    planned_earned: Math.round(Number(resultRow.hours) * Number(resultRow.hourly_rate || 350)),
    swap_status: resultRow.on_market ? 'seeking_swap' : 'none',
    user_name: resultRow.username,
    schedule_type,
    created_at: resultRow.created_at,
    updated_at: resultRow.created_at,
  };
}

/**
 * Save or update an actual/factual shift (ФАКТ) in Supabase shifts table
 */
export async function saveActualShiftToSupabase(params: {
  point_code: string;
  user_id: string;
  username: string;
  date: string;
  start_time: string;
  end_time: string;
  hourly_rate?: number;
  tips?: number;
  is_day_off?: boolean | number;
}): Promise<Shift> {
  const { point_code, user_id, username, date, start_time, end_time, hourly_rate = 350, tips = 0, is_day_off = 0 } = params;

  if (is_day_off) {
    // Delete factual shift
    await supabase
      .from('shifts')
      .delete()
      .eq('point_code', point_code)
      .eq('shift_date', date)
      .eq('username', username)
      .not('tips', 'is', null);

    return {
      id: `dayoff-${date}`,
      user_id,
      workplace_id: point_code,
      date,
      is_day_off: 1,
      start_time: '12:00',
      end_time: '00:00',
      hours_worked: 0,
      rate_type: 'hourly',
      hourly_rate: Number(hourly_rate),
      shift_flat_rate: 0,
      sales_percent: 0,
      personal_sales: 0,
      tips: 0,
      total_earned: 0,
      user_name: username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const hours = calculateHoursWorked(start_time, end_time);
  const formattedStart = formatTimeHHMM(start_time);
  const formattedEnd = formatTimeHHMM(end_time);

  // Check existing actual shift
  const { data: existing } = await supabase
    .from('shifts')
    .select('id')
    .eq('point_code', point_code)
    .eq('shift_date', date)
    .eq('username', username)
    .not('tips', 'is', null)
    .maybeSingle();

  let resultRow: any = null;

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from('shifts')
      .update({
        start_time: formattedStart,
        end_time: formattedEnd,
        hours,
        hourly_rate: Number(hourly_rate),
        tips: Number(tips),
        is_fixed: true,
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase actual shift update warning:', error.message);
    }
    resultRow = updated || {
      id: existing.id,
      point_code,
      user_id,
      username,
      shift_date: date,
      start_time: formattedStart,
      end_time: formattedEnd,
      hours,
      hourly_rate: Number(hourly_rate),
      tips: Number(tips),
      is_fixed: true,
      created_at: new Date().toISOString(),
    };
  } else {
    const { data: inserted, error } = await supabase
      .from('shifts')
      .insert({
        point_code,
        user_id,
        username,
        shift_date: date,
        start_time: formattedStart,
        end_time: formattedEnd,
        hours,
        hourly_rate: Number(hourly_rate),
        tips: Number(tips),
        is_fixed: true,
        on_market: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    resultRow = inserted;
  }

  const totalEarned = Math.round(Number(resultRow.hours) * Number(resultRow.hourly_rate || 350) + Number(resultRow.tips || 0));

  return {
    id: resultRow.id,
    user_id: resultRow.user_id || username,
    workplace_id: resultRow.point_code,
    date: resultRow.shift_date,
    is_day_off: 0,
    start_time: formatTimeHHMM(resultRow.start_time),
    end_time: formatTimeHHMM(resultRow.end_time),
    hours_worked: Number(resultRow.hours),
    rate_type: 'hourly',
    hourly_rate: Number(resultRow.hourly_rate || 350),
    shift_flat_rate: 0,
    sales_percent: 0,
    personal_sales: 0,
    tips: Number(resultRow.tips || 0),
    total_earned: totalEarned,
    user_name: resultRow.username,
    created_at: resultRow.created_at,
    updated_at: resultRow.created_at,
  };
}

/**
 * Delete a shift from Supabase shifts table
 */
export async function deleteShiftInSupabase(shiftId: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
  if (error) {
    throw new Error(error.message || 'Ошибка удаления смены');
  }
}

/**
 * Handle Shift Swap Exchange ("Биржа подмен")
 */
export async function swapShiftInSupabase(
  shiftId: string,
  action: 'request' | 'cancel' | 'take',
  currentUser: { id: string; username: string }
): Promise<void> {
  const { data: shift, error: fetchErr } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single();

  if (fetchErr || !shift) {
    throw new Error('Смена не найдена');
  }

  if (action === 'request') {
    const { error } = await supabase
      .from('shifts')
      .update({ on_market: true })
      .eq('id', shiftId);

    if (error) throw new Error(error.message);
  } else if (action === 'cancel') {
    const { error } = await supabase
      .from('shifts')
      .update({ on_market: false })
      .eq('id', shiftId);

    if (error) throw new Error(error.message);
  } else if (action === 'take') {
    if (shift.user_id === currentUser.id || shift.username === currentUser.username) {
      throw new Error('Вы не можете забрать собственную смену');
    }

    const { error } = await supabase
      .from('shifts')
      .update({
        user_id: currentUser.id,
        username: currentUser.username,
        on_market: false,
      })
      .eq('id', shiftId);

    if (error) throw new Error(error.message);
  }
}

/**
 * Generate cyclic pattern shifts (2/2, 3/3, 5/2) directly in Supabase shifts table
 */
export async function generatePatternShiftsInSupabase(params: {
  point_code: string;
  target_user: User;
  pattern: FixedPattern;
  start_date: string;
  day_in_cycle?: number;
  target_month?: string;
  start_time?: string;
  end_time?: string;
}): Promise<number> {
  const {
    point_code,
    target_user,
    pattern = '2/2',
    start_date,
    day_in_cycle = 1,
    target_month,
    start_time = '12:00',
    end_time = '00:00',
  } = params;

  const [sY, sM, sD] = start_date.split('-').map(Number);
  const startDateObj = new Date(sY, sM - 1, sD, 12, 0, 0);

  let fillYear = sY;
  let fillMonth = sM - 1;
  if (target_month) {
    const [tY, tM] = target_month.split('-').map(Number);
    fillYear = tY;
    fillMonth = tM - 1;
  }

  const lastDayOfFillMonth = new Date(fillYear, fillMonth + 1, 0, 12, 0, 0);
  const hours = calculateHoursWorked(start_time, end_time);

  let workDaysCount = 2;
  let offDaysCount = 2;
  if (pattern === '3/3') {
    workDaysCount = 3;
    offDaysCount = 3;
  } else if (pattern === '5/2') {
    workDaysCount = 5;
    offDaysCount = 2;
  }

  const cycleLength = workDaysCount + offDaysCount;
  const cycleOffset = (Number(day_in_cycle) || 1) - 1;

  const shiftsToInsert: any[] = [];
  const datesToDelete: string[] = [];

  const current = new Date(startDateObj);
  while (current <= lastDayOfFillMonth) {
    const curY = current.getFullYear();
    const curM = String(current.getMonth() + 1).padStart(2, '0');
    const curD = String(current.getDate()).padStart(2, '0');
    const dateStr = `${curY}-${curM}-${curD}`;

    let isWork = false;
    if (pattern === '5/2') {
      const dayOfWeek = current.getDay();
      isWork = dayOfWeek !== 0 && dayOfWeek !== 6;
    } else {
      const diffMs = current.getTime() - startDateObj.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const cyclePos = (diffDays + cycleOffset) % cycleLength;
      const normalizedCyclePos = (cyclePos + cycleLength) % cycleLength;
      isWork = normalizedCyclePos < workDaysCount;
    }

    if (isWork) {
      shiftsToInsert.push({
        point_code,
        user_id: target_user.id,
        username: target_user.username,
        shift_date: dateStr,
        start_time: formatTimeHHMM(start_time),
        end_time: formatTimeHHMM(end_time),
        hours,
        hourly_rate: target_user.hourly_rate || 350,
        tips: null, // Pure planned shift (ПЛАН)
        is_fixed: true,
        on_market: false,
      });
    } else {
      datesToDelete.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  // Delete off-days for this user's PLANNED schedule in date range
  if (datesToDelete.length > 0) {
    await supabase
      .from('shifts')
      .delete()
      .eq('point_code', point_code)
      .eq('username', target_user.username)
      .is('tips', null)
      .in('shift_date', datesToDelete);
  }

  // Insert/upsert generated work shifts into PLANNED schedule
  for (const s of shiftsToInsert) {
    // Delete existing PLANNED shift on that date to prevent duplicates
    await supabase
      .from('shifts')
      .delete()
      .eq('point_code', point_code)
      .eq('username', target_user.username)
      .eq('shift_date', s.shift_date)
      .is('tips', null);

    await supabase.from('shifts').insert(s);
  }

  return shiftsToInsert.length;
}

/**
 * Reset / clear planned shifts for month in Supabase
 */
export async function resetPlannedShiftsInSupabase(params: {
  point_code: string;
  month: string;
  target_user_id?: string;
  target_username?: string;
}): Promise<void> {
  const { point_code, month, target_username } = params;

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  let query = supabase
    .from('shifts')
    .delete()
    .eq('point_code', point_code)
    .is('tips', null)
    .gte('shift_date', `${month}-01`)
    .lte('shift_date', endDate);

  if (target_username) {
    query = query.eq('username', target_username);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message || 'Ошибка сброса смен');
  }
}

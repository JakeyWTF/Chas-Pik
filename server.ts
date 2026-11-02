import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  fetchUserFromSupabase,
  fetchTeamMembersFromSupabase,
  createPointInSupabase,
  joinPointInSupabase,
  profileLoginInSupabase,
  updateRateSettingsInSupabase,
  fetchShiftsFromSupabase,
  savePlannedShiftToSupabase,
  saveActualShiftToSupabase,
  deleteShiftInSupabase,
  swapShiftInSupabase,
  generatePatternShiftsInSupabase,
  resetPlannedShiftsInSupabase,
} from './src/services/supabaseService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// Helper to get Telegram user ID or username from header or query param
function getTgId(req: express.Request): string {
  const headerId = req.headers['x-telegram-user-id'] as string;
  if (headerId && headerId !== 'null' && headerId !== 'undefined' && headerId !== '') return headerId;
  const queryId = req.query.tg_id as string;
  if (queryId && queryId !== 'null' && queryId !== 'undefined' && queryId !== '') return queryId;
  return '';
}

// ---------------- API ROUTES (POWERED BY SUPABASE) ----------------

// Get current user and workplace status
app.get('/api/me', async (req, res) => {
  try {
    const tgId = getTgId(req);
    if (!tgId) {
      return res.json({ registered: false });
    }
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.json({ registered: false, tg_id: tgId });
    }
    return res.json({ registered: true, user });
  } catch (error) {
    console.error('Error in /api/me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ success: true });
});

// Login into personal employee profile by username and 4-digit PIN
app.post('/api/auth/profile-login', async (req, res) => {
  try {
    const { username, pin_code, tg_id } = req.body;
    const identifier = username || tg_id;
    if (!identifier) {
      return res.status(400).json({ error: 'Укажите логин или Telegram ID' });
    }

    const result = await profileLoginInSupabase(identifier, pin_code || '');
    res.json({
      success: true,
      user: result.user,
      workplace: result.workplace,
    });
  } catch (error: any) {
    console.error('Error in /api/auth/profile-login:', error);
    res.status(400).json({ error: error.message || 'Ошибка входа в профиль' });
  }
});

// List team users for point
app.get('/api/users', async (req, res) => {
  try {
    const workplaceId = (req.query.workplace_id as string) || '';
    const users = await fetchTeamMembersFromSupabase(workplaceId);
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new workplace point
app.post(['/api/workplaces/create', '/api/places/create'], async (req, res) => {
  try {
    const { name, pin_code, user_name, username, role_title, hourly_rate } = req.body;
    let tgId = getTgId(req) || req.body.tg_id;
    if (!tgId) {
      tgId = username || 'usr-' + Math.floor(1000 + Math.random() * 9000);
    }

    if (!name || !pin_code) {
      return res.status(400).json({ error: 'Заполните название заведения и 4-значный ПИН' });
    }

    const cleanUsername = username ? username.trim() : (user_name ? user_name.trim() : 'user');
    const result = await createPointInSupabase({
      name,
      pin_code,
      user_name: user_name || 'Сотрудник',
      username: cleanUsername,
      role_title,
      hourly_rate,
      tg_id: tgId,
    });

    res.json({
      success: true,
      workplace: result.workplace,
      user: result.user,
      tg_id: result.user.tg_id,
    });
  } catch (error: any) {
    console.error('Error creating workplace in Supabase:', error);
    res.status(500).json({ error: error.message || 'Ошибка создания заведения' });
  }
});

// Join existing workplace point by code + pin
app.post(['/api/workplaces/join', '/api/places/join'], async (req, res) => {
  try {
    const { code, pin_code, user_name, username, role_title, hourly_rate } = req.body;
    let tgId = getTgId(req) || req.body.tg_id;
    if (!tgId) {
      tgId = username || 'usr-' + Math.floor(1000 + Math.random() * 9000);
    }

    if (!code || !pin_code) {
      return res.status(400).json({ error: 'Введите код точки и пин-код' });
    }

    const cleanUsername = username ? username.trim() : (user_name ? user_name.trim() : 'user');
    const result = await joinPointInSupabase({
      code,
      pin_code,
      user_name: user_name || 'Сотрудник',
      username: cleanUsername,
      role_title,
      hourly_rate,
      tg_id: tgId,
    });

    res.json({
      success: true,
      workplace: result.workplace,
      user: result.user,
      tg_id: result.user.tg_id,
    });
  } catch (error: any) {
    console.error('Error joining workplace in Supabase:', error);
    res.status(400).json({ error: error.message || 'Ошибка при входе в точку' });
  }
});

// Update personal rate settings
app.post('/api/user/rate-settings', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await updateRateSettingsInSupabase(user.id, req.body);
    res.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Error updating rate settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update rate settings' });
  }
});

// Update workplace settings
app.post(['/api/workplaces/:id/settings', '/api/places/:id/settings'], async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (user) {
      const updated = await updateRateSettingsInSupabase(user.id, { schedule_mode: req.body.schedule_mode });
      return res.json({ success: true, workplace: { schedule_mode: updated.schedule_mode } });
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

// Get ACTUAL shifts (ФАКТ)
app.get('/api/shifts', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.json({ shifts: [], stats: { totalEarned: 0, totalHours: 0, shiftsCount: 0 } });
    }

    const month = req.query.month as string;
    const result = await fetchShiftsFromSupabase({
      pointCode: user.workplace_code,
      month,
      userId: user.id,
      username: user.username,
    });

    res.json({
      shifts: result.myShifts,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Error fetching shifts from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Save or update ACTUAL shift (ФАКТ)
app.post('/api/shifts', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.status(400).json({ error: 'Сначала подключитесь к точке' });
    }

    const { date, start_time, end_time, hourly_rate, tips, is_day_off } = req.body;
    const shift = await saveActualShiftToSupabase({
      point_code: user.workplace_code,
      user_id: user.id,
      username: user.username || user.name,
      date,
      start_time: start_time || '12:00',
      end_time: end_time || '00:00',
      hourly_rate: Number(hourly_rate) || user.hourly_rate || 350,
      tips: Number(tips) || 0,
      is_day_off: is_day_off ? 1 : 0,
    });

    res.json({ success: true, shift });
  } catch (error: any) {
    console.error('Error saving actual shift in Supabase:', error);
    res.status(500).json({ error: error.message || 'Ошибка сохранения фактической смены' });
  }
});

// Delete an ACTUAL shift
app.delete('/api/shifts/:id', async (req, res) => {
  try {
    await deleteShiftInSupabase(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

// Confirm planned shift into actual shift
app.post('/api/shifts/confirm-plan', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.status(400).json({ error: 'Сначала подключитесь к точке' });
    }

    const { date, tips = 0 } = req.body;
    await saveActualShiftToSupabase({
      point_code: user.workplace_code,
      user_id: user.id,
      username: user.username || user.name,
      date,
      start_time: '12:00',
      end_time: '00:00',
      hourly_rate: user.hourly_rate || 350,
      tips: Number(tips) || 0,
      is_day_off: 0,
    });

    res.json({ success: true, message: `Смена на ${date} подтверждена по факту!` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка подтверждения смены' });
  }
});

// Get PLANNED shifts
app.get('/api/planned-shifts', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.json({ plannedShifts: [], planStats: { plannedTotalEarned: 0, plannedTotalHours: 0, plannedShiftsCount: 0 } });
    }

    const month = req.query.month as string;
    const result = await fetchShiftsFromSupabase({
      pointCode: user.workplace_code,
      month,
      userId: user.id,
      username: user.username,
    });

    res.json({
      plannedShifts: result.plannedShifts,
      planStats: result.planStats,
    });
  } catch (error) {
    console.error('Error fetching planned shifts from Supabase:', error);
    res.status(500).json({ error: 'Failed to fetch planned shifts' });
  }
});

// Save or update PLANNED shift
app.post('/api/planned-shifts', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.status(400).json({ error: 'Сначала подключитесь к точке' });
    }

    const { date, target_user_id, is_day_off, start_time, end_time, schedule_type } = req.body;
    const team = await fetchTeamMembersFromSupabase(user.workplace_code);
    const targetMember = team.find((m) => m.id === target_user_id) || user;

    const plannedShift = await savePlannedShiftToSupabase({
      point_code: user.workplace_code,
      user_id: targetMember.id,
      username: targetMember.username || targetMember.name,
      date,
      start_time: start_time || '12:00',
      end_time: end_time || '00:00',
      hourly_rate: targetMember.hourly_rate || user.hourly_rate || 350,
      schedule_type: schedule_type || 'weekly',
      is_day_off: is_day_off ? 1 : 0,
    });

    res.json({ success: true, plannedShift });
  } catch (error: any) {
    console.error('Error saving planned shift in Supabase:', error);
    res.status(500).json({ error: error.message || 'Ошибка сохранения плана' });
  }
});

// Delete a PLANNED shift
app.delete('/api/planned-shifts/:id', async (req, res) => {
  try {
    await deleteShiftInSupabase(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete planned shift' });
  }
});

// Generate cyclic pattern
app.post('/api/planned-shifts/generate-pattern', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.status(400).json({ error: 'Сначала подключитесь к точке' });
    }

    const { target_user_id, pattern, start_date, day_in_cycle, target_month, start_time, end_time } = req.body;
    const team = await fetchTeamMembersFromSupabase(user.workplace_code);
    const targetMember = team.find((m) => m.id === target_user_id) || user;

    const count = await generatePatternShiftsInSupabase({
      point_code: user.workplace_code,
      target_user: targetMember,
      pattern: pattern || '2/2',
      start_date,
      day_in_cycle,
      target_month,
      start_time,
      end_time,
    });

    res.json({ success: true, count });
  } catch (error: any) {
    console.error('Error generating pattern in Supabase:', error);
    res.status(500).json({ error: error.message || 'Ошибка генерации циклического графика' });
  }
});

// Reset planned shifts for month
app.post('/api/planned-shifts/reset', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const user = await fetchUserFromSupabase(tgId);
    if (!user || !user.workplace_code) {
      return res.status(400).json({ error: 'Сначала подключитесь к точке' });
    }

    const { month, target_user_id } = req.body;
    const team = await fetchTeamMembersFromSupabase(user.workplace_code);
    const targetMember = target_user_id ? team.find((m) => m.id === target_user_id) : undefined;

    await resetPlannedShiftsInSupabase({
      point_code: user.workplace_code,
      month,
      target_user_id,
      target_username: targetMember?.username,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error resetting planned shifts in Supabase:', error);
    res.status(500).json({ error: error.message || 'Ошибка сброса смен' });
  }
});

// Shift swap exchange on PLANNED shifts (Биржа подмен)
app.post('/api/planned-shifts/:id/swap', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const currentUser = await fetchUserFromSupabase(tgId);
    if (!currentUser) return res.status(403).json({ error: 'Unauthorized' });

    const { action } = req.body;
    await swapShiftInSupabase(req.params.id, action, {
      id: currentUser.id,
      username: currentUser.username || currentUser.name,
    });

    res.json({ success: true, message: 'Действие с биржей успешно выполнено' });
  } catch (error: any) {
    console.error('Error in planned shift swap in Supabase:', error);
    res.status(400).json({ error: error.message || 'Ошибка при обмене смены' });
  }
});

// Month summary text generator for copy/export
app.get('/api/report/summary', async (req, res) => {
  try {
    const tgId = getTgId(req);
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const user = await fetchUserFromSupabase(tgId);

    if (!user || !user.workplace_code) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { myShifts } = await fetchShiftsFromSupabase({
      pointCode: user.workplace_code,
      month,
      userId: user.id,
      username: user.username,
    });

    let totalHours = 0;
    let totalBaseEarned = 0;
    let totalTips = 0;

    const [year, m] = month.split('-');
    const monthNames = [
      'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
      'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
    ];
    const monthName = monthNames[parseInt(m, 10) - 1] || month;

    let text = `📄 ТАБЕЛЬ УЧЕТА СМЕН ЗА ${monthName.toUpperCase()} ${year}\n`;
    text += `👤 Сотрудник: ${user.name} (${user.role_title})\n`;
    text += `🏢 Заведение: ${user.workplace_name || 'Точка'} [${user.workplace_code || '---'}]\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    myShifts.forEach((s) => {
      const d = s.date.split('-')[2];
      totalHours += s.hours_worked;
      const baseEarned = (s.total_earned || 0) - (s.tips || 0);
      totalBaseEarned += baseEarned;
      totalTips += s.tips || 0;

      text += `📅 ${d}.${m} | ${s.start_time} - ${s.end_time} (${s.hours_worked}ч) → ${baseEarned.toLocaleString('ru-RU')} ₽`;
      if (s.tips > 0) {
        text += ` + чай: ${s.tips.toLocaleString('ru-RU')} ₽`;
      }
      text += `\n`;
    });

    const grandTotal = totalBaseEarned + totalTips;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `⚡ Всего смен: ${myShifts.length}\n`;
    text += `⏱ Отработано часов: ${totalHours.toFixed(1)} ч\n`;
    text += `💵 Зарплатная часть: ${totalBaseEarned.toLocaleString('ru-RU')} ₽\n`;
    if (totalTips > 0) {
      text += `💰 Личные чаевые: ${totalTips.toLocaleString('ru-RU')} ₽\n`;
    }
    text += `🏆 ИТОГО НА РУКИ: ${grandTotal.toLocaleString('ru-RU')} ₽\n`;
    text += `\nСформировано автоматически в ЧасПик @chaspik_app`;

    res.json({
      text,
      stats: {
        shiftsCount: myShifts.length,
        totalHours: Math.round(totalHours * 10) / 10,
        totalBaseEarned,
        totalTips,
        grandTotal,
      },
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Setup Vite middlewares for dev or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT} with Supabase backend`);
  });
}

startServer();

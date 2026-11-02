import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data folder exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'chaspik.db');
export const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workplaces (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      schedule_mode TEXT DEFAULT 'weekly',
      fixed_pattern TEXT DEFAULT '2/2',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tg_id TEXT UNIQUE NOT NULL,
      username TEXT,
      workplace_id TEXT,
      name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      default_rate_type TEXT DEFAULT 'hourly',
      hourly_rate REAL DEFAULT 350,
      shift_flat_rate REAL DEFAULT 3000,
      sales_percent REAL DEFAULT 3.0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workplace_id TEXT NOT NULL,
      date TEXT NOT NULL,
      is_day_off INTEGER DEFAULT 0,
      start_time TEXT DEFAULT '12:00',
      end_time TEXT DEFAULT '00:00',
      hours_worked REAL DEFAULT 12,
      rate_type TEXT DEFAULT 'hourly',
      hourly_rate REAL DEFAULT 350,
      shift_flat_rate REAL DEFAULT 0,
      sales_percent REAL DEFAULT 0,
      personal_sales REAL DEFAULT 0,
      tips REAL DEFAULT 0,
      total_earned REAL DEFAULT 0,
      swap_status TEXT DEFAULT 'none', -- 'none', 'seeking_swap', 'swapped'
      swap_note TEXT,
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS planned_shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workplace_id TEXT NOT NULL,
      date TEXT NOT NULL,
      is_day_off INTEGER DEFAULT 0,
      start_time TEXT DEFAULT '12:00',
      end_time TEXT DEFAULT '00:00',
      hours_worked REAL DEFAULT 12,
      schedule_type TEXT DEFAULT 'weekly',
      swap_status TEXT DEFAULT 'none', -- 'none', 'seeking_swap', 'swapped'
      swap_note TEXT,
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE,
      UNIQUE(user_id, date, schedule_type)
    );

    CREATE TABLE IF NOT EXISTS swap_logs (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Column migration for older DBs
  try {
    db.exec("ALTER TABLE planned_shifts ADD COLUMN schedule_type TEXT DEFAULT 'weekly'");
  } catch (e) {
    // Column already exists
  }

  // Schema migration: Ensure planned_shifts has UNIQUE(user_id, date, schedule_type) constraint
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='planned_shifts'").get() as any;
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('schedule_type') && tableInfo.sql.includes('UNIQUE(user_id, date)')) {
      db.exec(`
        BEGIN TRANSACTION;
        CREATE TABLE planned_shifts_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workplace_id TEXT NOT NULL,
          date TEXT NOT NULL,
          is_day_off INTEGER DEFAULT 0,
          start_time TEXT DEFAULT '12:00',
          end_time TEXT DEFAULT '00:00',
          hours_worked REAL DEFAULT 12,
          schedule_type TEXT DEFAULT 'weekly',
          swap_status TEXT DEFAULT 'none',
          swap_note TEXT,
          comment TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE,
          UNIQUE(user_id, date, schedule_type)
        );
        INSERT OR IGNORE INTO planned_shifts_new (id, user_id, workplace_id, date, is_day_off, start_time, end_time, hours_worked, schedule_type, swap_status, swap_note, comment, created_at, updated_at)
        SELECT id, user_id, workplace_id, date, is_day_off, start_time, end_time, hours_worked, COALESCE(schedule_type, 'weekly'), swap_status, swap_note, comment, created_at, updated_at
        FROM planned_shifts;
        DROP TABLE planned_shifts;
        ALTER TABLE planned_shifts_new RENAME TO planned_shifts;
        COMMIT;
      `);
    }
  } catch (e) {
    console.error('Migration error for planned_shifts schema:', e);
  }

  // Column migration for users username
  try {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
  } catch (e) {
    // Column already exists
  }
}

/**
 * Calculates hours between start and end times, accurately supporting overnight shifts (e.g. 12:00 -> 00:00 = 12h, 18:00 -> 04:00 = 10h).
 */
export function calculateHoursWorked(start: string, end: string): number {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  let startMinutes = startH * 60 + (startM || 0);
  let endMinutes = endH * 60 + (endM || 0);

  if (endMinutes <= startMinutes) {
    // Overnight shift crossing 00:00
    endMinutes += 24 * 60;
  }
  const diffMinutes = endMinutes - startMinutes;
  return Number((diffMinutes / 60).toFixed(2));
}

/**
 * Calculates total earnings based on rate configuration and tips.
 */
export function calculateEarnings(params: {
  hoursWorked: number;
  rateType: string;
  hourlyRate: number;
  shiftFlatRate: number;
  salesPercent: number;
  personalSales: number;
  tips: number;
}): number {
  const { hoursWorked, rateType, hourlyRate, shiftFlatRate, salesPercent, personalSales, tips } = params;
  let base = 0;

  switch (rateType) {
    case 'hourly':
      base = hoursWorked * (hourlyRate || 0);
      break;
    case 'fixed_shift':
      base = shiftFlatRate || 0;
      break;
    case 'percent':
      base = ((personalSales || 0) * (salesPercent || 0)) / 100;
      break;
    case 'combined':
      base = hoursWorked * (hourlyRate || 0) + ((personalSales || 0) * (salesPercent || 0)) / 100 + (shiftFlatRate || 0);
      break;
    default:
      base = hoursWorked * (hourlyRate || 0);
  }

  return Math.round(base + (tips || 0));
}

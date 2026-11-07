export type RateType = 'hourly' | 'percent' | 'fixed_shift' | 'combined';

export type ScheduleMode = 'weekly' | 'fixed';

export type FixedPattern = '2/2' | '3/3' | '5/2';

export interface User {
  id: string;
  tg_id: string;
  username?: string;
  workplace_id?: string;
  name: string;
  role_title: string;
  role?: string;
  default_rate_type: RateType;
  payment_type?: RateType;
  hourly_rate: number;
  shift_flat_rate: number;
  fixed_rate?: number;
  sales_percent: number;
  workplace_name?: string;
  workplace_code?: string;
  schedule_mode?: ScheduleMode;
  fixed_pattern?: FixedPattern;
  created_at: string;
  is_superadmin?: boolean;
}

export interface Workplace {
  id: string;
  code: string;
  name: string;
  pin_code: string;
  schedule_mode: ScheduleMode;
  fixed_pattern: FixedPattern;
  created_at: string;
}

/**
 * Actual/Factual Shift (ФАКТ)
 * Used strictly for personal timesheet, money control, and actual salary calculation.
 */
export interface Shift {
  id: string;
  user_id: string;
  workplace_id: string;
  date: string; // YYYY-MM-DD
  is_day_off: number; // 0 or 1
  start_time: string; // "12:00"
  end_time: string; // "00:00"
  hours_worked: number;
  rate_type: RateType;
  hourly_rate: number;
  shift_flat_rate: number;
  sales_percent: number;
  personal_sales: number;
  tips: number;
  total_earned: number;
  comment?: string;
  user_name?: string;
  role_title?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Planned Shift (ПЛАН)
 * Used for team schedule, weekly/monthly planning, planned earnings calculation, and shift exchange (биржа подмен).
 */
export interface PlannedShift {
  id: string;
  user_id: string;
  workplace_id: string;
  date: string; // YYYY-MM-DD
  is_day_off: number; // 0 or 1
  start_time: string; // "12:00"
  end_time: string; // "00:00"
  hours_worked: number;
  planned_earned: number;
  swap_status: 'none' | 'seeking_swap' | 'swapped';
  swap_note?: string;
  comment?: string;
  user_name?: string;
  role_title?: string;
  default_rate_type?: RateType;
  rate_type?: RateType;
  hourly_rate?: number;
  shift_flat_rate?: number;
  sales_percent?: number;
  schedule_type?: ScheduleMode;
  created_at: string;
  updated_at: string;
}

export interface MonthStats {
  totalEarned: number;
  totalHours: number;
  shiftsCount: number;
}

export interface PlanStats {
  plannedTotalEarned: number;
  plannedTotalHours: number;
  plannedShiftsCount: number;
}

export interface OnlinePresenceUser {
  user_id: string;
  username: string;
  role: string;
  name?: string;
  workplace_code?: string;
  online_at?: string;
}

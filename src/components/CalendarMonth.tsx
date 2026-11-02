import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Clock, CalendarDays, Sparkles } from 'lucide-react';
import { Shift, PlannedShift, User } from '../types';
import { triggerHaptic } from '../lib/telegram';

interface CalendarMonthProps {
  currentDate: Date;
  selectedDate: string; // YYYY-MM-DD
  shifts: Shift[]; // Fact
  plannedShifts?: PlannedShift[]; // Plan
  currentUser?: User | null;
  onSelectDate: (dateStr: string) => void;
  onOpenShiftModal: (dateStr: string, prefillFromPlan?: PlannedShift) => void;
  onConfirmPlan?: (dateStr: string) => Promise<void>;
  onChangeMonth: (delta: number) => void;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const CalendarMonth: React.FC<CalendarMonthProps> = ({
  currentDate,
  selectedDate,
  shifts,
  plannedShifts = [],
  currentUser,
  onSelectDate,
  onOpenShiftModal,
  onConfirmPlan,
  onChangeMonth,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of current month (0=Sun, 1=Mon, ..., 6=Sat)
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday=0, Sunday=6

  // Total days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days in previous month
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Shift map for instant lookup of ACTUAL shifts by date YYYY-MM-DD
  const actualShiftMap = new Map<string, Shift>();
  shifts.forEach((s) => {
    actualShiftMap.set(s.date, s);
  });

  // Planned shift map for current user by date YYYY-MM-DD
  const plannedShiftMap = new Map<string, PlannedShift>();
  plannedShifts.forEach((ps) => {
    if (ps.user_id === currentUser?.id) {
      plannedShiftMap.set(ps.date, ps);
    }
  });

  // Today string using local date values (prevents timezone day offset)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Build grid calendar cells
  interface DayCell {
    dayNum: number;
    isCurrentMonth: boolean;
    dateStr: string;
    actualShift?: Shift;
    plannedShift?: PlannedShift;
  }

  const cells: DayCell[] = [];

  // Helper to format local date string YYYY-MM-DD
  const toLocalDateStr = (y: number, m: number, d: number) => {
    const target = new Date(y, m, d);
    const targetY = target.getFullYear();
    const targetM = String(target.getMonth() + 1).padStart(2, '0');
    const targetD = String(target.getDate()).padStart(2, '0');
    return `${targetY}-${targetM}-${targetD}`;
  };

  // Trailing previous month days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const dateStr = toLocalDateStr(year, month - 1, dayNum);
    cells.push({
      dayNum,
      isCurrentMonth: false,
      dateStr,
      actualShift: actualShiftMap.get(dateStr),
      plannedShift: plannedShiftMap.get(dateStr),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toLocalDateStr(year, month, d);
    cells.push({
      dayNum: d,
      isCurrentMonth: true,
      dateStr,
      actualShift: actualShiftMap.get(dateStr),
      plannedShift: plannedShiftMap.get(dateStr),
    });
  }

  // Trailing next month days to fill rows of 7
  const remainingCells = 7 - (cells.length % 7);
  if (remainingCells < 7) {
    for (let d = 1; d <= remainingCells; d++) {
      const dateStr = toLocalDateStr(year, month + 1, d);
      cells.push({
        dayNum: d,
        isCurrentMonth: false,
        dateStr,
        actualShift: actualShiftMap.get(dateStr),
        plannedShift: plannedShiftMap.get(dateStr),
      });
    }
  }

  const handleDayClick = (cell: DayCell) => {
    triggerHaptic('light');
    onSelectDate(cell.dateStr);
  };

  const formatSelectedDateTitle = (dStr: string) => {
    if (!dStr) return '';
    const [y, m, d] = dStr.split('-').map(Number);
    const mName = MONTH_NAMES[(m || 1) - 1]?.toLowerCase() || '';
    return `${d} ${mName}`;
  };

  const currentActualShift = actualShiftMap.get(selectedDate);
  const currentPlannedShift = plannedShiftMap.get(selectedDate);

  return (
    <div className="px-4 py-3">
      {/* Title & Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 font-sans">
            Календарь смен
          </h2>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            ФАКТ
          </span>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-0.5">
          <button
            onClick={() => {
              triggerHaptic('light');
              onChangeMonth(-1);
            }}
            className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-2 text-gray-800 dark:text-gray-200">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => {
              triggerHaptic('light');
              onChangeMonth(1);
            }}
            className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar container */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-gray-100 dark:border-neutral-800 shadow-sm">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {WEEKDAYS.map((w, idx) => (
            <div
              key={w}
              className={`text-xs font-semibold ${
                idx >= 5 ? 'text-rose-500/80 dark:text-rose-400/80' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            const isSelected = cell.dateStr === selectedDate;
            const isToday = cell.dateStr === todayStr;
            const hasActualShift = cell.actualShift && !cell.actualShift.is_day_off;
            const hasPlannedShift = !hasActualShift && cell.plannedShift && !cell.plannedShift.is_day_off;
            const isDayOff = cell.actualShift && cell.actualShift.is_day_off;

            return (
              <button
                key={`grid-cell-${cell.dateStr}-${cell.isCurrentMonth ? 'curr' : 'tail'}-${idx}`}
                onClick={() => handleDayClick(cell)}
                className={`relative h-12 flex flex-col items-center justify-start pt-1.5 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-[#1E88E5] text-white shadow-md shadow-blue-500/25 scale-[1.03] z-10'
                    : isToday
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                    : cell.isCurrentMonth
                    ? 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800'
                    : 'text-gray-300 dark:text-neutral-600'
                }`}
              >
                {/* Day Number */}
                <span className={`text-xs leading-none font-semibold ${isSelected ? 'text-white' : ''}`}>
                  {cell.dayNum}
                </span>

                {/* Status Indicator */}
                <div className="mt-1 flex items-center justify-center">
                  {/* Confirmed Actual Shift -> Solid Green Dot */}
                  {hasActualShift && (
                    <div
                      className={`w-2 h-2 rounded-full transition-transform ${
                        isSelected ? 'bg-white' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      }`}
                    />
                  )}

                  {/* Planned Shift Not Confirmed Yet -> Blue Outline Pulse */}
                  {hasPlannedShift && (
                    <div
                      className={`w-2 h-2 rounded-full border-2 transition-transform ${
                        isSelected ? 'border-white bg-white/40' : 'border-blue-500 bg-blue-100 animate-pulse'
                      }`}
                    />
                  )}

                  {isDayOff && (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400/60 dark:bg-neutral-600" />
                  )}
                </div>

                {/* Mini hours badge */}
                {hasActualShift && (
                  <span
                    className={`text-[9px] font-bold mt-0.5 leading-none ${
                      isSelected ? 'text-blue-100' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {cell.actualShift?.hours_worked}ч
                  </span>
                )}

                {hasPlannedShift && (
                  <span
                    className={`text-[8px] font-extrabold mt-0.5 leading-none uppercase ${
                      isSelected ? 'text-blue-100' : 'text-blue-500 dark:text-blue-400'
                    }`}
                  >
                    ПЛАН
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Floating Add Fact Action Button (+) */}
        <div className="absolute -bottom-4 right-4 z-20">
          <button
            onClick={() => {
              triggerHaptic('medium');
              onOpenShiftModal(selectedDate || todayStr, currentPlannedShift);
            }}
            className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-transform"
            title="Внести фактическую смену"
            aria-label="Внести фактическую смену"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Selected day summary bar below calendar */}
      {selectedDate && (
        <div className="mt-4 pt-1">
          {/* CASE 1: ACTUAL SHIFT IS CONFIRMED */}
          {currentActualShift && !currentActualShift.is_day_off ? (
            <div
              key={`summary-actual-${selectedDate}`}
              onClick={() => onOpenShiftModal(selectedDate)}
              className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between cursor-pointer hover:border-emerald-400 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-xs">
                  ФАКТ
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>
                      {formatSelectedDateTitle(selectedDate)}: {currentActualShift.start_time} – {currentActualShift.end_time} ({currentActualShift.hours_worked}ч)
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {currentActualShift.rate_type === 'hourly' && `Почасовая (${currentActualShift.hourly_rate} ₽/ч)`}
                    {currentActualShift.rate_type === 'percent' && `% от продаж (${currentActualShift.sales_percent}%)`}
                    {currentActualShift.rate_type === 'fixed_shift' && `Оклад за выход (${currentActualShift.shift_flat_rate} ₽)`}
                    {currentActualShift.rate_type === 'combined' && `Комбинированная`}
                    {currentActualShift.tips > 0 && ` + чай ${currentActualShift.tips} ₽`}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 font-mono block">
                  +{currentActualShift.total_earned.toLocaleString('ru-RU')} ₽
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  В расчете ЗП
                </span>
              </div>
            </div>
          ) : /* CASE 2: NO ACTUAL SHIFT, BUT PLANNED SHIFT EXISTS FOR CURRENT USER */
          currentPlannedShift && !currentPlannedShift.is_day_off ? (
            <div
              key={`summary-planned-${selectedDate}`}
              className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold text-[10px]">
                    ПЛАН
                  </div>
                  <div>
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      {formatSelectedDateTitle(selectedDate)}: {currentPlannedShift.start_time} – {currentPlannedShift.end_time} ({currentPlannedShift.hours_worked}ч)
                    </div>
                    <div className="text-[11px] text-blue-700 dark:text-blue-300">
                      По плану: <b className="font-mono">{(currentPlannedShift.planned_earned || Math.round((currentPlannedShift.hours_worked || 0) * (currentUser?.hourly_rate || 350))).toLocaleString('ru-RU')} ₽</b> (не зачислено в ЗП)
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  triggerHaptic('medium');
                  if (onConfirmPlan) {
                    await onConfirmPlan(selectedDate);
                  } else {
                    onOpenShiftModal(selectedDate, currentPlannedShift);
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>⚡ Подтвердить как отработанную (ФАКТ)</span>
              </button>
            </div>
          ) : currentActualShift?.is_day_off ? (
            <div
              key={`summary-off-${selectedDate}`}
              onClick={() => onOpenShiftModal(selectedDate)}
              className="p-3 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 flex items-center justify-between cursor-pointer"
            >
              <div className="text-xs text-gray-500 font-medium">
                📅 {formatSelectedDateTitle(selectedDate)} — Отмечен как выходной
              </div>
              <span className="text-xs text-blue-600 font-semibold">Изменить</span>
            </div>
          ) : (
            /* CASE 3: NO SHIFTS RECORDED */
            <div
              key={`summary-none-${selectedDate}`}
              onClick={() => onOpenShiftModal(selectedDate)}
              className="p-3 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition"
            >
              <div className="text-xs text-gray-500">
                📅 {formatSelectedDateTitle(selectedDate)}: нет фактической смены
              </div>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Внести факт
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  ChevronLeft, ChevronRight, FileText, Repeat, Handshake, AlertTriangle,
  Calendar, Plus, Clock, Sparkles, Wand2, RefreshCw, Trash2, UserCheck, CheckCircle2, X, Check, FileSpreadsheet
} from 'lucide-react';
import { PlannedShift, User, ScheduleMode, PlanStats, FixedPattern } from '../types';
import { triggerHaptic } from '../lib/telegram';
import { PlannedShiftModal } from './PlannedShiftModal';
import confetti from 'canvas-confetti';

interface TeamScheduleTabProps {
  plannedShifts: PlannedShift[];
  currentUser: User | null;
  teamMembers: User[];
  planStats?: PlanStats;
  onlineCount?: number;
  onTakeSwap: (shiftId: string) => Promise<void>;
  onRequestSwap: (shiftId: string, note?: string) => Promise<void>;
  onCancelSwap: (shiftId: string) => Promise<void>;
  onSavePlannedShift: (data: {
    date: string;
    target_user_id: string;
    is_day_off: number;
    start_time: string;
    end_time: string;
    comment?: string;
    schedule_type?: ScheduleMode;
  }) => Promise<void>;
  onDeletePlannedShift: (shiftId: string) => Promise<void>;
  onGeneratePattern?: (data: {
    target_user_id: string;
    pattern: FixedPattern;
    start_date: string;
    day_in_cycle?: number;
    target_month?: string;
    start_time?: string;
    end_time?: string;
  }) => Promise<void>;
  onResetPattern?: (resetData: { month: string; target_user_id?: string }) => Promise<void>;
  onOpenReportModal?: () => void;
  onUpdateWorkplaceScheduleMode?: (mode: ScheduleMode) => Promise<void>;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const MONTH_NAMES_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
];

const WEEKDAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAYS_HEADER = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const TeamScheduleTab: React.FC<TeamScheduleTabProps> = ({
  plannedShifts,
  currentUser,
  teamMembers,
  planStats,
  onlineCount = 1,
  onTakeSwap,
  onRequestSwap,
  onCancelSwap,
  onSavePlannedShift,
  onDeletePlannedShift,
  onGeneratePattern,
  onResetPattern,
  onOpenReportModal,
  onUpdateWorkplaceScheduleMode,
}) => {
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    currentUser?.schedule_mode || 'weekly'
  );

  // Offset for Week View
  const [weekOffset, setWeekOffset] = useState(0);

  // Month navigation for Fixed Month View
  const [monthDate, setMonthDate] = useState<Date>(new Date());

  // Pattern Generator state
  const [selectedPattern, setSelectedPattern] = useState<FixedPattern>(
    currentUser?.fixed_pattern || '2/2'
  );
  const [patternUserId, setPatternUserId] = useState<string>(
    currentUser?.id || (teamMembers[0]?.id ?? '')
  );
  const [patternStartDate, setPatternStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dayInCycle, setDayInCycle] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [approvedToast, setApprovedToast] = useState(false);
  const [exportToast, setExportToast] = useState(false);

  // Swapping loading state
  const [isSwapping, setIsSwapping] = useState<string | null>(null);

  // Planned shift modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string>('');
  const [selectedShiftForModal, setSelectedShiftForModal] = useState<PlannedShift | undefined>(undefined);

  // Selected Day Details Drawer for Fixed Month View
  const [selectedMonthDate, setSelectedMonthDate] = useState<string | null>(null);

  // Format YYYY-MM month string
  const currentMonthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (currentUser?.schedule_mode) {
      setScheduleMode(currentUser.schedule_mode);
    }
  }, [currentUser?.schedule_mode]);

  // Compute Monday of the week for Week View
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const baseMonday = getMonday(new Date());
  baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(baseMonday);
    d.setDate(baseMonday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNumStr = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayNumStr}`;
    const dayName = WEEKDAY_NAMES[d.getDay()];
    const dayNum = d.getDate();
    return { dateStr, dayName, dayNum, fullDate: d };
  });

  const rangeStart = `${weekDays[0].dayNum} ${MONTH_NAMES_SHORT[weekDays[0].fullDate.getMonth()]}`;
  const rangeEnd = `${weekDays[weekDays.length - 1].dayNum} ${MONTH_NAMES_SHORT[weekDays[weekDays.length - 1].fullDate.getMonth()]}`;

  // Filter planned shifts strictly by active mode to isolate weekly vs fixed schedules
  const activeWeeklyShifts = plannedShifts.filter((s) => s.schedule_type === 'weekly' || !s.schedule_type);
  const activeFixedShifts = plannedShifts.filter((s) => s.schedule_type === 'fixed');

  // Calculate planned earnings for active user on viewing week (Weekly View)
  const viewingWeekDates = new Set(weekDays.map((w) => w.dateStr));
  let userWeekPlannedEarnings = 0;
  let userWeekPlannedHours = 0;

  activeWeeklyShifts.forEach((ps) => {
    if (ps.user_id === currentUser?.id && viewingWeekDates.has(ps.date) && !ps.is_day_off) {
      userWeekPlannedEarnings += ps.planned_earned || 0;
      userWeekPlannedHours += ps.hours_worked || 0;
    }
  });

  // Calculate planned earnings for active user on viewing month (Fixed View)
  let userMonthPlannedEarnings = 0;
  let userMonthPlannedHours = 0;
  let userMonthPlannedShiftsCount = 0;

  activeFixedShifts.forEach((ps) => {
    if (ps.user_id === currentUser?.id && ps.date.startsWith(currentMonthStr) && !ps.is_day_off) {
      userMonthPlannedEarnings += ps.planned_earned || 0;
      userMonthPlannedHours += ps.hours_worked || 0;
      userMonthPlannedShiftsCount += 1;
    }
  });

  // Calculate month grid cells for Fixed Month View
  const gridYear = monthDate.getFullYear();
  const gridMonth = monthDate.getMonth();
  const firstDayOfMonth = new Date(gridYear, gridMonth, 1);
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Mon=0, Sun=6
  const daysInMonth = new Date(gridYear, gridMonth + 1, 0).getDate();
  const prevMonthDays = new Date(gridYear, gridMonth, 0).getDate();

  const toLocalDateStr = (y: number, m: number, d: number) => {
    const target = new Date(y, m, d);
    const targetY = target.getFullYear();
    const targetM = String(target.getMonth() + 1).padStart(2, '0');
    const targetD = String(target.getDate()).padStart(2, '0');
    return `${targetY}-${targetM}-${targetD}`;
  };

  interface MonthCell {
    dayNum: number;
    isCurrentMonth: boolean;
    dateStr: string;
    dayShifts: PlannedShift[];
  }

  const monthCells: MonthCell[] = [];

  // Map fixed planned shifts by date
  const fixedShiftsByDate = new Map<string, PlannedShift[]>();
  activeFixedShifts.forEach((ps) => {
    const existing = fixedShiftsByDate.get(ps.date) || [];
    existing.push(ps);
    fixedShiftsByDate.set(ps.date, existing);
  });

  // Prev month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const dateStr = toLocalDateStr(gridYear, gridMonth - 1, dayNum);
    monthCells.push({
      dayNum,
      isCurrentMonth: false,
      dateStr,
      dayShifts: fixedShiftsByDate.get(dateStr) || [],
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toLocalDateStr(gridYear, gridMonth, d);
    monthCells.push({
      dayNum: d,
      isCurrentMonth: true,
      dateStr,
      dayShifts: fixedShiftsByDate.get(dateStr) || [],
    });
  }

  // Next month padding
  const remaining = 7 - (monthCells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dateStr = toLocalDateStr(gridYear, gridMonth + 1, d);
      monthCells.push({
        dayNum: d,
        isCurrentMonth: false,
        dateStr,
        dayShifts: fixedShiftsByDate.get(dateStr) || [],
      });
    }
  }

  const handleTakeSwap = async (shiftId: string) => {
    try {
      setIsSwapping(shiftId);
      triggerHaptic('medium');
      await onTakeSwap(shiftId);
      confetti({
        particleCount: 40,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSwapping(null);
    }
  };

  const handleModeChange = async (mode: ScheduleMode) => {
    triggerHaptic('light');
    setScheduleMode(mode);
    if (onUpdateWorkplaceScheduleMode) {
      try {
        await onUpdateWorkplaceScheduleMode(mode);
      } catch (e) {
        console.warn('Mode change note:', e);
      }
    }
  };

  const handleOpenAddModal = (dateStr: string, existing?: PlannedShift) => {
    triggerHaptic('light');
    setSelectedDateForModal(dateStr);
    setSelectedShiftForModal(existing);
    setModalOpen(true);
  };

  const handleSaveModalShift = async (data: any) => {
    await onSavePlannedShift({
      ...data,
      schedule_type: scheduleMode,
    });
  };

  const handleApproveWeeklySchedule = () => {
    triggerHaptic('success');
    confetti({
      particleCount: 50,
      spread: 90,
      origin: { y: 0.6 },
    });
    setApprovedToast(true);
    setTimeout(() => setApprovedToast(false), 3500);
  };

  const handleExportTeamSchedule = (exportFormat: 'excel' | 'csv' = 'excel') => {
    triggerHaptic('medium');

    const workplaceCode = currentUser?.workplace_code || 'CHASPIK';
    const workplaceName = currentUser?.workplace_name || 'Точка';

    let periodLabel = '';
    let targetShifts: PlannedShift[] = [];

    if (scheduleMode === 'weekly') {
      const startDay = weekDays[0];
      const endDay = weekDays[6];
      const startStr = `${String(startDay.dayNum).padStart(2, '0')}.${String(startDay.fullDate.getMonth() + 1).padStart(2, '0')}.${startDay.fullDate.getFullYear()}`;
      const endStr = `${String(endDay.dayNum).padStart(2, '0')}.${String(endDay.fullDate.getMonth() + 1).padStart(2, '0')}.${endDay.fullDate.getFullYear()}`;
      periodLabel = `${startStr} – ${endStr} (Текущая неделя)`;

      const viewingDates = new Set(weekDays.map((w) => w.dateStr));
      targetShifts = plannedShifts.filter(
        (s) => (s.schedule_type === 'weekly' || !s.schedule_type) && viewingDates.has(s.date) && !s.is_day_off
      );
    } else {
      periodLabel = `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()} (Текущий месяц)`;
      targetShifts = plannedShifts.filter(
        (s) => s.schedule_type === 'fixed' && s.date.startsWith(currentMonthStr) && !s.is_day_off
      );
    }

    // Sort shifts: date ASC, then start_time ASC, then employee name
    targetShifts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time);
      const memA = teamMembers.find((m) => m.id === a.user_id || (m.username && m.username.toLowerCase() === (a.user_name || '').toLowerCase()));
      const memB = teamMembers.find((m) => m.id === b.user_id || (m.username && m.username.toLowerCase() === (b.user_name || '').toLowerCase()));
      const nameA = memA?.name || a.user_name || '';
      const nameB = memB?.name || b.user_name || '';
      return nameA.localeCompare(nameB);
    });

    const RUSSIAN_DAY_OF_WEEK = [
      'Воскресенье',
      'Понедельник',
      'Вторник',
      'Среда',
      'Четверг',
      'Пятница',
      'Суббота',
    ];

    const getDayOfWeekName = (dateStr: string) => {
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        return RUSSIAN_DAY_OF_WEEK[dt.getDay()] || '';
      }
      return '';
    };

    const formatRuDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
      return dateStr;
    };

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '';
      const str = String(val).trim();
      if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let totalPlannedHours = 0;
    const csvDataRows: string[] = [];
    const excelRowsData: any[][] = [];

    targetShifts.forEach((s) => {
      const member = teamMembers.find(
        (m) => m.id === s.user_id || (m.username && m.username.toLowerCase() === (s.user_id || '').toLowerCase()) || (m.username && m.username.toLowerCase() === (s.user_name || '').toLowerCase())
      );
      const isCurrent = !!(currentUser && (currentUser.id === s.user_id || currentUser.username === s.user_id || currentUser.username === s.user_name));

      const employeeName = member?.name || (isCurrent ? currentUser?.name : undefined) || s.user_name || 'Сотрудник';
      const roleTitle = member?.role_title || (isCurrent ? currentUser?.role_title : undefined) || s.role_title || 'Сотрудник';
      const timeRange = `${s.start_time || '12:00'} – ${s.end_time || '00:00'}`;

      let hours = s.hours_worked;
      if (hours === undefined || hours === null) {
        const [sH = 0, sM = 0] = (s.start_time || '12:00').split(':').map(Number);
        let [eH = 0, eM = 0] = (s.end_time || '00:00').split(':').map(Number);
        let startMin = sH * 60 + sM;
        let endMin = eH * 60 + eM;
        if (endMin <= startMin) endMin += 24 * 60;
        hours = Math.round(((endMin - startMin) / 60) * 10) / 10;
      }

      totalPlannedHours += hours;
      const roundedHours = Math.round(hours * 10) / 10;
      const formattedHours = String(roundedHours).replace('.', ',');
      const dateFormatted = formatRuDate(s.date);
      const dayName = getDayOfWeekName(s.date);

      // CSV row
      csvDataRows.push(
        [
          escapeCsv(dateFormatted),
          escapeCsv(dayName),
          escapeCsv(employeeName),
          escapeCsv(roleTitle),
          escapeCsv(timeRange),
          escapeCsv(formattedHours),
        ].join(';')
      );

      // Binary Excel row (stores hours as numeric float so Excel formulas work)
      excelRowsData.push([
        dateFormatted,
        dayName,
        employeeName,
        roleTitle,
        timeRange,
        roundedHours,
      ]);
    });

    const roundedTotalHours = Math.round(totalPlannedHours * 10) / 10;
    const formattedTotalHours = String(roundedTotalHours).replace('.', ',');
    const safeCode = workplaceCode.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const safePeriod =
      scheduleMode === 'weekly'
        ? `nedelya_${weekDays[0].dateStr}_${weekDays[6].dateStr}`
        : `mesyac_${currentMonthStr}`;

    if (exportFormat === 'csv') {
      // Standard CSV format with UTF-8 BOM
      const csvLines: string[] = [
        'График смен команды',
        `Код точки:;${escapeCsv(workplaceCode)}`,
        `Точка:;${escapeCsv(workplaceName)}`,
        `Период:;${escapeCsv(periodLabel)}`,
        '',
        'Дата;День недели;Сотрудник;Должность;Время смены (начало – конец);Часов по плану',
        ...csvDataRows,
        `Итого часов по плану;;;;;${escapeCsv(formattedTotalHours)}`,
      ];

      const csvContent = csvLines.join('\r\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grafik_komandy_${safeCode}_${safePeriod}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Genuine OpenXML binary .xlsx workbook created with SheetJS
      const wb = XLSX.utils.book_new();

      const wsAoa: any[][] = [
        ['График смен команды — ЧасПик', '', '', '', '', ''],
        ['Код точки:', workplaceCode, '', '', '', ''],
        ['Точка:', workplaceName, '', '', '', ''],
        ['Период:', periodLabel, '', '', '', ''],
        [],
        ['Дата', 'День недели', 'Сотрудник', 'Должность', 'Время смены (начало – конец)', 'Часов по плану'],
        ...excelRowsData,
        ['Итого часов по плану:', '', '', '', '', roundedTotalHours],
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsAoa);

      // Set explicit column widths for perfect readability in all office suites
      ws['!cols'] = [
        { wch: 14 }, // Дата
        { wch: 16 }, // День недели
        { wch: 26 }, // Сотрудник
        { wch: 22 }, // Должность
        { wch: 22 }, // Время смены
        { wch: 16 }, // Часов по плану
      ];

      // Merge header title and total label
      const totalRowIdx = wsAoa.length - 1;
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 4 } },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'График смен');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `grafik_komandy_${safeCode}_${safePeriod}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    setExportToast(true);
    setTimeout(() => setExportToast(false), 3000);
  };

  const handleGeneratePatternSubmit = async () => {
    if (!onGeneratePattern) return;
    try {
      setIsGenerating(true);
      triggerHaptic('medium');
      await onGeneratePattern({
        target_user_id: patternUserId,
        pattern: selectedPattern,
        start_date: patternStartDate,
        day_in_cycle: dayInCycle,
        target_month: currentMonthStr,
        start_time: '12:00',
        end_time: '00:00',
      });
      confetti({
        particleCount: 35,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetMonthGrid = async () => {
    if (!onResetPattern) return;
    try {
      setIsResetting(true);
      triggerHaptic('warning');
      await onResetPattern({ month: currentMonthStr });
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  const getCycleOptions = () => {
    if (selectedPattern === '2/2') {
      return [
        { value: 1, label: '1-й день смены' },
        { value: 2, label: '2-й день смены' },
        { value: 3, label: '1-й день отдыха' },
        { value: 4, label: '2-й день отдыха' },
      ];
    }
    if (selectedPattern === '3/3') {
      return [
        { value: 1, label: '1-й день смены' },
        { value: 2, label: '2-й день смены' },
        { value: 3, label: '3-й день смены' },
        { value: 4, label: '1-й день отдыха' },
        { value: 5, label: '2-й день отдыха' },
        { value: 6, label: '3-й день отдыха' },
      ];
    }
    return [
      { value: 1, label: 'С понедельника по пятницу' }
    ];
  };

  const selectedMonthDayShifts = selectedMonthDate
    ? fixedShiftsByDate.get(selectedMonthDate) || []
    : [];

  return (
    <div className="px-4 py-3 pb-24 space-y-4">
      {/* Header */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white font-sans flex items-center gap-1.5">
              <span>👥 Команда и график</span>
            </h2>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
              ПЛАН
            </span>
          </div>

          {currentUser?.workplace_name && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300">
              {currentUser.workplace_name}
            </span>
          )}
        </div>

        {/* Download Team Schedule Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportTeamSchedule('excel')}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>📥 Скачать график команды (Excel)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportTeamSchedule('csv')}
            title="Выгрузить в формате CSV (текстовый табель)"
            className="py-2.5 px-3 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 active:scale-[0.99] text-gray-700 dark:text-gray-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-gray-200 dark:border-neutral-700"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>

        {/* Export Toast Notification */}
        {exportToast && (
          <div className="p-2.5 rounded-xl bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4" />
            <span>📥 График команды успешно выгружен!</span>
          </div>
        )}
      </div>

      {/* Major Mode Switcher Bar */}
      <div className="bg-gray-200 dark:bg-neutral-800 p-1 rounded-2xl flex text-xs font-extrabold shadow-inner">
        <button
          onClick={() => handleModeChange('weekly')}
          className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            scheduleMode === 'weekly'
              ? 'bg-blue-600 text-white shadow-md scale-[1.01]'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>🗓 Недельный график</span>
        </button>

        <button
          onClick={() => handleModeChange('fixed')}
          className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            scheduleMode === 'fixed'
              ? 'bg-blue-600 text-white shadow-md scale-[1.01]'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>📌 Фиксированная сетка</span>
        </button>
      </div>

      {/* Workplace Invite Code Banner */}
      {currentUser?.workplace_code && (
        <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50 flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-teal-900 dark:text-teal-200">
              {currentUser.workplace_name || 'Ваша точка'}
            </div>
            <div className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5">
              Код для коллег: <b className="font-mono">{currentUser.workplace_code}</b>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              navigator.clipboard.writeText(
                `Подключайся к нашей точке в ЧасПик!\nКод точки: ${currentUser.workplace_code}`
              );
            }}
            className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-[11px] transition shadow-xs cursor-pointer"
          >
            Скопировать код
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: WEEKLY LIST VIEW */}
      {/* ========================================================================= */}
      {scheduleMode === 'weekly' ? (
        <div key="schedule-weekly-view" className="space-y-4">
          {/* Planned Income Summary Banner (Weekly) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs text-blue-800 dark:text-blue-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                План зарплаты за эту неделю:
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                {userWeekPlannedHours}ч работы по графику
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                ~ {userWeekPlannedEarnings.toLocaleString('ru-RU')} ₽
              </span>
              <span className="text-[10px] text-blue-500 block font-medium">
                (Не влияет на баланс)
              </span>
            </div>
          </div>

          {/* Toast Notification when Weekly schedule approved */}
          {approvedToast && (
            <div className="p-3 rounded-xl bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4" />
              <span>✅ График на неделю успешно сохранен и утвержден!</span>
            </div>
          )}

          {/* Week Pager */}
          <div className="flex items-center justify-between bg-white dark:bg-neutral-900 px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
            <button
              onClick={() => {
                triggerHaptic('light');
                setWeekOffset((prev) => prev - 1);
              }}
              className="p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100 font-sans">
                {rangeStart} – {rangeEnd}
              </div>
              <div className="text-[11px] text-gray-400">
                {weekOffset === 0 ? 'Текущая неделя' : weekOffset > 0 ? `+${weekOffset} нед.` : `${weekOffset} нед.`}
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setWeekOffset((prev) => prev + 1);
              }}
              className="p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Cards list */}
          <div className="space-y-3">
            {weekDays.map((day) => {
              const dayPlannedShifts = activeWeeklyShifts.filter(
                (s) => s.date === day.dateStr && !s.is_day_off
              );
              const hasSwapSeeking = dayPlannedShifts.some((s) => s.swap_status === 'seeking_swap');
              const isCurrentUserWorking = dayPlannedShifts.some((s) => s.user_id === currentUser?.id);

              return (
                <div
                  key={day.dateStr}
                  className={`rounded-2xl p-4 border transition-all ${
                    hasSwapSeeking
                      ? 'bg-amber-950/20 border-amber-500/50 dark:bg-amber-950/30'
                      : 'bg-white dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-neutral-800/60 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100 font-sans">
                        {day.dayName}, {day.dayNum}
                      </span>
                      {isCurrentUserWorking && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          Моя смена в плане
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(day.dateStr)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить
                    </button>
                  </div>

                  {dayPlannedShifts.length > 0 ? (
                    <div className="space-y-2">
                      {dayPlannedShifts.map((shift) => {
                        const isOwn = shift.user_id === currentUser?.id;
                        const isSwap = shift.swap_status === 'seeking_swap';

                        return (
                          <div
                            key={shift.id}
                            className={`p-2.5 rounded-xl transition cursor-pointer ${
                              isSwap
                                ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60'
                                : isOwn
                                ? 'bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40'
                                : 'bg-gray-50 dark:bg-neutral-800/50'
                            }`}
                            onClick={() => handleOpenAddModal(day.dateStr, shift)}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-base">👤</span>
                                <div>
                                  <span className="font-bold text-gray-900 dark:text-gray-100">
                                    {shift.user_name || 'Сотрудник'}
                                  </span>
                                  <span className="text-gray-400 ml-1">
                                    ({shift.role_title || 'Смена'}):
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold block">
                                  {shift.start_time} – {shift.end_time}
                                </span>
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                  ~ {(shift.planned_earned || Math.round((shift.hours_worked || 0) * ((shift.user_id === currentUser?.id ? currentUser?.hourly_rate : shift.hourly_rate) || currentUser?.hourly_rate || 350))).toLocaleString('ru-RU')} ₽
                                </span>
                              </div>
                            </div>

                            {isSwap && (
                              <div
                                className="mt-2.5 pt-2 border-t border-amber-200 dark:border-amber-800/60"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300 mb-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">🔄 Нужна замена / Отдать смену</span>
                                    {shift.swap_note && (
                                      <div className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                                        «{shift.swap_note}»
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {isOwn ? (
                                  <button
                                    onClick={() => {
                                      triggerHaptic('light');
                                      onCancelSwap(shift.id);
                                    }}
                                    className="w-full py-1.5 text-xs font-semibold rounded-lg bg-neutral-200 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 hover:bg-neutral-300 transition"
                                  >
                                    ❌ Отозвать свой запрос на бирже
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleTakeSwap(shift.id)}
                                    disabled={isSwapping === shift.id}
                                    className="w-full py-2 text-xs font-extrabold rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-black shadow flex items-center justify-center gap-1.5 transition"
                                  >
                                    <Handshake className="w-4 h-4" />
                                    <span>{isSwapping === shift.id ? 'Забираем...' : '🤝 Забрать смену себе'}</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {isOwn && !isSwap && (
                              <div
                                className="mt-2 pt-1 flex justify-end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    triggerHaptic('light');
                                    onRequestSwap(shift.id, 'Ищу замену на эту смену');
                                  }}
                                  className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                                >
                                  <Repeat className="w-3 h-3" /> Отдать на биржу
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-gray-400">
                      Выходной день точки / нет запланированных смен
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Prominent Approve / Save Weekly Schedule Button */}
          <div className="pt-2 space-y-2">
            <button
              onClick={handleApproveWeeklySchedule}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>💾 Сохранить и утвердить график на неделю</span>
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: FIXED MONTH CALENDAR GRID */
        /* ========================================================================= */
        <div key="schedule-fixed-view" className="space-y-4">
          {/* Planned Income Summary Banner (Fixed View) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex items-center justify-between shadow-xs">
            <div>
              <div className="text-xs text-blue-800 dark:text-blue-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                План зарплаты за {MONTH_NAMES[gridMonth].toLowerCase()}:
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                {userMonthPlannedShiftsCount} смен ({userMonthPlannedHours}ч работы по сетке)
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                ~ {userMonthPlannedEarnings.toLocaleString('ru-RU')} ₽
              </span>
              <span className="text-[10px] text-blue-500 block font-medium">
                (Предварительный расчет)
              </span>
            </div>
          </div>

          {/* Pattern Generator Panel */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                  Авто-генератор цикличного графика
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetMonthGrid}
                disabled={isResetting}
                className="px-2 py-1 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition"
                title="Сбросить все смены за текущий месяц"
              >
                <Trash2 className="w-3 h-3" />
                <span>{isResetting ? 'Сброс...' : 'Сбросить сетку за месяц'}</span>
              </button>
            </div>

            {/* Pattern Template Buttons */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                Шаблон циклической сетки:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['2/2', '3/3', '5/2'] as FixedPattern[]).map((pat) => (
                  <button
                    key={pat}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedPattern(pat);
                      setDayInCycle(1);
                    }}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      selectedPattern === pat
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-neutral-700 hover:bg-gray-100'
                    }`}
                  >
                    {pat}
                  </button>
                ))}
              </div>
            </div>

            {/* Employee Selection */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
                Сотрудник для заполнения:
              </label>
              <select
                value={patternUserId}
                onChange={(e) => setPatternUserId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-2.5 text-xs font-semibold text-gray-800 dark:text-gray-200"
              >
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.id === currentUser?.id ? '(Вы)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Cycle phase inputs */}
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/40 space-y-2">
              <div className="text-xs font-extrabold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>📌 Выберите первый день и фазу цикла:</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block mb-1">
                    Начальная дата (любая дата):
                  </label>
                  <input
                    type="date"
                    value={patternStartDate}
                    onChange={(e) => setPatternStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-neutral-700 rounded-xl p-2 font-mono font-bold text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>

                {selectedPattern !== '5/2' && (
                  <div>
                    <label className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block mb-1">
                      Какой это день по счёту в цикле?
                    </label>
                    <select
                      value={dayInCycle}
                      onChange={(e) => setDayInCycle(Number(e.target.value))}
                      className="w-full bg-white dark:bg-neutral-800 border border-blue-300 dark:border-neutral-700 rounded-xl p-2 font-semibold text-gray-900 dark:text-gray-100 text-xs"
                    >
                      {getCycleOptions().map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Generator Button */}
            <button
              type="button"
              onClick={handleGeneratePatternSubmit}
              disabled={isGenerating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>
                {isGenerating
                  ? 'Заполнение сетки...'
                  : `⚡ Заполнить сетку ${selectedPattern} на весь месяц`}
              </span>
            </button>
          </div>

          {/* Month Calendar Grid Title & Month Pager */}
          <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm">
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              🗓 Сетка на {MONTH_NAMES[gridMonth]} {gridYear}
            </span>

            <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-0.5">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setMonthDate(new Date(gridYear, gridMonth - 1, 1));
                }}
                className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2 text-gray-800 dark:text-gray-200">
                {MONTH_NAMES[gridMonth]}
              </span>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setMonthDate(new Date(gridYear, gridMonth + 1, 1));
                }}
                className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Full Month Calendar Matrix */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-3 border border-gray-100 dark:border-neutral-800 shadow-sm">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {WEEKDAYS_HEADER.map((w, idx) => (
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
              {monthCells.map((cell, idx) => {
                const isWorkingUser = cell.dayShifts.some((s) => s.user_id === currentUser?.id && !s.is_day_off);
                const hasSwapSeeking = cell.dayShifts.some((s) => s.swap_status === 'seeking_swap');
                const activeShifts = cell.dayShifts.filter((s) => !s.is_day_off);

                return (
                  <button
                    key={`month-grid-${cell.dateStr}-${idx}`}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedMonthDate(cell.dateStr);
                    }}
                    className={`min-h-[54px] p-1 rounded-xl border flex flex-col justify-between text-left transition-all relative ${
                      hasSwapSeeking
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500/80 text-amber-900 dark:text-amber-100'
                        : isWorkingUser
                        ? 'bg-blue-500 text-white border-blue-600 shadow-sm scale-[1.02]'
                        : cell.isCurrentMonth
                        ? 'bg-gray-50 dark:bg-neutral-800/60 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700/80 text-gray-900 dark:text-gray-100'
                        : 'bg-transparent border-transparent text-gray-300 dark:text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>{cell.dayNum}</span>
                      {hasSwapSeeking ? (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 animate-pulse">🔄</span>
                      ) : activeShifts.length > 0 ? (
                        <span
                          className={`text-[9px] px-1 rounded font-mono ${
                            isWorkingUser ? 'bg-white/30 text-white' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {activeShifts.length}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {activeShifts.slice(0, 2).map((s) => (
                        <div
                          key={s.id}
                          className={`text-[9px] truncate px-1 py-0.5 rounded font-medium leading-none ${
                            s.swap_status === 'seeking_swap'
                              ? 'bg-amber-500 text-black font-extrabold'
                              : s.user_id === currentUser?.id
                              ? isWorkingUser ? 'bg-white/25 text-white font-bold' : 'bg-blue-200 text-blue-900'
                              : 'bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {s.user_name?.split(' ')[0] || 'Смена'}
                        </div>
                      ))}
                      {activeShifts.length > 2 && (
                        <div className="text-[8px] text-gray-400 text-center leading-none">
                          +{activeShifts.length - 2} ещё
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected Month Date Drawer Modal */}
      {selectedMonthDate && (
        <div key="selected-month-date-drawer" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setSelectedMonthDate(null)} />

          <div className="relative w-full max-w-md bg-neutral-900 text-white rounded-t-3xl p-5 shadow-2xl border-t border-neutral-800 z-10 space-y-3">
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div>
                <h3 className="text-base font-extrabold font-sans">
                  Смены на {new Date(selectedMonthDate).getDate()} {MONTH_NAMES[new Date(selectedMonthDate).getMonth()]}
                </h3>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {selectedMonthDate}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMonthDate(null)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedMonthDayShifts.filter((s) => !s.is_day_off).length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedMonthDayShifts.filter((s) => !s.is_day_off).map((shift) => {
                  const isOwn = shift.user_id === currentUser?.id;
                  const isSwap = shift.swap_status === 'seeking_swap';

                  return (
                    <div
                      key={shift.id}
                      className={`p-3 rounded-xl border transition ${
                        isSwap
                          ? 'bg-amber-950/40 border-amber-500/60'
                          : isOwn
                          ? 'bg-blue-950/40 border-blue-600/50'
                          : 'bg-neutral-800/60 border-neutral-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>👤 {shift.user_name || 'Сотрудник'}</span>
                          <span className="text-neutral-400 font-normal">({shift.role_title || 'Смена'})</span>
                        </div>
                        <span className="font-mono font-semibold text-blue-400">
                          {shift.start_time} – {shift.end_time}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-300">
                        <span>Планируемый доход:</span>
                        <b className="font-mono text-blue-300">
                          ~ {(shift.planned_earned || Math.round((shift.hours_worked || 0) * ((shift.user_id === currentUser?.id ? currentUser?.hourly_rate : shift.hourly_rate) || currentUser?.hourly_rate || 350))).toLocaleString('ru-RU')} ₽
                        </b>
                      </div>

                      {isSwap ? (
                        <div className="mt-2.5 pt-2 border-t border-amber-800/60">
                          <div className="text-xs text-amber-300 font-bold flex items-center gap-1 mb-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>На бирже подмен</span>
                          </div>
                          {isOwn ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await onCancelSwap(shift.id);
                                setSelectedMonthDate(null);
                              }}
                              className="w-full py-1.5 bg-neutral-800 text-amber-300 font-bold text-xs rounded-lg hover:bg-neutral-700"
                            >
                              ❌ Отозвать запрос на подмену
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                await handleTakeSwap(shift.id);
                                setSelectedMonthDate(null);
                              }}
                              className="w-full py-2 bg-amber-500 text-black font-extrabold text-xs rounded-xl hover:bg-amber-400 flex items-center justify-center gap-1"
                            >
                              <Handshake className="w-4 h-4" />
                              <span>🤝 Забрать смену себе</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMonthDate(null);
                              handleOpenAddModal(selectedMonthDate, shift);
                            }}
                            className="text-[11px] font-semibold text-blue-400 hover:underline"
                          >
                            Изменить время / редактировать
                          </button>

                          {isOwn && (
                            <button
                              type="button"
                              onClick={async () => {
                                await onRequestSwap(shift.id, 'Ищу замену на эту смену');
                                setSelectedMonthDate(null);
                              }}
                              className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                            >
                              <Repeat className="w-3 h-3" /> Отдать на биржу
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-neutral-400">
                Нет запланированных смен на этот день
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const dateStr = selectedMonthDate;
                setSelectedMonthDate(null);
                handleOpenAddModal(dateStr);
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              <span>➕ Назначить смену на этот день</span>
            </button>
          </div>
        </div>
      )}


      {/* Planned Shift Modal */}
      {modalOpen && (
        <PlannedShiftModal
          isOpen={modalOpen}
          dateStr={selectedDateForModal}
          existingPlannedShift={selectedShiftForModal}
          currentUser={currentUser}
          teamMembers={teamMembers}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveModalShift}
          onDelete={onDeletePlannedShift}
        />
      )}
    </div>
  );
};

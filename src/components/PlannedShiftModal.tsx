import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, CheckCircle2, Trash2, Calendar, User as UserIcon, Sparkles, Clock, DollarSign, Percent, Zap } from 'lucide-react';
import { PlannedShift, User, ScheduleMode, RateType } from '../types';
import { triggerHaptic } from '../lib/telegram';
import { normalizeRateType } from '../services/supabaseService';

interface PlannedShiftModalProps {
  isOpen: boolean;
  dateStr: string; // YYYY-MM-DD
  existingPlannedShift?: PlannedShift;
  initialUserId?: string;
  currentUser: User | null;
  teamMembers: User[];
  onClose: () => void;
  onSave: (data: {
    date: string;
    target_user_id: string;
    is_day_off: number;
    start_time: string;
    end_time: string;
    comment?: string;
    schedule_type?: ScheduleMode;
    hourly_rate?: number;
    shift_flat_rate?: number;
    sales_percent?: number;
    rate_type?: RateType;
    planned_earned?: number;
  }) => Promise<void>;
  onDelete?: (shiftId: string) => Promise<void>;
}

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export const PlannedShiftModal: React.FC<PlannedShiftModalProps> = ({
  isOpen,
  dateStr,
  existingPlannedShift,
  initialUserId,
  currentUser,
  teamMembers,
  onClose,
  onSave,
  onDelete,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    return existingPlannedShift?.user_id || initialUserId || currentUser?.id || (teamMembers[0]?.id ?? '');
  });
  const [isDayOff, setIsDayOff] = useState<boolean>(
    existingPlannedShift?.is_day_off === 1
  );
  const [startTime, setStartTime] = useState<string>(
    existingPlannedShift?.start_time || '12:00'
  );
  const [endTime, setEndTime] = useState<string>(
    existingPlannedShift?.end_time || '00:00'
  );
  const [comment, setComment] = useState<string>(
    existingPlannedShift?.comment || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  // Rate parameters state
  const [rateType, setRateType] = useState<RateType>('hourly');
  const [hourlyRate, setHourlyRate] = useState<number>(350);
  const [shiftFlatRate, setShiftFlatRate] = useState<number>(1700);
  const [salesPercent, setSalesPercent] = useState<number>(3);
  const [plannedSales, setPlannedSales] = useState<number>(0);
  const [isRateOverridden, setIsRateOverridden] = useState<boolean>(false);

  // Helper to find employee object across teamMembers and currentUser
  const findUserObj = (uid: string): User | null => {
    if (!uid) return currentUser;
    if (currentUser && (currentUser.id === uid || currentUser.username === uid || currentUser.tg_id === uid)) {
      return currentUser;
    }
    const found = teamMembers.find((u) => u.id === uid || u.username === uid || u.tg_id === uid);
    return found || currentUser;
  };

  // Helper to extract rates from user and existing shift
  const extractRates = (user: User | null, shift?: PlannedShift) => {
    if (shift) {
      const rawType = shift.default_rate_type || shift.rate_type || (user as any)?.payment_type || user?.default_rate_type || 'hourly';
      const resolvedType = normalizeRateType(rawType);
      const resolvedHourly = shift.hourly_rate !== undefined && shift.hourly_rate !== null
        ? Number(shift.hourly_rate)
        : Number(user?.hourly_rate ?? 350);

      const candidateFlat = shift.shift_flat_rate !== undefined && shift.shift_flat_rate !== null
        ? Number(shift.shift_flat_rate)
        : Number((user as any)?.fixed_rate ?? user?.shift_flat_rate ?? 0);
      const resolvedFlat = candidateFlat > 0 ? candidateFlat : (resolvedType === 'fixed_shift' ? 1700 : 0);

      const resolvedPercent = shift.sales_percent !== undefined && shift.sales_percent !== null
        ? Number(shift.sales_percent)
        : Number(user?.sales_percent ?? 3);

      return {
        resolvedType,
        resolvedHourly: Math.max(0, resolvedHourly),
        resolvedFlat: Math.max(0, resolvedFlat),
        resolvedPercent: Math.max(0, resolvedPercent),
      };
    }

    // New shift: strictly pull rates from the employee profile
    const rawType = (user as any)?.payment_type || user?.default_rate_type || 'hourly';
    const resolvedType = normalizeRateType(rawType);
    const resolvedHourly = user?.hourly_rate !== undefined && user?.hourly_rate !== null
      ? Number(user.hourly_rate)
      : 350;

    const candidateFlat = (user as any)?.fixed_rate !== undefined && (user as any)?.fixed_rate !== null && Number((user as any)?.fixed_rate) > 0
      ? Number((user as any).fixed_rate)
      : (user?.shift_flat_rate !== undefined && user?.shift_flat_rate !== null && Number(user.shift_flat_rate) > 0
        ? Number(user.shift_flat_rate)
        : (resolvedType === 'fixed_shift' ? 1700 : 0));

    const resolvedPercent = user?.sales_percent !== undefined && user?.sales_percent !== null
      ? Number(user.sales_percent)
      : 3;

    return {
      resolvedType,
      resolvedHourly: Math.max(0, resolvedHourly),
      resolvedFlat: Math.max(0, candidateFlat),
      resolvedPercent: Math.max(0, resolvedPercent),
    };
  };

  // Sync state whenever modal opens or shift/date/user changes
  useEffect(() => {
    if (!isOpen) return;

    if (existingPlannedShift) {
      setSelectedUserId(existingPlannedShift.user_id);
      setIsDayOff(existingPlannedShift.is_day_off === 1);
      setStartTime(existingPlannedShift.start_time || '12:00');
      setEndTime(existingPlannedShift.end_time || '00:00');
      setComment(existingPlannedShift.comment || '');

      const userObj = findUserObj(existingPlannedShift.user_id);
      const rates = extractRates(userObj, existingPlannedShift);
      setRateType(rates.resolvedType);
      setHourlyRate(rates.resolvedHourly);
      setShiftFlatRate(rates.resolvedFlat);
      setSalesPercent(rates.resolvedPercent);
      setIsRateOverridden(false);
    } else {
      const targetId = initialUserId || currentUser?.id || (teamMembers[0]?.id ?? '');
      setSelectedUserId(targetId);
      setIsDayOff(false);
      setStartTime('12:00');
      setEndTime('00:00');
      setComment('');

      const userObj = findUserObj(targetId);
      const rates = extractRates(userObj);
      setRateType(rates.resolvedType);
      setHourlyRate(rates.resolvedHourly);
      setShiftFlatRate(rates.resolvedFlat);
      setSalesPercent(rates.resolvedPercent);
      setPlannedSales(0);
      setIsRateOverridden(false);
    }
  }, [isOpen, existingPlannedShift, dateStr, initialUserId, currentUser?.id, teamMembers]);

  // Synchronize rates automatically whenever the selected employee changes
  const handleUserChange = (newUserId: string) => {
    setSelectedUserId(newUserId);
    const userObj = findUserObj(newUserId);
    const rates = extractRates(userObj);
    setRateType(rates.resolvedType);
    setHourlyRate(rates.resolvedHourly);
    setShiftFlatRate(rates.resolvedFlat);
    setSalesPercent(rates.resolvedPercent);
    setIsRateOverridden(false);
  };

  // Reset rates to current employee's profile
  const handleResetToProfile = () => {
    triggerHaptic('light');
    const userObj = findUserObj(selectedUserId);
    const rates = extractRates(userObj);
    setRateType(rates.resolvedType);
    setHourlyRate(rates.resolvedHourly);
    setShiftFlatRate(rates.resolvedFlat);
    setSalesPercent(rates.resolvedPercent);
    setIsRateOverridden(false);
  };

  const isSelectedCurrentUser = !selectedUserId || selectedUserId === currentUser?.id;
  const targetUser = findUserObj(selectedUserId);
  const targetUserName = isSelectedCurrentUser ? 'Вы' : (targetUser?.name || 'Сотрудник');

  const [pY, pM, pD] = dateStr.split('-').map(Number);
  const dayNumber = pD || 1;
  const monthName = MONTH_NAMES_GENITIVE[(pM || 1) - 1] || '';

  const calculateDuration = (start: string, end: string): number => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let sMin = sH * 60 + (sM || 0);
    let eMin = eH * 60 + (eM || 0);
    if (eMin <= sMin) {
      eMin += 24 * 60;
    }
    return Number(((eMin - sMin) / 60).toFixed(1));
  };

  const hoursWorked = isDayOff ? 0 : calculateDuration(startTime, endTime);

  // Calculate estimated planned earnings based on employee payment_type / rateType
  let estimatedEarned = 0;
  if (!isDayOff) {
    if (rateType === 'hourly') {
      estimatedEarned = Math.round(hoursWorked * hourlyRate);
    } else if (rateType === 'fixed_shift') {
      // Оклад за выход: фиксированная сумма оклада за смену независимо от отработанных часов
      estimatedEarned = Math.round(shiftFlatRate);
    } else if (rateType === 'combined') {
      // Комбинированная: часы * ставка + оклад за смену (+ процент от продаж при наличии)
      const hourlyPart = hoursWorked * hourlyRate;
      const percentPart = plannedSales > 0 ? (plannedSales * salesPercent) / 100 : 0;
      estimatedEarned = Math.round(hourlyPart + shiftFlatRate + percentPart);
    } else if (rateType === 'percent') {
      // % от продаж
      estimatedEarned = plannedSales > 0 ? Math.round((plannedSales * salesPercent) / 100) : 0;
    }
  }

  const adjustTime = (current: string, deltaMinutes: number): string => {
    const [h, m] = current.split(':').map(Number);
    let totalMinutes = h * 60 + (m || 0) + deltaMinutes;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    totalMinutes = totalMinutes % (24 * 60);
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      triggerHaptic('medium');

      // If user adjusted rate here for themselves, also sync with profile rate settings
      if (isSelectedCurrentUser && currentUser && hourlyRate !== currentUser.hourly_rate) {
        try {
          await fetch('/api/user/rate-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-telegram-user-id': currentUser.tg_id,
            },
            body: JSON.stringify({
              hourly_rate: hourlyRate,
              shift_flat_rate: shiftFlatRate,
              default_rate_type: rateType,
              sales_percent: salesPercent,
            }),
          });
        } catch (e) {
          console.warn('Sync rate settings note:', e);
        }
      }

      await onSave({
        date: dateStr,
        target_user_id: selectedUserId,
        is_day_off: isDayOff ? 1 : 0,
        start_time: startTime,
        end_time: endTime,
        comment,
        hourly_rate: hourlyRate,
        shift_flat_rate: shiftFlatRate,
        sales_percent: salesPercent,
        rate_type: rateType,
        planned_earned: estimatedEarned,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-neutral-900 text-gray-100 rounded-t-3xl p-5 shadow-2xl border-t border-neutral-800 z-10 animate-in slide-in-from-bottom duration-250">
        <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white font-sans">
                {existingPlannedShift ? 'Редактировать смену в плане' : 'Добавить смену в план'}
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">
                ПЛАН
              </span>
            </div>
            <div className="text-xs font-semibold text-blue-400 mt-0.5">
              {dayNumber} {monthName}
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Selection */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-neutral-400 block mb-1.5">
            Сотрудник:
          </label>
          <div className="relative">
            <select
              value={selectedUserId}
              onChange={(e) => {
                triggerHaptic('light');
                handleUserChange(e.target.value);
              }}
              className="w-full bg-neutral-800 text-white text-xs font-semibold p-3 rounded-xl border border-neutral-700 appearance-none focus:outline-none focus:border-blue-500"
            >
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role_title || 'Сотрудник'}) {m.id === currentUser?.id ? '— (Вы)' : ''}
                </option>
              ))}
            </select>
            <UserIcon className="w-4 h-4 text-neutral-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* Day off vs Shift Toggle */}
        <div className="mt-4 flex bg-neutral-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsDayOff(false);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              !isDayOff ? 'bg-blue-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            📋 Рабочая смена
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsDayOff(true);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              isDayOff ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            🏖 Выходной
          </button>
        </div>

        {!isDayOff ? (
          <div className="mt-4 space-y-4">
            {/* Arrival / Departure */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-800/80 p-3 rounded-2xl border border-neutral-700/60">
                <span className="text-xs text-neutral-400 font-semibold block mb-2 text-center">
                  Начало
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStartTime((prev) => adjustTime(prev, -30));
                    }}
                    className="w-8 h-8 rounded-lg bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-200 active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-bold font-mono tracking-tight text-white">
                    {startTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStartTime((prev) => adjustTime(prev, 30));
                    }}
                    className="w-8 h-8 rounded-lg bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-200 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-neutral-800/80 p-3 rounded-2xl border border-neutral-700/60">
                <span className="text-xs text-neutral-400 font-semibold block mb-2 text-center">
                  Конец
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setEndTime((prev) => adjustTime(prev, -30));
                    }}
                    className="w-8 h-8 rounded-lg bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-200 active:scale-95 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-bold font-mono tracking-tight text-white">
                    {endTime}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setEndTime((prev) => adjustTime(prev, 30));
                    }}
                    className="w-8 h-8 rounded-lg bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-200 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Duration and Night shift note */}
            <div className="text-center text-xs text-neutral-400">
              Длительность: <span className="font-bold text-white">{hoursWorked} ч</span>
              {startTime >= '18:00' || endTime <= '06:00' ? (
                <span className="text-amber-400 ml-1.5 font-semibold">🌙 ночная смена</span>
              ) : null}
            </div>

            {/* Calculated planned earnings preview */}
            <div className="p-3.5 bg-blue-950/40 rounded-2xl border border-blue-800/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Расчетный доход по плану:</span>
                </span>
                <span className="text-base font-extrabold text-blue-400 font-mono">
                  ~ {estimatedEarned.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              {/* Profile Rate Source Indicator & Reset */}
              <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-blue-900/30 border border-blue-700/40 text-blue-200">
                <span className="flex items-center gap-1.5 font-medium truncate mr-2">
                  <span className={`w-2 h-2 rounded-full ${isRateOverridden ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="truncate">
                    {isRateOverridden ? (
                      <span className="text-amber-300 font-semibold">⚡ Ставка изменена для этой смены</span>
                    ) : (
                      <span>
                        🟢 Ставка из профиля: <b className="text-white font-semibold">{targetUserName}</b>
                      </span>
                    )}
                  </span>
                </span>
                {isRateOverridden && (
                  <button
                    type="button"
                    onClick={handleResetToProfile}
                    className="text-[10px] text-blue-300 hover:text-white underline font-semibold flex-shrink-0 cursor-pointer"
                    title="Восстановить настройки ставки из профиля сотрудника"
                  >
                    Сбросить к профилю
                  </button>
                )}
              </div>

              {/* Rate type chips selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRateType('hourly');
                    setIsRateOverridden(true);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rateType === 'hourly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Почасовая</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRateType('fixed_shift');
                    setIsRateOverridden(true);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rateType === 'fixed_shift'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>Оклад за выход</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRateType('combined');
                    setIsRateOverridden(true);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rateType === 'combined'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>Комбинированная</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRateType('percent');
                    setIsRateOverridden(true);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rateType === 'percent'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Percent className="w-3 h-3" />
                  <span>% от продаж</span>
                </button>
              </div>

              {/* Exact Formula Explanation Hint */}
              <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-blue-900/40 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white font-mono">
                    {rateType === 'hourly' && `${hoursWorked}ч × ${hourlyRate} ₽/ч`}
                    {rateType === 'fixed_shift' && `Фиксированный оклад за смену: ${shiftFlatRate.toLocaleString('ru-RU')} ₽`}
                    {rateType === 'combined' && `${hoursWorked}ч × ${hourlyRate} ₽/ч + оклад ${shiftFlatRate.toLocaleString('ru-RU')} ₽`}
                    {rateType === 'percent' && `${salesPercent}% от продаж`}
                  </span>
                  {!isRateOverridden && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                      по умолчанию из профиля
                    </span>
                  )}
                </div>

                {/* Additional descriptive note for fixed shift and combined */}
                {rateType === 'fixed_shift' && (
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Оклад фиксирован и не зависит от отработанных часов (длительность {hoursWorked} ч).
                  </div>
                )}
                {rateType === 'combined' && (
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Суммируется оплата за {hoursWorked} ч ({hoursWorked * hourlyRate} ₽) и фиксированный выход ({shiftFlatRate} ₽).
                  </div>
                )}
                {rateType === 'percent' && (
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Доход рассчитывается как {salesPercent}% от суммы продаж за смену.
                  </div>
                )}
              </div>

              {/* Editable Rate Inputs */}
              <div className="flex items-center justify-between text-[11px] text-blue-300/80 pt-1.5 border-t border-blue-800/30 flex-wrap gap-2">
                <span className="text-neutral-400 text-xs font-medium">Параметры ставки:</span>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Hourly Rate Input (for hourly and combined) */}
                  {(rateType === 'hourly' || rateType === 'combined') && (
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400 text-[10px]">Час:</span>
                      <input
                        type="number"
                        value={hourlyRate}
                        onChange={(e) => {
                          setHourlyRate(Math.max(0, Number(e.target.value)));
                          setIsRateOverridden(true);
                        }}
                        className="w-16 bg-neutral-900 border border-blue-500/40 text-blue-300 font-mono text-center rounded-lg px-1 py-0.5 text-xs font-bold focus:outline-none focus:border-blue-400"
                        title="Почасовая ставка"
                      />
                      <span className="text-[10px] text-neutral-400">₽/ч</span>
                    </div>
                  )}

                  {/* Shift Flat Rate Input (for fixed_shift and combined) */}
                  {(rateType === 'fixed_shift' || rateType === 'combined') && (
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400 text-[10px]">Оклад:</span>
                      <input
                        type="number"
                        value={shiftFlatRate}
                        onChange={(e) => {
                          setShiftFlatRate(Math.max(0, Number(e.target.value)));
                          setIsRateOverridden(true);
                        }}
                        className="w-20 bg-neutral-900 border border-blue-500/40 text-blue-300 font-mono text-center rounded-lg px-1 py-0.5 text-xs font-bold focus:outline-none focus:border-blue-400"
                        title="Фиксированный оклад за смену (выход)"
                      />
                      <span className="text-[10px] text-neutral-400">₽</span>
                    </div>
                  )}

                  {/* Percent Input (for percent and combined) */}
                  {(rateType === 'percent' || rateType === 'combined') && (
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400 text-[10px]">% от кассы:</span>
                      <input
                        type="number"
                        value={salesPercent}
                        onChange={(e) => {
                          setSalesPercent(Math.max(0, Number(e.target.value)));
                          setIsRateOverridden(true);
                        }}
                        className="w-12 bg-neutral-900 border border-blue-500/40 text-blue-300 font-mono text-center rounded-lg px-1 py-0.5 text-xs font-bold focus:outline-none focus:border-blue-400"
                        title="Процент от продаж"
                      />
                      <span className="text-[10px] text-neutral-400">%</span>
                    </div>
                  )}

                  {/* Optional planned sales input for percent-based calculation */}
                  {rateType === 'percent' && (
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400 text-[10px]">План кассы:</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={plannedSales || ''}
                        onChange={(e) => setPlannedSales(Math.max(0, Number(e.target.value)))}
                        className="w-20 bg-neutral-900 border border-blue-500/40 text-blue-300 font-mono text-center rounded-lg px-1 py-0.5 text-xs font-bold focus:outline-none focus:border-blue-400"
                        title="Ориентировочная касса смены для расчета"
                      />
                      <span className="text-[10px] text-neutral-400">₽</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="text-xs text-neutral-400 font-semibold block mb-1">
                Заметка или комментарий:
              </label>
              <input
                type="text"
                placeholder="Например: Утренняя смена, подготовка зала"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl p-2.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        ) : (
          <div className="my-6 text-center p-4 bg-neutral-800/40 rounded-2xl border border-neutral-700/40">
            <div className="text-2xl mb-1">🏖</div>
            <div className="text-xs font-bold text-neutral-200">Планируемый выходной</div>
          </div>
        )}

        {/* Submit button */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSaving ? 'Сохранение...' : '💾 Сохранить в График'}</span>
          </button>

          {existingPlannedShift && onDelete && (
            <button
              type="button"
              onClick={async () => {
                triggerHaptic('warning');
                await onDelete(existingPlannedShift.id);
                onClose();
              }}
              className="w-full py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Удалить из плана
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

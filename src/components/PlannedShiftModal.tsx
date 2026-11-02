import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, CheckCircle2, Trash2, Calendar, User as UserIcon, Sparkles } from 'lucide-react';
import { PlannedShift, User, ScheduleMode } from '../types';
import { triggerHaptic } from '../lib/telegram';

interface PlannedShiftModalProps {
  isOpen: boolean;
  dateStr: string; // YYYY-MM-DD
  existingPlannedShift?: PlannedShift;
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
  currentUser,
  teamMembers,
  onClose,
  onSave,
  onDelete,
}) => {

  const [selectedUserId, setSelectedUserId] = useState<string>(
    existingPlannedShift?.user_id || currentUser?.id || ''
  );
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

  // Determine whether current selection is the logged-in user
  const isSelectedCurrentUser = !selectedUserId || selectedUserId === currentUser?.id;

  // Selected user info (strictly prioritize currentUser for self)
  const targetUser = isSelectedCurrentUser
    ? currentUser
    : (teamMembers.find((u) => u.id === selectedUserId) || currentUser);

  // Hourly rate synchronized with user settings
  const userRateFromSettings = (isSelectedCurrentUser
    ? currentUser?.hourly_rate
    : targetUser?.hourly_rate) ?? currentUser?.hourly_rate ?? 350;

  const [hourlyRate, setHourlyRate] = useState<number>(userRateFromSettings);

  // Sync state whenever existingPlannedShift or dateStr changes
  useEffect(() => {
    if (existingPlannedShift) {
      setSelectedUserId(existingPlannedShift.user_id);
      setIsDayOff(existingPlannedShift.is_day_off === 1);
      setStartTime(existingPlannedShift.start_time || '12:00');
      setEndTime(existingPlannedShift.end_time || '00:00');
      setComment(existingPlannedShift.comment || '');
    } else {
      setSelectedUserId(currentUser?.id || (teamMembers[0]?.id ?? ''));
      setIsDayOff(false);
      setStartTime('12:00');
      setEndTime('00:00');
      setComment('');
    }
  }, [existingPlannedShift, dateStr, currentUser?.id, teamMembers]);

  // Synchronize hourly rate whenever selected user or user settings hourly_rate updates
  useEffect(() => {
    const isSelf = !selectedUserId || selectedUserId === currentUser?.id;
    const resolvedUser = isSelf
      ? currentUser
      : (teamMembers.find((u) => u.id === selectedUserId) || currentUser);

    const rate = (isSelf ? currentUser?.hourly_rate : resolvedUser?.hourly_rate) ?? currentUser?.hourly_rate ?? 350;
    setHourlyRate(rate);
  }, [selectedUserId, currentUser?.hourly_rate, teamMembers, currentUser]);

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
  const estimatedEarned = isDayOff ? 0 : Math.round(hoursWorked * hourlyRate);

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
                setSelectedUserId(e.target.value);
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

            {/* Calculated planned earnings preview */}
            <div className="p-3.5 bg-blue-950/40 rounded-2xl border border-blue-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Расчетный доход по плану:</span>
                </span>
                <span className="text-base font-extrabold text-blue-400 font-mono">
                  ~ {estimatedEarned.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-blue-300/80 pt-1.5 border-t border-blue-800/30">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-neutral-300 font-medium">{hoursWorked}ч × {hourlyRate} ₽/ч</span>
                  {isSelectedCurrentUser && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                      из настроек пользователя
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-neutral-400 text-[10px]">Ставка:</span>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Math.max(0, Number(e.target.value)))}
                    className="w-16 bg-neutral-900 border border-blue-500/40 text-blue-300 font-mono text-center rounded-lg px-1 py-0.5 text-xs font-bold focus:outline-none focus:border-blue-400"
                    title="Часовая ставка (синхронизирована с настройками пользователя)"
                  />
                  <span className="text-[10px] text-neutral-400">₽/ч</span>
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

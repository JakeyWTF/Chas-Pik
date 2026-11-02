import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Plus, Minus, DollarSign, Repeat, Trash2, CheckCircle2 } from 'lucide-react';
import { Shift, RateType, User } from '../types';
import { triggerHaptic } from '../lib/telegram';
import confetti from 'canvas-confetti';

interface ShiftModalProps {
  isOpen: boolean;
  dateStr: string; // YYYY-MM-DD
  existingShift?: Shift;
  currentUser: User | null;
  onClose: () => void;
  onSave: (shiftData: any) => Promise<void>;
  onDelete: (shiftId: string) => Promise<void>;
  onSwapAction: (shiftId: string, action: 'request' | 'cancel', note?: string) => Promise<void>;
}

const MONTH_NAMES_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  dateStr,
  existingShift,
  currentUser,
  onClose,
  onSave,
  onDelete,
  onSwapAction,
}) => {
  const [isDayOff, setIsDayOff] = useState(existingShift?.is_day_off === 1 || false);
  const [startTime, setStartTime] = useState(existingShift?.start_time || '12:00');
  const [endTime, setEndTime] = useState(existingShift?.end_time || '00:00');
  const [rateType, setRateType] = useState<RateType>(
    existingShift?.rate_type || currentUser?.default_rate_type || 'hourly'
  );
  const [hourlyRate, setHourlyRate] = useState<number>(
    existingShift?.hourly_rate ?? currentUser?.hourly_rate ?? 350
  );
  const [shiftFlatRate, setShiftFlatRate] = useState<number>(
    existingShift?.shift_flat_rate ?? currentUser?.shift_flat_rate ?? 3000
  );
  const [salesPercent, setSalesPercent] = useState<number>(
    existingShift?.sales_percent ?? currentUser?.sales_percent ?? 3
  );
  const [personalSales, setPersonalSales] = useState<number>(existingShift?.personal_sales || 0);
  const [tips, setTips] = useState<number>(existingShift?.tips || 0);
  const [comment, setComment] = useState<string>(existingShift?.comment || '');

  const [rateSettingsOpen, setRateSettingsOpen] = useState(false);
  const [showCustomTips, setShowCustomTips] = useState(false);
  const [showSwapPrompt, setShowSwapPrompt] = useState(false);
  const [swapNote, setSwapNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever existingShift or date changes
  useEffect(() => {
    if (existingShift) {
      setIsDayOff(existingShift.is_day_off === 1);
      setStartTime(existingShift.start_time || '12:00');
      setEndTime(existingShift.end_time || '00:00');
      setRateType(existingShift.rate_type || 'hourly');
      setHourlyRate(existingShift.hourly_rate ?? 350);
      setShiftFlatRate(existingShift.shift_flat_rate ?? 3000);
      setSalesPercent(existingShift.sales_percent ?? 3);
      setPersonalSales(existingShift.personal_sales ?? 0);
      setTips(existingShift.tips ?? 0);
      setComment(existingShift.comment ?? '');
      setSwapNote('');
    } else {
      setIsDayOff(false);
      setStartTime('12:00');
      setEndTime('00:00');
      setRateType(currentUser?.default_rate_type || 'hourly');
      setHourlyRate(currentUser?.hourly_rate ?? 350);
      setShiftFlatRate(currentUser?.shift_flat_rate ?? 3000);
      setSalesPercent(currentUser?.sales_percent ?? 3);
      setPersonalSales(0);
      setTips(0);
      setComment('');
      setSwapNote('');
    }
  }, [existingShift, dateStr, currentUser]);

  // Format date: "26 октября"
  const [sY, sM, sD] = dateStr.split('-').map(Number);
  const dayNumber = sD || 1;
  const monthName = MONTH_NAMES_GENITIVE[(sM || 1) - 1] || '';

  // Calculate hours worked
  const calculateDuration = (start: string, end: string): number => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let sMin = sH * 60 + (sM || 0);
    let eMin = eH * 60 + (eM || 0);
    if (eMin <= sMin) {
      eMin += 24 * 60; // Overnight
    }
    return Number(((eMin - sMin) / 60).toFixed(1));
  };

  const hoursWorked = isDayOff ? 0 : calculateDuration(startTime, endTime);

  // Calculate live earnings preview
  let calculatedEarned = 0;
  if (!isDayOff) {
    if (rateType === 'hourly') {
      calculatedEarned = hoursWorked * hourlyRate;
    } else if (rateType === 'fixed_shift') {
      calculatedEarned = shiftFlatRate;
    } else if (rateType === 'percent') {
      calculatedEarned = (personalSales * salesPercent) / 100;
    } else if (rateType === 'combined') {
      calculatedEarned = hoursWorked * hourlyRate + (personalSales * salesPercent) / 100 + shiftFlatRate;
    }
    calculatedEarned = Math.round(calculatedEarned + tips);
  }

  // Adjust time by 30 mins step
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

      await onSave({
        date: dateStr,
        is_day_off: isDayOff ? 1 : 0,
        start_time: startTime,
        end_time: endTime,
        rate_type: rateType,
        hourly_rate: hourlyRate,
        shift_flat_rate: shiftFlatRate,
        sales_percent: salesPercent,
        personal_sales: personalSales,
        tips: tips,
        comment: comment,
      });

      confetti({
        particleCount: 25,
        spread: 60,
        origin: { y: 0.8 },
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const isSeekingSwap = false;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal / BottomSheet Sheet matching Screen 2 mockup */}
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-neutral-900 text-gray-100 rounded-t-3xl p-5 shadow-2xl border-t border-neutral-800 z-10 animate-in slide-in-from-bottom duration-250">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-4" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-xl font-extrabold text-white font-sans">
              Редактирование смены
            </h3>
            <div className="text-sm font-semibold text-emerald-400">
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

        {/* Day off vs Worked toggle */}
        <div className="mt-4 flex bg-neutral-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsDayOff(false);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              !isDayOff
                ? 'bg-emerald-600 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            💼 Отработал
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsDayOff(true);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              isDayOff
                ? 'bg-neutral-700 text-white shadow'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            🏖 Выходной
          </button>
        </div>

        {!isDayOff ? (
          <div className="mt-5 space-y-4">
            {/* Arrival & Departure Steppers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Приход */}
              <div className="bg-neutral-800/80 p-3 rounded-2xl border border-neutral-700/60">
                <span className="text-xs text-neutral-400 font-semibold block mb-2 text-center">
                  Приход
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

              {/* Уход */}
              <div className="bg-neutral-800/80 p-3 rounded-2xl border border-neutral-700/60">
                <span className="text-xs text-neutral-400 font-semibold block mb-2 text-center">
                  Уход
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

            {/* Duration pill */}
            <div className="text-center text-xs text-neutral-400">
              Длительность: <span className="font-bold text-white">{hoursWorked} ч</span>
              {startTime >= '18:00' || endTime <= '06:00' ? (
                <span className="text-amber-400 ml-1 font-semibold">(ночная смена 🌙)</span>
              ) : null}
            </div>

            {/* Rate Settings Collapsible */}
            <div className="bg-neutral-800/60 rounded-2xl border border-neutral-700/60 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setRateSettingsOpen(!rateSettingsOpen);
                }}
                className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-neutral-200 hover:bg-neutral-800 transition"
              >
                <span>Настройка ставки</span>
                <div className="flex items-center gap-1 text-emerald-400">
                  <span className="text-[11px] font-semibold">
                    {rateType === 'hourly' && `Почасовая (${hourlyRate} ₽/ч)`}
                    {rateType === 'percent' && `% от продаж (${salesPercent}%)`}
                    {rateType === 'fixed_shift' && `Оклад (${shiftFlatRate} ₽)`}
                    {rateType === 'combined' && `Комбинированная`}
                  </span>
                  {rateSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {rateSettingsOpen && (
                <div className="p-3.5 pt-0 space-y-3 border-t border-neutral-700/40">
                  {/* Rate formula buttons matching Screen 2 */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRateType('hourly');
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-center transition ${
                        rateType === 'hourly'
                          ? 'bg-neutral-700 text-white border-emerald-500'
                          : 'bg-neutral-900/50 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      Почасовая ({hourlyRate} ₽/ч)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRateType('percent');
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-center transition ${
                        rateType === 'percent'
                          ? 'bg-neutral-700 text-white border-emerald-500'
                          : 'bg-neutral-900/50 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      % от продаж ({salesPercent}%)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRateType('fixed_shift');
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-center transition ${
                        rateType === 'fixed_shift'
                          ? 'bg-neutral-700 text-white border-emerald-500'
                          : 'bg-neutral-900/50 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      Оклад за выход
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setRateType('combined');
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-center transition ${
                        rateType === 'combined'
                          ? 'bg-neutral-700 text-white border-emerald-500'
                          : 'bg-neutral-900/50 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      Комбинированная
                    </button>
                  </div>

                  {/* Form inputs depending on rateType */}
                  <div className="space-y-2 pt-2">
                    {(rateType === 'hourly' || rateType === 'combined') && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Часовая ставка (₽/ч):</span>
                        <input
                          type="number"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(Number(e.target.value))}
                          className="w-24 bg-neutral-900 text-white px-2.5 py-1 rounded-lg border border-neutral-700 text-right font-mono"
                        />
                      </div>
                    )}

                    {(rateType === 'percent' || rateType === 'combined') && (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Процент от продаж (%):</span>
                          <input
                            type="number"
                            step="0.5"
                            value={salesPercent}
                            onChange={(e) => setSalesPercent(Number(e.target.value))}
                            className="w-24 bg-neutral-900 text-white px-2.5 py-1 rounded-lg border border-neutral-700 text-right font-mono"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400">Личная выручка (₽):</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={personalSales || ''}
                            onChange={(e) => setPersonalSales(Number(e.target.value))}
                            className="w-32 bg-neutral-900 text-white px-2.5 py-1 rounded-lg border border-neutral-700 text-right font-mono"
                          />
                        </div>
                      </>
                    )}

                    {(rateType === 'fixed_shift' || rateType === 'combined') && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Оклад за смену (₽):</span>
                        <input
                          type="number"
                          value={shiftFlatRate}
                          onChange={(e) => setShiftFlatRate(Number(e.target.value))}
                          className="w-28 bg-neutral-900 text-white px-2.5 py-1 rounded-lg border border-neutral-700 text-right font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Personal Tips Section matching Screen 2 */}
            <div className="bg-neutral-800/80 p-3.5 rounded-2xl border border-neutral-700/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-300 font-bold">Личные чаевые (₽):</span>
                {tips > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +{tips.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTips((prev) => prev + 500);
                  }}
                  className="py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-xs font-bold text-white transition active:scale-95"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTips((prev) => prev + 1000);
                  }}
                  className="py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-xs font-bold text-white transition active:scale-95"
                >
                  +1000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCustomTips(!showCustomTips);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                    showCustomTips || (tips > 0 && tips !== 500 && tips !== 1000)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                  }`}
                >
                  Ручной
                </button>
              </div>

              {showCustomTips && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Введите сумму чаевых"
                    value={tips || ''}
                    onChange={(e) => setTips(Number(e.target.value))}
                    className="flex-1 bg-neutral-900 border border-neutral-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                  />
                  {tips > 0 && (
                    <button
                      type="button"
                      onClick={() => setTips(0)}
                      className="px-2.5 py-2 text-xs text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Сброс
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Calculated earnings preview */}
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <DollarSign className="w-4 h-4" />
                <span>Расчет за эту смену:</span>
              </div>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {calculatedEarned.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        ) : (
          <div className="my-8 text-center p-6 bg-neutral-800/40 rounded-2xl border border-neutral-700/40">
            <div className="text-3xl mb-2">🏖</div>
            <div className="text-sm font-bold text-neutral-200">Выходной день</div>
            <div className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
              В этот день смена не учитывается в расчете часов и зарплаты. Отдыхайте и набирайтесь сил!
            </div>
          </div>
        )}

        {/* Shift Swap Action (Биржа обмена) if shift exists */}
        {existingShift && !isDayOff && (
          <div className="mt-4 pt-3 border-t border-neutral-800">
            {!isSeekingSwap ? (
              <div>
                {!showSwapPrompt ? (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowSwapPrompt(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Repeat className="w-4 h-4 text-amber-400" />
                    <span>🔄 Нужна замена / Отдать смену на биржу</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-2">
                    <span className="text-xs text-amber-300 font-semibold block">
                      Причина или заметка для коллег:
                    </span>
                    <input
                      type="text"
                      placeholder="Например: Семейные обстоятельства, подмените!"
                      value={swapNote}
                      onChange={(e) => setSwapNote(e.target.value)}
                      className="w-full bg-neutral-900 border border-amber-600/40 text-white rounded-lg p-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await onSwapAction(existingShift.id, 'request', swapNote);
                          setShowSwapPrompt(false);
                          onClose();
                        }}
                        className="flex-1 py-1.5 bg-amber-500 text-black font-bold text-xs rounded-lg hover:bg-amber-400 transition"
                      >
                        Выставить на биржу
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSwapPrompt(false)}
                        className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/60 flex items-center justify-between">
                <div className="text-xs text-amber-300">
                  <span className="font-bold">⚠️ Смена на бирже!</span>
                  <div className="text-[11px] text-amber-400/80">Коллеги видят запрос на подмену</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await onSwapAction(existingShift.id, 'cancel');
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-neutral-800 text-amber-300 text-xs font-semibold rounded-lg hover:bg-neutral-700 transition"
                >
                  Отозвать
                </button>
              </div>
            )}
          </div>
        )}

        {/* Primary Action Button: "💾 Сохранить смену" matching Screen 2 */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 rounded-2xl bg-[#10B981] hover:bg-emerald-600 active:scale-[0.99] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSaving ? 'Сохранение...' : '💾 Сохранить смену'}</span>
          </button>

          {existingShift && (
            <button
              type="button"
              onClick={async () => {
                triggerHaptic('warning');
                await onDelete(existingShift.id);
                onClose();
              }}
              className="w-full py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Удалить запись
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

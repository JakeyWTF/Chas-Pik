import React, { useState, useEffect } from 'react';
import { X, Settings, Check, DollarSign, Percent, Clock, LogOut, UserCheck, Users, Eye, EyeOff, Lock } from 'lucide-react';
import { User, RateType, OnlinePresenceUser } from '../types';
import { triggerHaptic } from '../lib/telegram';
import { DUPLICATE_USERNAME_MESSAGE, isDuplicateUsernameError, validatePasswordStrength } from '../services/supabaseService';

interface RateSettingsModalProps {
  isOpen: boolean;
  user: User | null;
  onlineCount?: number;
  onlineUsers?: OnlinePresenceUser[];
  onClose: () => void;
  onSave: (settings: {
    default_rate_type: RateType;
    hourly_rate: number;
    shift_flat_rate: number;
    sales_percent: number;
    role_title?: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onLogout?: () => void;
}

export const RateSettingsModal: React.FC<RateSettingsModalProps> = ({
  isOpen,
  user,
  onlineCount = 1,
  onlineUsers = [],
  onClose,
  onSave,
  onLogout,
}) => {
  const [roleTitle, setRoleTitle] = useState<string>(user?.role_title || 'Сотрудник');
  const [username, setUsername] = useState<string>(user?.username || '');
  const [rateType, setRateType] = useState<RateType>(user?.default_rate_type || 'hourly');
  const [hourlyRate, setHourlyRate] = useState<number>(user?.hourly_rate ?? 350);
  const [shiftFlatRate, setShiftFlatRate] = useState<number>(user?.shift_flat_rate ?? 3000);
  const [salesPercent, setSalesPercent] = useState<number>(user?.sales_percent ?? 3);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user) {
      setRoleTitle(user.role_title || 'Сотрудник');
      setUsername(user.username || '');
      setRateType(user.default_rate_type || 'hourly');
      setHourlyRate(user.hourly_rate ?? 350);
      setShiftFlatRate(user.shift_flat_rate ?? 3000);
      setSalesPercent(user.sales_percent ?? 3);
      setPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      const passValidation = validatePasswordStrength(password);
      if (!passValidation.isValid) {
        setError(passValidation.message || 'Пароль должен содержать от 6 символов, буквы и цифры');
        triggerHaptic('error');
        return;
      }
    }

    try {
      setIsSaving(true);
      setError('');
      triggerHaptic('medium');
      await onSave({
        role_title: roleTitle.trim() || 'Сотрудник',
        username: username.trim(),
        default_rate_type: rateType,
        hourly_rate: hourlyRate,
        shift_flat_rate: shiftFlatRate,
        sales_percent: salesPercent,
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      triggerHaptic('success');
      onClose();
    } catch (err: any) {
      console.error(err);
      if (isDuplicateUsernameError(err)) {
        setError(DUPLICATE_USERNAME_MESSAGE);
      } else {
        setError(err.message || 'Ошибка сохранения настроек');
      }
      triggerHaptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-neutral-800 text-gray-900 dark:text-gray-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-sans">
              Настройки личного профиля
            </h3>
            <p className="text-xs text-gray-400">
              Логин, должность и формула расчета зарплаты
            </p>
          </div>
        </div>

        {/* Realtime Online Presence Counter & Status */}
        <div className="p-3 mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div>
              <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <span>Онлайн: {onlineCount} {onlineCount === 1 ? 'человек' : onlineCount < 5 ? 'человека' : 'человек'}</span>
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                Подключены к вашей точке в реальном времени
              </div>
            </div>
          </div>
          {onlineUsers && onlineUsers.length > 0 && (
            <div className="flex -space-x-1.5 overflow-hidden">
              {onlineUsers.slice(0, 4).map((ou, i) => (
                <div
                  key={ou.user_id || i}
                  title={`${ou.name || ou.username} (${ou.role})`}
                  className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-white dark:border-neutral-900 shadow-xs"
                >
                  {(ou.name || ou.username || '?')[0].toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>

        {onlineUsers && onlineUsers.length > 1 && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-800/60 border border-gray-100 dark:border-neutral-800 text-[11px] text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
            <span className="font-semibold text-gray-500 dark:text-gray-400">В сети:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
              {onlineUsers.map((u) => u.name || u.username).join(', ')}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-300 text-xs text-center font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Personal Login / Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span>Личный логин для авторизации:</span>
            </label>
            <input
              type="text"
              placeholder="например: @vlad_bar или vlad_33"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl border ${
                error === DUPLICATE_USERNAME_MESSAGE
                  ? 'border-rose-500 ring-2 ring-rose-500/20'
                  : 'border-gray-200 dark:border-neutral-700'
              } bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-mono`}
            />
            {error === DUPLICATE_USERNAME_MESSAGE && (
              <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium mt-1 block">
                Сотрудник с таким логином уже существует. Пожалуйста, выберите другой логин
              </span>
            )}
          </div>

          {/* Personal Password update (optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Новый пароль (оставьте пустым, если не меняете):</span>
              </span>
              <span className="text-[10px] text-gray-400 font-normal">буквы и цифры, от 6 знаков</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Придумайте новый надежный пароль"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5 cursor-pointer"
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role selection / edit */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span>Должность / Роль в заведении:</span>
            </label>
            <input
              type="text"
              placeholder="Например: Бармен, Бариста, Официант, Менеджер"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
            />
          </div>

          {/* Rate formula selector */}
          <div className="pt-2 border-t border-gray-100 dark:border-neutral-800">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Тип расчета ставки:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setRateType('hourly');
                }}
                className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                  rateType === 'hourly'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>Почасовая</span>
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Оплата за часы</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setRateType('percent');
                }}
                className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                  rateType === 'percent'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-500" />
                  <span>% от продаж</span>
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Процент от кассы</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setRateType('fixed_shift');
                }}
                className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                  rateType === 'fixed_shift'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  <span>Оклад за выход</span>
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Фикс за всю смену</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setRateType('combined');
                }}
                className={`p-2.5 rounded-xl border text-left font-semibold transition ${
                  rateType === 'combined'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">⚡</span>
                  <span>Комбинированная</span>
                </div>
                <div className="text-[10px] text-gray-400 font-normal mt-0.5">Часы + % + оклад</div>
              </button>
            </div>
          </div>

          {/* Value Inputs */}
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-neutral-800">
            {(rateType === 'hourly' || rateType === 'combined') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Часовая ставка (₽/ч):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">₽/час</span>
                </div>
              </div>
            )}

            {(rateType === 'percent' || rateType === 'combined') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Процент от личной выручки (%):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={salesPercent}
                    onChange={(e) => setSalesPercent(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span>
                </div>
              </div>
            )}

            {(rateType === 'fixed_shift' || rateType === 'combined') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Фиксированный оклад за смену (₽):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={shiftFlatRate}
                    onChange={(e) => setShiftFlatRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">₽/смена</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Сохранение...' : 'Применить настройки'}</span>
            </button>
          </div>

          {onLogout && (
            <div className="pt-2 border-t border-gray-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('warning');
                  onClose();
                  onLogout();
                }}
                className="w-full py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Выйти из заведения</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

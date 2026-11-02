import React, { useState } from 'react';
import { Store, KeyRound, UserCheck, PlusCircle, LogIn, Sparkles, ShieldCheck, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { triggerHaptic, getTelegramUser } from '../lib/telegram';
import { BrandLogo } from './BrandLogo';

interface AuthScreenProps {
  currentUser: User | null;
  onSuccess: (workplace: any, user: User) => void;
  onClose?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  currentUser,
  onSuccess,
  onClose,
}) => {
  const tgUser = getTelegramUser();
  const currentTgId = currentUser?.tg_id || (tgUser?.id ? String(tgUser.id) : '777001');
  const tgFirstName = tgUser?.first_name || (currentUser?.name && currentUser.name !== 'Новый сотрудник' ? currentUser.name : '');

  const [mode, setMode] = useState<'join' | 'create'>('join');

  // Form states
  const [pointCode, setPointCode] = useState('BAR-409');
  const [pinCode, setPinCode] = useState('1234');
  const [pointName, setPointName] = useState('');
  const [userName, setUserName] = useState(tgFirstName || 'Влад');
  const [roleTitle, setRoleTitle] = useState('Бар');
  const [hourlyRate, setHourlyRate] = useState(350);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const commonRoles = ['Бар', 'Официант', 'Бариста', 'Повар', 'Кассир', 'Хостес'];

  // Handle Join by Point Code + PIN
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/workplaces/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-user-id': currentTgId,
        },
        body: JSON.stringify({
          code: pointCode.trim().toUpperCase(),
          pin_code: pinCode.trim(),
          user_name: userName.trim() || 'Сотрудник',
          role_title: roleTitle.trim() || 'Бар',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Неверный код точки или пин-код');
      }

      triggerHaptic('success');
      onSuccess(data.workplace, data.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка подключения к точке');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Create New Point
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/workplaces/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-user-id': currentTgId,
        },
        body: JSON.stringify({
          name: pointName.trim(),
          pin_code: pinCode.trim(),
          user_name: userName.trim() || 'Сотрудник',
          role_title: roleTitle.trim() || 'Бар',
          default_rate_type: 'hourly',
          hourly_rate: Number(hourlyRate) || 350,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка создания точки');
      }

      triggerHaptic('success');
      onSuccess(data.workplace, data.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка создания точки');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick preset login helper for testing
  const handleQuickLogin = (code: string, pin: string, name: string, role: string) => {
    setPointCode(code);
    setPinCode(pin);
    setUserName(name);
    setRoleTitle(role);
    setMode('join');
    triggerHaptic('light');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-neutral-800 text-gray-900 dark:text-gray-100 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            Закрыть
          </button>
        )}

        {/* Brand header */}
        <div className="text-center mb-5">
          <div className="flex justify-center mb-2">
            <BrandLogo size="lg" showSubtitle={true} />
          </div>

          {/* Telegram ID auto-detection badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs font-mono">
            <UserIcon className="w-3.5 h-3.5" />
            <span>Telegram ID: <b>{currentTgId}</b></span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Tabs: Join / Create */}
        <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-2xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setMode('join');
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
              mode === 'join'
                ? 'bg-white dark:bg-neutral-700 text-teal-600 dark:text-teal-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Войти по коду точки</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setMode('create');
              setError('');
            }}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
              mode === 'create'
                ? 'bg-white dark:bg-neutral-700 text-orange-600 dark:text-orange-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Создать новую точку</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {mode === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Код точки:
              </label>
              <input
                type="text"
                required
                placeholder="BAR-409"
                value={pointCode}
                onChange={(e) => setPointCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                4-значный Пин-код заведения:
              </label>
              <input
                type="password"
                maxLength={4}
                required
                placeholder="1234"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Ваше имя / никнейм для расписания:
              </label>
              <input
                type="text"
                required
                placeholder="например: Влад"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Должность:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {commonRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setRoleTitle(r);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                      roleTitle === r
                        ? 'bg-teal-500 text-white font-bold'
                        : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-2xl bg-teal-500 hover:bg-teal-600 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-teal-500/25 transition cursor-pointer"
            >
              {isLoading ? 'Проверка...' : 'Войти в заведение'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Название заведения:
              </label>
              <input
                type="text"
                required
                placeholder="например: Кофейня «Сёрф», Ресторан «Маяк»"
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Придумайте 4-значный ПИН для коллег:
              </label>
              <input
                type="password"
                maxLength={4}
                required
                placeholder="например: 1234"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Ваше имя:
              </label>
              <input
                type="text"
                required
                placeholder="например: Влад"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Должность:
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ставка (₽/ч):
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 transition cursor-pointer"
            >
              {isLoading ? 'Создаем...' : 'Создать точку и сгенерировать код'}
            </button>
          </form>
        )}

        {/* Quick Demo Pre-fill Box for instant preview */}
        <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-neutral-800 text-center">
          <div className="text-[11px] text-gray-400 font-semibold mb-2">
            Быстрый вход в демонстрационную точку:
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => handleQuickLogin('BAR-409', '1234', 'Влад', 'Бар')}
              className="px-2.5 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold hover:bg-teal-100"
            >
              🍸 Бармен Влад (BAR-409)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('BAR-409', '1234', 'Мария', 'Официант')}
              className="px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-[11px] font-semibold hover:bg-orange-100"
            >
              🥗 Официант Мария
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

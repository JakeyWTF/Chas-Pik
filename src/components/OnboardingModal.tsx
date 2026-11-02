import React, { useState } from 'react';
import { Store, KeyRound, UserCheck, PlusCircle, LogIn, Sparkles, X, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { triggerHaptic } from '../lib/telegram';

interface OnboardingModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose?: () => void;
  onWorkplaceJoined: (workplace: any, user: User) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onWorkplaceJoined,
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join');

  // Form fields
  const [pointCode, setPointCode] = useState('BAR-409');
  const [pinCode, setPinCode] = useState('1234');
  const [pointName, setPointName] = useState('');
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [roleTitle, setRoleTitle] = useState(currentUser?.role_title || 'Бар');
  const [rateType, setRateType] = useState('hourly');
  const [hourlyRate, setHourlyRate] = useState(350);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/workplaces/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-user-id': currentUser?.tg_id || '777001',
        },
        body: JSON.stringify({
          code: pointCode,
          pin_code: pinCode,
          user_name: userName || 'Сотрудник',
          role_title: roleTitle || 'Бар',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка входа в точку');
      }

      triggerHaptic('success');
      onWorkplaceJoined(data.workplace, data.user);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка подключения');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/workplaces/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-user-id': currentUser?.tg_id || '777001',
        },
        body: JSON.stringify({
          name: pointName,
          pin_code: pinCode,
          user_name: userName || 'Сотрудник',
          role_title: roleTitle || 'Бар',
          default_rate_type: rateType,
          hourly_rate: hourlyRate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка создания точки');
      }

      triggerHaptic('success');
      onWorkplaceJoined(data.workplace, data.user);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка создания');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  const commonRoles = ['Бар', 'Официант', 'Бариста', 'Повар', 'Кассир', 'Хостес', 'Менеджер'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-neutral-800 text-gray-900 dark:text-gray-100 overflow-hidden">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold font-sans">
            Точка работы и расписание
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
            Никаких паспортов и слежки. Авторизация по Telegram ID и доступ по 4-значному пину.
          </p>
        </div>

        {/* Tab switch: Join vs Create */}
        <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-2xl mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('join');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'join'
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
              setActiveTab('create');
              setErrorMessage('');
            }}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'create'
                ? 'bg-white dark:bg-neutral-700 text-orange-600 dark:text-orange-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Создать новую точку</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 text-xs font-medium text-center">
            {errorMessage}
          </div>
        )}

        {activeTab === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Код точки:
              </label>
              <input
                type="text"
                required
                placeholder="например: BAR-409"
                value={pointCode}
                onChange={(e) => setPointCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Демо-точка: <code className="text-teal-600 font-bold">BAR-409</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                4-значный Пин-код заведения:
              </label>
              <input
                type="password"
                maxLength={4}
                required
                placeholder="••••"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-teal-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Демо-пин: <code className="text-teal-600 font-bold">1234</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Ваше имя / никнейм для графика:
              </label>
              <input
                type="text"
                required
                placeholder="например: Влад, Мария..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Должность / грейд:
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
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="или напишите свою"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs"
              />
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
                placeholder="например: Бар «Мята Lounge», Ресторан «Маяк»"
                value={pointName}
                onChange={(e) => setPointName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Установите 4-значный Пин-код (для защиты точки):
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
                Ваше имя (создатель / сотрудник):
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
      </div>
    </div>
  );
};

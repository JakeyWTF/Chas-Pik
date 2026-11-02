import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  PlusCircle,
  LogIn,
  ArrowRight,
  CheckCircle2,
  Copy,
  Users,
  Search,
  Building2,
  Lock,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User } from '../types';
import { triggerHaptic } from '../lib/telegram';
import { BrandLogo } from './BrandLogo';
import confetti from 'canvas-confetti';
import {
  createPointInSupabase,
  joinPointInSupabase,
  profileLoginInSupabase,
  fetchTeamMembersFromSupabase,
  DUPLICATE_USERNAME_MESSAGE,
  isDuplicateUsernameError,
  validatePasswordStrength,
} from '../services/supabaseService';

interface StartScreenProps {
  tgId: string;
  onSuccess: (workplace: any, user: User) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ tgId, onSuccess }) => {
  const [activeForm, setActiveForm] = useState<'none' | 'create' | 'join' | 'login'>('none');

  // Sub-mode for login: 'direct' (by login + password) or 'point_team' (by point code + select user from Supabase)
  const [loginMode, setLoginMode] = useState<'direct' | 'point_team'>('direct');

  // Direct Profile Login states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Point Team Lookup states
  const [lookupPointCode, setLookupPointCode] = useState('');
  const [pointEmployees, setPointEmployees] = useState<User[] | null>(null);
  const [isSearchingPoint, setIsSearchingPoint] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [employeePassword, setEmployeePassword] = useState('');
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

  // Creation form states
  const [createPointName, setCreatePointName] = useState('');
  const [createPinCode, setCreatePinCode] = useState('');
  const [createUserName, setCreateUserName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createRoleTitle, setCreateRoleTitle] = useState('');
  const [createHourlyRate, setCreateHourlyRate] = useState<number | ''>('');

  // Join form states
  const [joinPointCode, setJoinPointCode] = useState('');
  const [joinPinCode, setJoinPinCode] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [joinRoleTitle, setJoinRoleTitle] = useState('');
  const [joinHourlyRate, setJoinHourlyRate] = useState<number | ''>('');

  // Success modal for created point
  const [createdPoint, setCreatedPoint] = useState<{ code: string; name: string; pin: string } | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Clean up any legacy cached multi-profile accounts on shared devices on mount
  useEffect(() => {
    try {
      localStorage.removeItem('chaspik_saved_accounts');
    } catch (e) {
      console.warn('Storage cleanup notice:', e);
    }
  }, []);

  // Helper to validate Latin letters for username
  const validateLatinUsername = (val: string): boolean => {
    const latinRegex = /^[a-zA-Z0-9_@.-]+$/;
    return latinRegex.test(val);
  };

  // Handle creating a new point directly in Supabase
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = createUsername.trim();
    if (!trimmedUsername) {
      setError('Введите личный логин (обязательно)');
      return;
    }
    if (!validateLatinUsername(trimmedUsername)) {
      setError('Логин должен быть на латинице (например: vlad_bar)');
      return;
    }

    const passValidation = validatePasswordStrength(createPassword);
    if (!passValidation.isValid) {
      setError(passValidation.message || 'Пароль должен содержать от 6 символов, буквы и цифры');
      triggerHaptic('error');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const { user, workplace } = await createPointInSupabase({
        name: createPointName.trim(),
        pin_code: createPinCode.trim(),
        user_name: createUserName.trim(),
        username: trimmedUsername,
        password: createPassword.trim(),
        role_title: createRoleTitle.trim() || 'Сотрудник',
        hourly_rate: Number(createHourlyRate) || 350,
        tg_id: tgId || trimmedUsername,
      });

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
      });

      localStorage.setItem('chaspik_tg_id', user.username || user.tg_id);

      setCreatedPoint({
        code: workplace.code,
        name: workplace.name,
        pin: createPinCode.trim(),
      });
      setPendingUser(user);
    } catch (err: any) {
      if (isDuplicateUsernameError(err)) {
        setError(DUPLICATE_USERNAME_MESSAGE);
      } else {
        setError(err.message || 'Не удалось создать заведение в Supabase');
      }
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle joining existing point directly in Supabase
  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = joinUsername.trim();
    if (!trimmedUsername) {
      setError('Введите личный логин (обязательно)');
      return;
    }
    if (!validateLatinUsername(trimmedUsername)) {
      setError('Логин должен быть на латинице (например: maria_bar)');
      return;
    }

    const passValidation = validatePasswordStrength(joinPassword);
    if (!passValidation.isValid) {
      setError(passValidation.message || 'Пароль должен содержать от 6 символов, буквы и цифры');
      triggerHaptic('error');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const { user, workplace } = await joinPointInSupabase({
        code: joinPointCode.trim().toUpperCase(),
        pin_code: joinPinCode.trim(),
        user_name: joinUserName.trim(),
        username: trimmedUsername,
        password: joinPassword.trim(),
        role_title: joinRoleTitle.trim() || 'Сотрудник',
        hourly_rate: Number(joinHourlyRate) || 350,
        tg_id: tgId || trimmedUsername,
      });

      triggerHaptic('success');
      localStorage.setItem('chaspik_tg_id', user.username || user.tg_id);
      onSuccess(workplace, user);
    } catch (err: any) {
      if (isDuplicateUsernameError(err)) {
        setError(DUPLICATE_USERNAME_MESSAGE);
      } else {
        setError(err.message || 'Неверный код точки или пин-код');
      }
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle profile login directly by username & password in Supabase
  const handleProfileLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const { user, workplace } = await profileLoginInSupabase(
        loginUsername.trim(),
        loginPassword.trim()
      );

      triggerHaptic('success');
      localStorage.setItem('chaspik_tg_id', user.username || user.tg_id);
      onSuccess(workplace, user);
    } catch (err: any) {
      setError(err.message || 'Ошибка входа в профиль');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle searching point employees live from Supabase
  const handleSearchPointEmployees = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = lookupPointCode.trim().toUpperCase();
    if (!code) {
      setError('Введите код заведения');
      return;
    }
    setError('');
    setIsSearchingPoint(true);
    setSelectedEmployee(null);
    setEmployeePassword('');

    try {
      triggerHaptic('light');
      const members = await fetchTeamMembersFromSupabase(code);
      setPointEmployees(members);
      if (members.length === 0) {
        setError('Сотрудники для этой точки не найдены. Проверьте правильность кода.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ошибка поиска сотрудников');
      triggerHaptic('error');
    } finally {
      setIsSearchingPoint(false);
    }
  };

  // Handle password verification when an employee is selected from the team list
  const handleEmployeePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!employeePassword.trim()) {
      setError('Введите ваш личный пароль');
      return;
    }

    setError('');
    setIsLoading(true);
    triggerHaptic('medium');

    try {
      const { user, workplace } = await profileLoginInSupabase(
        selectedEmployee.username || selectedEmployee.tg_id,
        employeePassword.trim()
      );

      triggerHaptic('success');
      localStorage.setItem('chaspik_tg_id', user.username || user.tg_id);
      onSuccess(workplace, user);
    } catch (err: any) {
      setError(err.message || 'Неверный пароль');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdPoint) return;
    navigator.clipboard.writeText(
      `Точка: ${createdPoint.name}\nКод для входа: ${createdPoint.code}\nПин-код точки: ${createdPoint.pin}`
    );
    setCopiedCode(true);
    triggerHaptic('light');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-neutral-800 text-gray-900 dark:text-gray-100 relative">
        
        {/* Brand Logo & Slogan */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <BrandLogo size="lg" showSubtitle={true} />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
            Честный учет рабочих смен, прозрачный расчет зарплаты и график команды.
          </p>
        </div>

        {/* Created Workplace Success Modal */}
        {createdPoint && pendingUser ? (
          <div key="created-point-view" className="space-y-4 py-2 animate-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200 font-sans">
                Точка успешно создана!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                {createdPoint.name}
              </p>

              {/* Code Box */}
              <div className="my-3 p-3 bg-white dark:bg-neutral-900 rounded-xl border border-emerald-300 dark:border-emerald-700 flex flex-col items-center">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Уникальный код точки:</span>
                <span className="text-2xl font-mono font-extrabold text-teal-600 dark:text-teal-400 tracking-wider">
                  {createdPoint.code}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Пин-код точки для коллег: <b className="font-mono text-gray-700 dark:text-gray-300">{createdPoint.pin}</b>
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Copy className="w-4 h-4" />
                <span>{copiedCode ? 'Данные скопированы!' : 'Скопировать код и пин для коллег'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onSuccess(createdPoint, pendingUser);
              }}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Перейти в приложение</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : activeForm === 'none' ? (
          /* Main 3-Action Choice Screen */
          <div key="actions-choice-view" className="space-y-3 pt-2">
            {/* Action 1: Create New Point */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveForm('create');
                setError('');
              }}
              className="w-full p-4 rounded-2xl border-2 border-orange-500/30 hover:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-left transition group active:scale-[0.99] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-gray-900 dark:text-white font-sans group-hover:text-orange-500 transition">
                    Создать новую точку
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Первичная регистрация заведения
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition" />
            </button>

            {/* Action 2: Join by Point Code */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveForm('join');
                setError('');
              }}
              className="w-full p-4 rounded-2xl border-2 border-teal-500/30 hover:border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 text-left transition group active:scale-[0.99] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/30">
                  <LogIn className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-gray-900 dark:text-white font-sans group-hover:text-teal-500 transition">
                    Войти по коду точки
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Подключение нового сотрудника
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-teal-500 group-hover:translate-x-1 transition" />
            </button>

            {/* Action 3: Profile Login / Already Have Account */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveForm('login');
                setError('');
                setSelectedEmployee(null);
                setEmployeePassword('');
              }}
              className="w-full p-4 rounded-2xl border-2 border-blue-500/30 hover:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-left transition group active:scale-[0.99] flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-gray-900 dark:text-white font-sans group-hover:text-blue-500 transition flex items-center gap-1.5">
                    <span>🔑 Войти в личный профиль</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    По логину и паролю или через код точки
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition" />
            </button>
          </div>
        ) : activeForm === 'login' ? (
          /* Profile Login Form: Direct by username+password OR search point members from Supabase */
          <div key="login-form-view">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="text-base font-extrabold font-sans flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-500" />
                <span>Вход в личный профиль</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveForm('none');
                  setSelectedEmployee(null);
                  setError('');
                }}
                className="text-xs font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                Назад
              </button>
            </div>

            {/* Sub-mode selector tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-neutral-800 rounded-xl mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setLoginMode('direct');
                  setError('');
                  setSelectedEmployee(null);
                }}
                className={`py-2 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginMode === 'direct'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>По логину и паролю</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setLoginMode('point_team');
                  setError('');
                  setSelectedEmployee(null);
                }}
                className={`py-2 px-2.5 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  loginMode === 'point_team'
                    ? 'bg-white dark:bg-neutral-900 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Сотрудники точки</span>
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-300 text-xs text-center font-medium">
                {error}
              </div>
            )}

            {loginMode === 'direct' ? (
              /* Mode 1: Direct Login by username and password */
              <form onSubmit={handleProfileLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Личный логин (латиницей):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="например: vlad_bar"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Личный пароль:
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5 cursor-pointer"
                      title={showLoginPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 mt-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isLoading ? 'Проверка...' : 'Войти в профиль'}</span>
                </button>
              </form>
            ) : (
              /* Mode 2: Point Team Lookup (Live from Supabase) */
              <div>
                {!selectedEmployee ? (
                  <div className="space-y-3">
                    <form onSubmit={handleSearchPointEmployees} className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Код вашего заведения / точки:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="например: POINT-927"
                          value={lookupPointCode}
                          onChange={(e) => setLookupPointCode(e.target.value.toUpperCase())}
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={isSearchingPoint}
                          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-teal-600/20"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>{isSearchingPoint ? 'Поиск...' : 'Найти'}</span>
                        </button>
                      </div>
                      <span className="text-[11px] text-gray-400 block">
                        Список сотрудников запрашивается напрямую из базы заведения
                      </span>
                    </form>

                    {/* Loaded point employees list */}
                    {pointEmployees && pointEmployees.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Сотрудники точки ({pointEmployees.length}):
                          </span>
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                            Выберите свой профиль
                          </span>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {pointEmployees.map((member) => (
                            <button
                              type="button"
                              key={member.id}
                              onClick={() => {
                                triggerHaptic('light');
                                setSelectedEmployee(member);
                                setEmployeePassword('');
                                setShowEmployeePassword(false);
                                setError('');
                              }}
                              className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700/80 hover:border-teal-500 dark:hover:border-teal-500 flex items-center justify-between text-left transition group cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                                  {member.name ? member.name.charAt(0) : 'U'}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <span>{member.name}</span>
                                    {member.role_title && (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 rounded font-semibold">
                                        {member.role_title}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-gray-400">
                                    {member.username ? `@${member.username}` : member.tg_id}
                                  </div>
                                </div>
                              </div>

                              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:translate-x-0.5 transition">
                                Выбрать →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Employee Selected -> Password Verification Step */
                  <form onSubmit={handleEmployeePasswordSubmit} className="space-y-4 animate-in fade-in duration-200">
                    <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
                          {selectedEmployee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            {selectedEmployee.name}
                          </div>
                          <div className="text-[10px] font-mono text-teal-600 dark:text-teal-400">
                            {selectedEmployee.username ? `@${selectedEmployee.username}` : selectedEmployee.role_title}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(null);
                          setEmployeePassword('');
                          setError('');
                        }}
                        className="text-[11px] font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                      >
                        Сменить
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-teal-500" />
                        <span>Введите ваш личный пароль:</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showEmployeePassword ? 'text' : 'password'}
                          autoFocus
                          required
                          placeholder="••••••••"
                          value={employeePassword}
                          onChange={(e) => {
                            setEmployeePassword(e.target.value);
                            if (error) setError('');
                          }}
                          className="w-full pl-3.5 pr-10 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-base focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white text-center"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5 cursor-pointer"
                          title={showEmployeePassword ? 'Скрыть пароль' : 'Показать пароль'}
                        >
                          {showEmployeePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(null);
                          setEmployeePassword('');
                          setError('');
                        }}
                        className="w-1/3 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                      >
                        Назад
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading || !employeePassword.trim()}
                        className="w-2/3 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md shadow-teal-600/25 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{isLoading ? 'Проверка...' : 'Войти в профиль'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : activeForm === 'create' ? (
          /* Create Form */
          <div key="create-form-view">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="text-base font-extrabold font-sans flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-orange-500" />
                <span>Создание новой точки</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveForm('none')}
                className="text-xs font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                Назад
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Название заведения:
                </label>
                <input
                  type="text"
                  required
                  placeholder="например: Бар «Мята»"
                  value={createPointName}
                  onChange={(e) => setCreatePointName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Пин-код точки (4 цифры):</span>
                  <span className="text-[10px] text-gray-400">для подключения коллег</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={createPinCode}
                  onChange={(e) => setCreatePinCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Личный логин <span className="text-rose-500">*</span> (обязательно, латиницей):
                </label>
                <input
                  type="text"
                  required
                  placeholder="например: vlad_bar"
                  value={createUsername}
                  onChange={(e) => {
                    setCreateUsername(e.target.value);
                    if (error) setError('');
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    error === DUPLICATE_USERNAME_MESSAGE
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-gray-200 dark:border-neutral-700'
                  } bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-white font-mono`}
                />
                {error === DUPLICATE_USERNAME_MESSAGE && (
                  <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium mt-1 block">
                    Сотрудник с таким логином уже существует. Пожалуйста, выберите другой логин
                  </span>
                )}
              </div>

              {/* Personal Secure Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Личный пароль <span className="text-rose-500">*</span>:</span>
                  <span className="text-[10px] text-gray-400 font-normal">буквы и цифры, от 6 знаков</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    placeholder="Придумайте надежный пароль"
                    value={createPassword}
                    onChange={(e) => {
                      setCreatePassword(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5 cursor-pointer"
                    title={showCreatePassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ваше имя в расписании:
                </label>
                <input
                  type="text"
                  required
                  placeholder="например: Влад"
                  value={createUserName}
                  onChange={(e) => setCreateUserName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Должность:
                  </label>
                  <input
                    type="text"
                    placeholder="например: Бармен"
                    value={createRoleTitle}
                    onChange={(e) => setCreateRoleTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ставка (₽/ч):
                  </label>
                  <input
                    type="number"
                    placeholder="350"
                    value={createHourlyRate}
                    onChange={(e) => setCreateHourlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs font-mono font-semibold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 transition cursor-pointer"
              >
                {isLoading ? 'Создаем...' : 'Создать точку и получить код'}
              </button>
            </form>
          </div>
        ) : (
          /* Join Form */
          <div key="join-form-view">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="text-base font-extrabold font-sans flex items-center gap-2">
                <LogIn className="w-5 h-5 text-teal-600" />
                <span>Вход по коду точки</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveForm('none')}
                className="text-xs font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                Назад
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Код точки:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Введите код точки"
                  value={joinPointCode}
                  onChange={(e) => setJoinPointCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Пин-код заведения (4 цифры):</span>
                  <span className="text-[10px] text-gray-400">от создателя точки</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={joinPinCode}
                  onChange={(e) => setJoinPinCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-mono tracking-widest text-center focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Личный логин <span className="text-rose-500">*</span> (обязательно, латиницей):
                </label>
                <input
                  type="text"
                  required
                  placeholder="например: maria_bar"
                  value={joinUsername}
                  onChange={(e) => {
                    setJoinUsername(e.target.value);
                    if (error) setError('');
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border ${
                    error === DUPLICATE_USERNAME_MESSAGE
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-gray-200 dark:border-neutral-700'
                  } bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white font-mono`}
                />
                {error === DUPLICATE_USERNAME_MESSAGE && (
                  <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium mt-1 block">
                    Сотрудник с таким логином уже существует. Пожалуйста, выберите другой логин
                  </span>
                )}
              </div>

              {/* Personal Secure Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Личный пароль <span className="text-rose-500">*</span>:</span>
                  <span className="text-[10px] text-gray-400 font-normal">буквы и цифры, от 6 знаков</span>
                </label>
                <div className="relative">
                  <input
                    type={showJoinPassword ? 'text' : 'password'}
                    required
                    placeholder="Придумайте надежный пароль"
                    value={joinPassword}
                    onChange={(e) => {
                      setJoinPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinPassword(!showJoinPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-0.5 cursor-pointer"
                    title={showJoinPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showJoinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ваше имя в расписании:
                </label>
                <input
                  type="text"
                  required
                  placeholder="например: Мария"
                  value={joinUserName}
                  onChange={(e) => setJoinUserName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Должность:
                </label>
                <input
                  type="text"
                  value={joinRoleTitle}
                  onChange={(e) => setJoinRoleTitle(e.target.value)}
                  placeholder="например: Официант"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ставка (₽/ч):
                </label>
                <input
                  type="number"
                  placeholder="350"
                  value={joinHourlyRate}
                  onChange={(e) => setJoinHourlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-xs font-mono font-semibold text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-teal-500/25 transition cursor-pointer"
              >
                {isLoading ? 'Проверка...' : 'Войти в точку'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

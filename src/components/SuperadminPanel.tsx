import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  CalendarDays,
  Search,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  LogOut,
  Clock,
  Sparkles,
} from 'lucide-react';
import { triggerHaptic } from '../lib/telegram';
import { fetchAllPointsForSuperadmin } from '../services/supabaseService';

export interface PointOverview {
  id: string;
  code: string;
  name: string;
  created_at: string;
  users_count: number;
  shifts_count: number;
}

interface SuperadminPanelProps {
  onSelectPoint: (point: { id: string; code: string; name: string }) => void;
  onLogout: () => void;
  currentPointCode?: string;
  onClose?: () => void;
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({
  onSelectPoint,
  onLogout,
  currentPointCode,
  onClose,
}) => {
  const [points, setPoints] = useState<PointOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadPoints = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchAllPointsForSuperadmin();
      setPoints(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ошибка загрузки точек');
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPoints();
  }, []);

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    triggerHaptic('light');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePointClick = (point: PointOverview) => {
    triggerHaptic('medium');
    localStorage.setItem('point_id', point.id);
    onSelectPoint({
      id: point.id,
      code: point.code,
      name: point.name,
    });
  };

  const filteredPoints = points.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full box-border overflow-x-hidden bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 flex flex-col font-sans transition-colors selection:bg-purple-500 selection:text-white">
      {/* Top Superadmin Control Bar - Fully responsive */}
      <header className="sticky top-0 z-30 w-full max-w-full box-border overflow-hidden bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white shadow-xl border-b border-purple-500/30">
        <div className="w-full max-w-4xl mx-auto px-3.5 py-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 box-border">
          {/* Left / Top Row: Logo, Title, Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-purple-400 text-purple-950 flex items-center justify-center shadow-lg shadow-purple-500/20 font-extrabold flex-shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-purple-950" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight font-sans truncate">
                  Панель Суперадмина
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono font-black text-[9px] uppercase tracking-wider flex-shrink-0">
                  SUPERADMIN
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-purple-200/80 truncate">
                Все точки, графики смен и сотрудники
              </p>
            </div>
          </div>

          {/* Right / Bottom Row on mobile: Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
            {currentPointCode && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 touch-manipulation"
              >
                <span>К текущей точке</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onLogout();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 touch-manipulation"
              title="Выйти из режима суперадминистратора"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-4xl mx-auto flex-1 p-3.5 sm:p-6 space-y-4 box-border overflow-x-hidden">
        {/* Banner with Overview Stats */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-purple-100 dark:border-purple-950/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 box-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Заведения в системе
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-sans text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>{points.length} {points.length === 1 ? 'точка' : points.length > 4 ? 'точек' : 'точки'}</span>
                <span className="text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                  База Supabase
                </span>
              </div>
            </div>
          </div>

          {/* Search Input & Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию или коду..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/80 text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none box-border"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                loadPoints();
              }}
              disabled={isLoading}
              className="p-2 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer flex-shrink-0 active:scale-95"
              title="Обновить список точек"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-500' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs text-center font-semibold">
            {error}
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && points.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 animate-pulse space-y-3"
              >
                <div className="h-5 bg-gray-200 dark:bg-neutral-800 rounded-lg w-2/3" />
                <div className="h-4 bg-gray-100 dark:bg-neutral-800/50 rounded w-1/3" />
                <div className="h-8 bg-gray-100 dark:bg-neutral-800/40 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredPoints.length === 0 ? (
          /* Empty state */
          <div className="p-8 sm:p-12 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 space-y-3">
            <Building2 className="w-12 h-12 text-gray-300 dark:text-neutral-700 mx-auto" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              {searchQuery ? 'Ничего не найдено' : 'Точки еще не созданы'}
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {searchQuery
                ? `По запросу «${searchQuery}» нет совпадающих точек.`
                : 'В базе данных Supabase пока нет зарегистрированных заведений.'}
            </p>
          </div>
        ) : (
          /* Points Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full box-border">
            {filteredPoints.map((point) => {
              const isCurrent = currentPointCode === point.code;
              return (
                <div
                  key={point.id}
                  onClick={() => handlePointClick(point)}
                  className={`p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border ${
                    isCurrent
                      ? 'border-purple-500 ring-2 ring-purple-500/20'
                      : 'border-gray-200/80 dark:border-neutral-800 hover:border-purple-400 dark:hover:border-purple-600'
                  } transition-all duration-150 shadow-sm hover:shadow-md cursor-pointer group flex flex-col justify-between relative overflow-hidden box-border`}
                >
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-bl-xl shadow z-10">
                      Активная точка
                    </div>
                  )}

                  <div className="w-full min-w-0">
                    {/* Point Header: Name & Code */}
                    <div className="flex items-start justify-between gap-2 mb-2 pr-12">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition font-sans flex items-center gap-1.5 min-w-0">
                          <Building2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <span className="truncate">{point.name}</span>
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
                            {point.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(point.code, e)}
                            className="text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition p-1 cursor-pointer"
                            title="Скопировать код точки"
                          >
                            {copiedCode === point.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Point Metrics */}
                    <div className="grid grid-cols-2 gap-2 my-3">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-800/70 border border-gray-100 dark:border-neutral-800 flex items-center gap-2 min-w-0">
                        <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium text-gray-400 uppercase truncate">Сотрудники</div>
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                            {point.users_count} чел.
                          </div>
                        </div>
                      </div>

                      <div className="p-2 sm:p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-800/70 border border-gray-100 dark:border-neutral-800 flex items-center gap-2 min-w-0">
                        <CalendarDays className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-medium text-gray-400 uppercase truncate">Смены</div>
                          <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                            {point.shifts_count} смен
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Button */}
                  <div className="pt-2 border-t border-gray-100 dark:border-neutral-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-[11px] text-gray-400 flex items-center gap-1 font-mono truncate">
                      <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      {formatDate(point.created_at)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePointClick(point);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-extrabold flex items-center gap-1 transition shadow-md shadow-purple-600/20 group-hover:translate-x-0.5 cursor-pointer flex-shrink-0 touch-manipulation"
                    >
                      <span>Войти в точку</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

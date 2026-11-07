import React from 'react';
import { Zap, Clock, CalendarCheck, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { MonthStats, User } from '../types';
import { triggerHaptic } from '../lib/telegram';

interface FinancialDashboardProps {
  stats: MonthStats;
  monthName: string;
  user: User | null;
  onOpenRateSettings: () => void;
  isSuperadmin?: boolean;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  stats,
  monthName,
  user,
  onOpenRateSettings,
  isSuperadmin = false,
}) => {
  const avgPerShift = stats.shiftsCount > 0 ? Math.round(stats.totalEarned / stats.shiftsCount) : 0;
  const avgPerHour = stats.totalHours > 0 ? Math.round(stats.totalEarned / stats.totalHours) : 0;

  return (
    <div className="px-4 pt-3 pb-2">
      {/* Main Blue Gradient Card matching the user's mockup design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E88E5] via-[#2196F3] to-[#1565C0] text-white p-5 shadow-lg shadow-blue-500/20">
        {/* Subtle decorative background glow */}
        <div className="absolute -right-6 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-3 top-3 opacity-20 pointer-events-none">
          <Sparkles className="w-16 h-16" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-blue-100 text-xs font-semibold tracking-wide uppercase">
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Заработано в {monthName}:</span>
            </div>

            {user && !isSuperadmin && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  onOpenRateSettings();
                }}
                className="text-[11px] font-medium text-white/90 bg-white/15 hover:bg-white/25 px-2.5 py-0.5 rounded-full flex items-center gap-1 backdrop-blur transition cursor-pointer"
              >
                <span>{user.default_rate_type === 'hourly' ? `${user.hourly_rate} ₽/ч` : user.default_rate_type === 'percent' ? `${user.sales_percent}%` : 'Ставка'}</span>
                <ChevronRight className="w-3 h-3 text-white/70" />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans">
              {stats.totalEarned.toLocaleString('ru-RU')}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-blue-100">₽</span>
          </div>

          {/* Metrics row: hours & shifts */}
          <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[11px] text-blue-100 font-medium">Отработано:</div>
                <div className="font-bold text-white text-sm">
                  {stats.totalHours} {stats.totalHours === 1 ? 'час' : (stats.totalHours >= 2 && stats.totalHours <= 4) ? 'часа' : 'часов'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[11px] text-blue-100 font-medium">Смен:</div>
                <div className="font-bold text-white text-sm">{stats.shiftsCount}</div>
              </div>
            </div>
          </div>

          {/* Sub-summary pill */}
          {stats.shiftsCount > 0 && (
            <div className="mt-3 text-[11px] text-blue-100/90 flex items-center justify-between bg-black/10 px-2.5 py-1.5 rounded-lg">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                Ср. смена: <b className="text-white font-semibold">{avgPerShift.toLocaleString('ru-RU')} ₽</b>
              </span>
              <span>
                Ср. час: <b className="text-white font-semibold">{avgPerHour.toLocaleString('ru-RU')} ₽</b>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Settings, LogOut, Store, Check } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { User } from '../types';
import { triggerHaptic } from '../lib/telegram';

interface HeaderProps {
  user: User | null;
  onlineCount?: number;
  onOpenRateSettings: () => void;
  onLogout: () => void;
  isSuperadmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onlineCount = 1,
  onOpenRateSettings,
  onLogout,
  isSuperadmin = false,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleLogoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('warning');
    onLogout();
  };

  const handleCopyCode = () => {
    if (!user?.workplace_code) return;
    triggerHaptic('light');
    navigator.clipboard.writeText(user.workplace_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <header className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-2">
        <BrandLogo size="md" />

        {user?.workplace_code && (
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 transition cursor-pointer active:scale-95"
            title="Нажмите, чтобы скопировать код точки"
          >
            <Store className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            <span className="font-mono">{user.workplace_code}</span>
            {copiedCode && <Check className="w-3 h-3 text-emerald-600" />}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* User profile & rate settings unified badge (hidden for superadmin in point viewing mode) */}
        {user && !isSuperadmin && (
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenRateSettings();
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-neutral-700 transition cursor-pointer active:scale-95"
            title={`Настройки личного профиля (онлайн: ${onlineCount} чел.)`}
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold">{user.name}</span>
              {user.role_title && (
                <span className="text-[10px] text-gray-400 font-normal">({user.role_title})</span>
              )}
            </div>
            <Settings className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
          </button>
        )}

        {/* Exit / Log out button */}
        <button
          onClick={handleLogoutClick}
          className="p-2 rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-95 cursor-pointer"
          title={isSuperadmin ? "Выйти из режима суперадминистратора" : "Выйти из точки"}
          aria-label={isSuperadmin ? "Выйти из режима суперадминистратора" : "Выйти из точки"}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

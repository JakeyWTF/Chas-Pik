import React from 'react';

interface BrandLogoProps {
  showSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  showSubtitle = false,
  size = 'md',
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Brand Icon SVG matching user's logo */}
      <div className={`relative flex-shrink-0 ${iconSizes[size]} flex items-center justify-center`}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
          {/* Bar 1 (Coral) */}
          <rect x="12" y="52" width="11" height="28" rx="5.5" fill="#FF725E" />
          {/* Bar 2 (Teal) */}
          <rect x="28" y="38" width="11" height="42" rx="5.5" fill="#14B8A6" />
          {/* Bar 3 (Teal/Cyan) */}
          <rect x="44" y="24" width="11" height="56" rx="5.5" fill="#2DD4BF" />
          {/* Fluid Loop Arc (Coral connecting to loop) */}
          <path
            d="M 12 70 C 25 76, 42 66, 56 46 C 70 26, 82 28, 86 42 C 90 58, 74 78, 58 74 C 48 71, 46 62, 54 54 C 62 46, 78 52, 78 62"
            stroke="url(#chaspik-grad)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="chaspik-grad" x1="12" y1="70" x2="86" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF725E" />
              <stop offset="50%" stopColor="#FF8F70" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex flex-col leading-tight">
        <div className={`font-extrabold tracking-tight ${textSizes[size]} flex items-baseline font-sans`}>
          <span className="text-teal-500 dark:text-teal-400">Час</span>
          <span className="text-orange-500 dark:text-orange-400">Пик</span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] tracking-wider uppercase font-semibold text-gray-500 dark:text-gray-400">
            Личный помощник & честный учет часов
          </span>
        )}
      </div>
    </div>
  );
};

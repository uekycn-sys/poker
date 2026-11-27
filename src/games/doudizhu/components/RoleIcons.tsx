import React, { useId } from 'react';

export type DoudizhuRole = 'landlord' | 'farmer' | 'pending';

interface RolePortraitSvgProps {
  role: DoudizhuRole;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PORTRAIT_SIZES: Record<NonNullable<RolePortraitSvgProps['size']>, string> = {
  sm: 'h-9 w-9 sm:h-10 sm:w-10 short-h:h-7 short-h:w-7',
  md: 'h-12 w-12 sm:h-14 sm:w-14 short-h:h-9 short-h:w-9',
  lg: 'h-14 w-14 sm:h-16 sm:w-16',
};

/**
 * High-contrast, instantly recognizable portrait emblems for Landlord (red/gold silk melon cap + mustache)
 * and Farmer (emerald/sky woven wide-brim straw hat + towel + wheat).
 */
export const RolePortraitSvg: React.FC<RolePortraitSvgProps> = ({
  role,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const sizeCls = PORTRAIT_SIZES[size];

  if (role === 'pending') {
    return (
      <svg
        viewBox="0 0 72 72"
        className={`${sizeCls} shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)] ${className}`}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`pending-bg-${uid}`} cx="40%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
        </defs>
        <circle cx="36" cy="36" r="32" fill={`url(#pending-bg-${uid})`} stroke="#94a3b8" strokeWidth="3" />
        <circle cx="36" cy="36" r="27" fill="none" stroke="#e2e8f0" strokeOpacity="0.2" strokeWidth="1" />
        <path
          d="M36 16 C27.5 26, 21 32, 21 39 C21 44, 24.5 47.5, 29.5 47.5 C32 47.5, 34 46, 35 44 C34.5 48, 33 51, 30 53.5 L42 53.5 C39 51, 37.5 48, 37 44 C38 46, 40 47.5, 42.5 47.5 C47.5 47.5, 51 44, 51 39 C51 32, 44.5 26, 36 16 Z"
          fill="#fbbf24"
          stroke="#fef08a"
          strokeWidth="1.2"
        />
      </svg>
    );
  }

  if (role === 'landlord') {
    return (
      <svg
        viewBox="0 0 72 72"
        className={`${sizeCls} shrink-0 drop-shadow-[0_4px_12px_rgba(185,28,28,0.65)] ${className}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`ll-ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <radialGradient id={`ll-bg-${uid}`} cx="38%" cy="28%" r="75%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="65%" stopColor="#991b1b" />
            <stop offset="100%" stopColor="#450a0a" />
          </radialGradient>
        </defs>

        {/* Bold Red-Gold Medallion Frame */}
        <circle cx="36" cy="36" r="32.5" fill={`url(#ll-bg-${uid})`} stroke={`url(#ll-ring-${uid})`} strokeWidth="3.2" />
        <circle cx="36" cy="36" r="28" fill="none" stroke="#fef08a" strokeOpacity="0.32" strokeWidth="1" />

        {/* Crimson Silk Robe + Gold Collar */}
        <path
          d="M14 60 C17 45, 55 45, 58 60 Z"
          fill="#7f1d1d"
          stroke="#facc15"
          strokeWidth="1.6"
        />
        <path
          d="M27 47 L36 55 L45 47"
          fill="none"
          stroke="#fde047"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Gold Ingot Collar Clasp */}
        <ellipse cx="36" cy="54" rx="4.2" ry="2.2" fill="#facc15" stroke="#78350f" strokeWidth="0.9" />

        {/* Face */}
        <circle cx="36" cy="35" r="12" fill="#fde68a" stroke="#b45309" strokeWidth="1.1" />
        {/* Cheerful Eyes & Brows */}
        <circle cx="31.5" cy="33.5" r="1.6" fill="#1e293b" />
        <circle cx="40.5" cy="33.5" r="1.6" fill="#1e293b" />
        <path d="M29 30.2 Q31.5 28.5 34 30.2" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M38 30.2 Q40.5 28.5 43 30.2" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />

        {/* Classic Landlord Upturned Mustache */}
        <path
          d="M36 37.5 C33 36.2, 29 38.2, 26.5 37 C28.5 40.5, 33 40.2, 36 39 C39 40.2, 43.5 40.5, 45.5 37 C43 38.2, 39 36.2, 36 37.5 Z"
          fill="#1e293b"
        />
        <path d="M32.5 41.8 Q36 44 39.5 41.8" fill="none" stroke="#92400e" strokeWidth="1.4" strokeLinecap="round" />

        {/* Iconic Black-Gold Embroidered Landlord Melon Cap (瓜皮帽) */}
        <path
          d="M20 26 C21 13, 51 13, 52 26 Z"
          fill="#111827"
          stroke="#facc15"
          strokeWidth="1.8"
        />
        {/* Gold Cap Band */}
        <rect x="19" y="23.5" width="34" height="4.8" rx="2.4" fill="#d97706" stroke="#fef08a" strokeWidth="1" />
        {/* Big Ruby Top Button & Forehead Jade/Gold Medallion */}
        <circle cx="36" cy="13.5" r="4.2" fill="#ef4444" stroke="#fef08a" strokeWidth="1.5" />
        <circle cx="36" cy="25.9" r="3.2" fill="#facc15" stroke="#78350f" strokeWidth="1" />
        <circle cx="36" cy="25.9" r="1.4" fill="#e11d48" />
      </svg>
    );
  }

  // FARMER: Fresh Emerald-Teal Background + Oversized Golden Woven Straw Hat + White Shoulder Towel + Wheat
  return (
    <svg
      viewBox="0 0 72 72"
      className={`${sizeCls} shrink-0 drop-shadow-[0_4px_12px_rgba(16,185,129,0.55)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`fm-ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <radialGradient id={`fm-bg-${uid}`} cx="38%" cy="30%" r="74%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="62%" stopColor="#047857" />
          <stop offset="100%" stopColor="#022c22" />
        </radialGradient>
      </defs>

      {/* Fresh Emerald Medallion Frame */}
      <circle cx="36" cy="36" r="32.5" fill={`url(#fm-bg-${uid})`} stroke={`url(#fm-ring-${uid})`} strokeWidth="3.2" />
      <circle cx="36" cy="36" r="28" fill="none" stroke="#a7f3d0" strokeOpacity="0.3" strokeWidth="1" />

      {/* Blue-Teal Farmer Tunic + Classic White Towel Draped Over Shoulder */}
      <path
        d="M14 60 C17 45, 55 45, 58 60 Z"
        fill="#0369a1"
        stroke="#7dd3fc"
        strokeWidth="1.3"
      />
      <path
        d="M21 48 L26 60 L32 60 L28 46 Z"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="0.9"
      />
      {/* Wheat Ear Accent on Right */}
      <path d="M51 56 L55 44" stroke="#fde047" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="52.5" cy="49" rx="1.6" ry="2.8" transform="rotate(-25 52.5 49)" fill="#facc15" />
      <ellipse cx="54.2" cy="45.5" rx="1.5" ry="2.5" transform="rotate(-25 54.2 45.5)" fill="#fde047" />

      {/* Sun-tanned Smiling Face */}
      <circle cx="36" cy="36" r="11.2" fill="#fed7aa" stroke="#c2410c" strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="32" cy="35" r="1.5" fill="#1e293b" />
      <circle cx="40" cy="35" r="1.5" fill="#1e293b" />
      <path d="M29.5 32 Q32 30.5 34.5 32" fill="none" stroke="#7c2d12" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M37.5 32 Q40 30.5 42.5 32" fill="none" stroke="#7c2d12" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M31.8 39.5 Q36 43.2 40.2 39.5" fill="none" stroke="#9a3412" strokeWidth="1.7" strokeLinecap="round" />

      {/* Iconic Oversized Conical Straw Hat / Bamboo Hat (大草帽/斗笠) */}
      <ellipse cx="36" cy="25.5" rx="25" ry="5.5" fill="#fde047" stroke="#b45309" strokeWidth="1.4" />
      <path
        d="M15 24.5 L36 10 L57 24.5 Z"
        fill="#f59e0b"
        stroke="#92400e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Woven Hat Texture Ribs */}
      <path d="M24 23.5 L36 12 L48 23.5" fill="none" stroke="#fef08a" strokeOpacity="0.65" strokeWidth="1.1" />
      {/* Bright Red Hat Ribbon */}
      <path d="M22.5 22.8 Q36 25.5 49.5 22.8" fill="none" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
};

interface RoleEmblemIconProps {
  role: DoudizhuRole;
  className?: string;
}

/**
 * Compact crisp vector emblem icon (Melon Cap for Landlord, Wide Straw Hat for Farmer).
 */
export const RoleEmblemIcon: React.FC<RoleEmblemIconProps> = ({
  role,
  className = 'h-4 w-4',
}) => {
  if (role === 'landlord') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
        <path
          d="M4 17 C4.5 9.5, 19.5 9.5, 20 17 Z"
          fill="#111827"
          stroke="#facc15"
          strokeWidth="1.6"
        />
        <rect x="3" y="15.5" width="18" height="3.5" rx="1.75" fill="#d97706" stroke="#fef08a" strokeWidth="0.8" />
        <circle cx="12" cy="8.2" r="2.6" fill="#ef4444" stroke="#fef08a" strokeWidth="1.1" />
        <circle cx="12" cy="17.2" r="1.5" fill="#fef08a" />
      </svg>
    );
  }

  if (role === 'farmer') {
    return (
      <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
        <ellipse cx="12" cy="16.5" rx="10.5" ry="2.8" fill="#fde047" stroke="#92400e" strokeWidth="1.1" />
        <path d="M3.5 16 L12 6.5 L20.5 16 Z" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M6.5 14.5 Q12 16 17.5 14.5" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fde047">
        ?
      </text>
    </svg>
  );
};

interface RoleBadgeProps {
  role: DoudizhuRole;
  size?: 'sm' | 'md';
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'sm', className = '' }) => {
  const isLandlord = role === 'landlord';
  const isFarmer = role === 'farmer';

  const toneClass = isLandlord
    ? 'border-amber-300 bg-gradient-to-r from-rose-700 via-red-700 to-amber-700 text-amber-100 shadow-[0_2px_10px_rgba(220,38,38,0.45)]'
    : isFarmer
      ? 'border-emerald-300/80 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white shadow-[0_2px_10px_rgba(16,185,129,0.35)]'
      : 'border-slate-400/50 bg-slate-800/90 text-slate-200';

  const sizeClass =
    size === 'md'
      ? 'gap-1.5 px-2.5 py-1 text-xs sm:text-sm'
      : 'gap-1 px-2 py-0.5 text-[11px] sm:text-xs';

  const iconSize = size === 'md' ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4';

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border font-black tracking-wide whitespace-nowrap ${toneClass} ${sizeClass} ${className}`}
    >
      <RoleEmblemIcon role={role} className={iconSize} />
      <span>{isLandlord ? '地主' : isFarmer ? '农民' : '叫分中'}</span>
    </span>
  );
};

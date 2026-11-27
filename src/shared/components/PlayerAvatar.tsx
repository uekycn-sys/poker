import React from 'react';
import { AvatarStyleId } from '../store/playerStore';

interface PlayerAvatarProps {
  avatarId?: AvatarStyleId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
};

const PALETTE: Record<
  AvatarStyleId,
  { ring: string; bg: string; accent: string; emblem: 'crown' | 'spade' | 'diamond' | 'phoenix' }
> = {
  crown: { ring: '#f7d774', bg: '#064e3b', accent: '#d4af37', emblem: 'crown' },
  spade: { ring: '#cbd5e1', bg: '#0f172a', accent: '#f59e0b', emblem: 'spade' },
  diamond: { ring: '#38bdf8', bg: '#062c30', accent: '#fde047', emblem: 'diamond' },
  phoenix: { ring: '#fb7185', bg: '#3f0d1d', accent: '#fbbf24', emblem: 'phoenix' },
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatarId = 'crown',
  size = 'md',
  className = '',
}) => {
  const theme = PALETTE[avatarId] ?? PALETTE.crown;

  return (
    <svg
      viewBox="0 0 64 64"
      className={`${SIZE_MAP[size]} shrink-0 drop-shadow-md ${className}`}
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="29" fill={theme.bg} stroke={theme.ring} strokeWidth="2.5" />
      <circle
        cx="32"
        cy="32"
        r="24.5"
        fill="none"
        stroke={theme.accent}
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      {theme.emblem === 'crown' && (
        <g>
          <path
            d="M17 42 L20 25 L27.5 32 L32 20 L36.5 32 L44 25 L47 42 Z"
            fill={theme.accent}
            stroke="#fef08a"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <rect x="17" y="44" width="30" height="4" rx="2" fill={theme.ring} />
        </g>
      )}
      {theme.emblem === 'spade' && (
        <path
          d="M32 16 C25 25, 19 30, 19 36 C19 40, 22.5 43, 26.5 43 C28.5 43, 30.2 42, 31.2 40.5 C30.8 43.5, 29.6 46, 27.5 48 L36.5 48 C34.4 46, 33.2 43.5, 32.8 40.5 C33.8 42, 35.5 43, 37.5 43 C41.5 43, 45 40, 45 36 C45 30, 39 25, 32 16 Z"
          fill={theme.accent}
        />
      )}
      {theme.emblem === 'diamond' && (
        <g>
          <path d="M32 15 L46 32 L32 49 L18 32 Z" fill={theme.accent} />
          <path d="M32 21 L40 32 L32 43 L24 32 Z" fill={theme.bg} fillOpacity="0.4" />
        </g>
      )}
      {theme.emblem === 'phoenix' && (
        <g>
          <path
            d="M32 16 C26 24, 18 27, 17 36 C22 33, 27 35, 32 46 C37 35, 42 33, 47 36 C46 27, 38 24, 32 16 Z"
            fill={theme.accent}
          />
          <circle cx="32" cy="28" r="3" fill="#fffbeb" />
        </g>
      )}
    </svg>
  );
};

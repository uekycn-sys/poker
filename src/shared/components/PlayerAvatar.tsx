import React, { useId } from 'react';
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
  {
    ringStart: string;
    ringEnd: string;
    bgTop: string;
    bgBot: string;
    accent: string;
    accentLight: string;
    emblem: 'crown' | 'spade' | 'diamond' | 'phoenix';
  }
> = {
  crown: {
    ringStart: '#fef08a',
    ringEnd: '#b45309',
    bgTop: '#0b5c44',
    bgBot: '#022419',
    accent: '#eab308',
    accentLight: '#fef9c3',
    emblem: 'crown',
  },
  spade: {
    ringStart: '#f8fafc',
    ringEnd: '#475569',
    bgTop: '#1e293b',
    bgBot: '#090f1d',
    accent: '#f59e0b',
    accentLight: '#fde68a',
    emblem: 'spade',
  },
  diamond: {
    ringStart: '#bae6fd',
    ringEnd: '#0284c7',
    bgTop: '#0b3b44',
    bgBot: '#031921',
    accent: '#fde047',
    accentLight: '#fef9c3',
    emblem: 'diamond',
  },
  phoenix: {
    ringStart: '#fecdd3',
    ringEnd: '#be123c',
    bgTop: '#581226',
    bgBot: '#1d050c',
    accent: '#fbbf24',
    accentLight: '#fef08a',
    emblem: 'phoenix',
  },
};

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatarId = 'crown',
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const theme = PALETTE[avatarId] ?? PALETTE.crown;

  return (
    <svg
      viewBox="0 0 64 64"
      className={`${SIZE_MAP[size]} shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.ringStart} />
          <stop offset="50%" stopColor={theme.accent} />
          <stop offset="100%" stopColor={theme.ringEnd} />
        </linearGradient>
        <radialGradient id={`bg-${uid}`} cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor={theme.bgTop} />
          <stop offset="100%" stopColor={theme.bgBot} />
        </radialGradient>
      </defs>

      {/* Outer Metallic Beveled Frame */}
      <circle cx="32" cy="32" r="30" fill={`url(#bg-${uid})`} stroke={`url(#ring-${uid})`} strokeWidth="3" />
      <circle
        cx="32"
        cy="32"
        r="25.5"
        fill="none"
        stroke={theme.accentLight}
        strokeOpacity="0.28"
        strokeWidth="1"
        strokeDasharray="3 2"
      />
      {/* Top Glass Specular Arc */}
      <path d="M12 24 A22 22 0 0 1 52 24" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />

      {theme.emblem === 'crown' && (
        <g>
          <path
            d="M17 42 L20 24 L27.5 31.5 L32 18.5 L36.5 31.5 L44 24 L47 42 Z"
            fill={theme.accent}
            stroke={theme.accentLight}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="17" r="2.2" fill={theme.accentLight} />
          <rect x="17" y="44" width="30" height="4.2" rx="2" fill={`url(#ring-${uid})`} />
        </g>
      )}
      {theme.emblem === 'spade' && (
        <g>
          <path
            d="M32 15 C24.5 24.5, 18.5 30, 18.5 36 C18.5 40.2, 22.2 43.2, 26.5 43.2 C28.6 43.2, 30.3 42.1, 31.3 40.5 C30.8 43.8, 29.6 46.5, 27.2 48.5 L36.8 48.5 C34.4 46.5, 33.2 43.8, 32.7 40.5 C33.7 42.1, 35.4 43.2, 37.5 43.2 C41.8 43.2, 45.5 40.2, 45.5 36 C45.5 30, 39.5 24.5, 32 15 Z"
            fill={theme.accent}
            stroke={theme.accentLight}
            strokeWidth="1.1"
          />
          <path d="M32 27 L35 32 L32 37 L29 32 Z" fill={theme.bgBot} fillOpacity="0.55" />
        </g>
      )}
      {theme.emblem === 'diamond' && (
        <g>
          <path
            d="M32 14 L47 32 L32 50 L17 32 Z"
            fill={theme.accent}
            stroke={theme.accentLight}
            strokeWidth="1.2"
          />
          <path d="M32 21 L40 32 L32 43 L24 32 Z" fill={theme.bgBot} fillOpacity="0.45" />
          <path d="M32 25 L36 32 L32 39 L28 32 Z" fill={theme.accentLight} fillOpacity="0.7" />
        </g>
      )}
      {theme.emblem === 'phoenix' && (
        <g>
          <path
            d="M32 14 C25.5 23, 18 26.5, 16.5 36.5 C21.5 33, 27 35, 32 47 C37 35, 42.5 33, 47.5 36.5 C46 26.5, 38.5 23, 32 14 Z"
            fill={theme.accent}
            stroke={theme.accentLight}
            strokeWidth="1.1"
          />
          <circle cx="32" cy="27.5" r="3.2" fill={theme.accentLight} />
        </g>
      )}
    </svg>
  );
};

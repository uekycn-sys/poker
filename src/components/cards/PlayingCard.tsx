import React from 'react';
import { Card, Rank, Suit } from '../../engine';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  largeFont?: boolean;
  selected?: boolean;
  dragPreview?: boolean;
  coachRecommended?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps['size']>, string> = {
  xs: 'w-9 h-13 rounded-md',
  sm: 'w-12 h-17 rounded-lg',
  md: 'w-16 h-23 rounded-lg',
  lg: 'w-[76px] h-[108px] md:w-[86px] md:h-[122px] rounded-xl',
};

function getCornerRankLabel(rank: Rank): string {
  switch (rank) {
    case Rank.TEN:
      return '10';
    case Rank.JACK:
      return 'J';
    case Rank.QUEEN:
      return 'Q';
    case Rank.KING:
      return 'K';
    case Rank.ACE:
      return 'A';
    case Rank.TWO:
      return '2';
    case Rank.SMALL_JOKER:
      return 'JOKER';
    case Rank.BIG_JOKER:
      return 'JOKER';
    default:
      return String(rank);
  }
}

function SuitIcon({ suit, className = 'w-4 h-4' }: { suit: Exclude<Suit, 'joker'>; className?: string }) {
  switch (suit) {
    case 'spades':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 2C9 6.5 4 10.2 4 14.3c0 2.5 2 4.4 4.4 4.4 1.3 0 2.4-.6 3.1-1.5-.2 1.8-.9 3.3-2.2 4.3h5.4c-1.3-1-2-2.5-2.2-4.3.7.9 1.8 1.5 3.1 1.5 2.4 0 4.4-1.9 4.4-4.4C20 10.2 15 6.5 12 2z" />
        </svg>
      );
    case 'hearts':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'clubs':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 2.5a4.2 4.2 0 0 0-4.2 4.2c0 1.4.7 2.7 1.8 3.4a4.2 4.2 0 0 0-5.6 4c0 2.3 1.9 4.2 4.2 4.2 1.4 0 2.6-.7 3.3-1.7-.2 1.8-.9 3.4-2.1 4.4h5.2c-1.2-1-1.9-2.6-2.1-4.4.7 1 1.9 1.7 3.3 1.7 2.3 0 4.2-1.9 4.2-4.2a4.2 4.2 0 0 0-5.6-4c1.1-.7 1.8-2 1.8-3.4A4.2 4.2 0 0 0 12 2.5z" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 2L20.5 12 12 22 3.5 12 12 2z" />
        </svg>
      );
  }
}

function FaceCrownArt({ rank, isRed }: { rank: Rank; isRed: boolean }) {
  const accent = isRed ? '#b91c1c' : '#1e293b';
  const gold = '#d4af37';

  if (rank === Rank.SMALL_JOKER || rank === Rank.BIG_JOKER) {
    const isBig = rank === Rank.BIG_JOKER;
    return (
      <svg viewBox="0 0 64 64" className="w-8 h-8 md:w-10 md:h-10" aria-hidden="true">
        <defs>
          <linearGradient id={`jokerGrad-${rank}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isBig ? '#ef4444' : '#334155'} />
            <stop offset="100%" stopColor={isBig ? '#f59e0b' : '#64748b'} />
          </linearGradient>
        </defs>
        <path
          d="M12 46 L16 22 L26 32 L32 14 L38 32 L48 22 L52 46 Z"
          fill={`url(#jokerGrad-${rank})`}
          stroke={isBig ? '#991b1b' : '#1e293b'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="19" r="3.5" fill={isBig ? '#fbbf24' : '#94a3b8'} />
        <circle cx="32" cy="11" r="4" fill={isBig ? '#fbbf24' : '#cbd5e1'} />
        <circle cx="48" cy="19" r="3.5" fill={isBig ? '#fbbf24' : '#94a3b8'} />
        <rect x="12" y="48" width="40" height="5" rx="2.5" fill={gold} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className="w-8 h-8 md:w-10 md:h-10 opacity-90" aria-hidden="true">
      <rect x="14" y="12" width="36" height="40" rx="6" fill="none" stroke={gold} strokeWidth="2" />
      <path d="M20 38 L24 24 L32 30 L40 24 L44 38 Z" fill={accent} />
      <circle cx="32" cy="20" r="3" fill={gold} />
      <text
        x="32"
        y="49"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fill={accent}
      >
        {getCornerRankLabel(rank)}
      </text>
    </svg>
  );
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  size = 'lg',
  largeFont = false,
  selected = false,
  dragPreview = false,
  coachRecommended = false,
  className = '',
}) => {
  const sizeCls = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        className={`${sizeCls} relative select-none overflow-hidden border border-amber-300/60 bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 shadow-[0_6px_14px_rgba(0,0,0,0.45)] ${className}`}
      >
        <svg viewBox="0 0 80 112" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="cardBackLattice" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M6 0 L12 6 L6 12 L0 6 Z" fill="none" stroke="#d4af37" strokeOpacity="0.32" strokeWidth="0.9" />
            </pattern>
          </defs>
          <rect x="4" y="4" width="72" height="104" rx="5" fill="url(#cardBackLattice)" stroke="#d4af37" strokeOpacity="0.55" strokeWidth="1.2" />
          <circle cx="40" cy="56" r="14" fill="#064e3b" stroke="#f59e0b" strokeOpacity="0.65" strokeWidth="1.4" />
          <path d="M40 45 L49 56 L40 67 L31 56 Z" fill="#d4af37" fillOpacity="0.7" />
        </svg>
      </div>
    );
  }

  const isJoker = card.suit === 'joker';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds' || card.rank === Rank.BIG_JOKER;
  const colorCls = isRed ? 'text-rose-600' : 'text-slate-900';
  const label = getCornerRankLabel(card.rank);
  const isFaceOrJoker = card.rank >= Rank.JACK || isJoker;

  const borderGlow = selected
    ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_14px_26px_rgba(245,158,11,0.38)]'
    : dragPreview
      ? 'ring-2 ring-sky-400 border-sky-300 shadow-[0_10px_20px_rgba(56,189,248,0.3)]'
      : coachRecommended
        ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-[0_10px_22px_rgba(52,211,153,0.4)]'
        : 'border-slate-300/90 shadow-[0_6px_16px_rgba(0,0,0,0.42)]';

  const cornerTextSize =
    size === 'xs'
      ? 'text-[10px]'
      : size === 'sm'
        ? 'text-xs'
        : largeFont
          ? 'text-lg md:text-xl'
          : 'text-sm md:text-base';

  return (
    <div
      className={`${sizeCls} ${borderGlow} relative select-none overflow-hidden border bg-gradient-to-b from-[#fffdf8] via-[#fcfaf2] to-[#f3ede0] transition-shadow ${className}`}
    >
      {/* Subtle inner frame */}
      <div className="pointer-events-none absolute inset-[3px] rounded-[inherit] border border-amber-900/10" />

      {/* Coach badge */}
      {coachRecommended && size === 'lg' && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold text-white shadow">
          荐
        </span>
      )}

      {/* Top-left rank & suit */}
      <div className={`absolute left-1.5 top-1 flex flex-col items-center leading-none ${colorCls}`}>
        {isJoker ? (
          <div className="flex flex-col items-center text-[8px] md:text-[9px] font-black tracking-tighter leading-[0.95]">
            {'JOKER'.split('').map((ch, idx) => (
              <span key={idx}>{ch}</span>
            ))}
          </div>
        ) : (
          <>
            <span className={`${cornerTextSize} font-extrabold tracking-tighter`}>{label}</span>
            <SuitIcon
              suit={card.suit as Exclude<Suit, 'joker'>}
              className={size === 'xs' ? 'w-2.5 h-2.5 mt-0.5' : largeFont ? 'w-4 h-4 mt-0.5' : 'w-3 h-3 md:w-3.5 md:h-3.5 mt-0.5'}
            />
          </>
        )}
      </div>

      {/* Center artwork */}
      <div className={`flex h-full w-full items-center justify-center ${colorCls}`}>
        {isFaceOrJoker ? (
          size === 'xs' ? (
            <span className="text-[11px] font-black">
              {card.rank === Rank.BIG_JOKER ? '王' : card.rank === Rank.SMALL_JOKER ? '鬼' : label}
            </span>
          ) : (
            <div className="flex flex-col items-center">
              <FaceCrownArt rank={card.rank} isRed={isRed} />
              {isJoker && size === 'lg' && (
                <span className="mt-0.5 text-[10px] font-bold tracking-wider">
                  {card.rank === Rank.BIG_JOKER ? '大王' : '小王'}
                </span>
              )}
            </div>
          )
        ) : (
          <SuitIcon
            suit={card.suit as Exclude<Suit, 'joker'>}
            className={
              size === 'xs'
                ? 'w-3.5 h-3.5'
                : size === 'sm'
                  ? 'w-5 h-5'
                  : largeFont
                    ? 'w-8 h-8 md:w-9 md:h-9'
                    : 'w-6 h-6 md:w-8 md:h-8'
            }
          />
        )}
      </div>

      {/* Bottom-right mirrored index on large cards */}
      {size === 'lg' && !isJoker && (
        <div className={`absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none opacity-80 ${colorCls}`}>
          <span className={`${largeFont ? 'text-base' : 'text-xs'} font-extrabold tracking-tighter`}>{label}</span>
          <SuitIcon suit={card.suit as Exclude<Suit, 'joker'>} className="mt-0.5 w-3 h-3" />
        </div>
      )}
    </div>
  );
};

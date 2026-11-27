import React, { useId } from 'react';
import { CardCornerBadge, CardSuit, PlayingCardData } from './types';

export interface PlayingCardProps {
  card?: PlayingCardData;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  largeFont?: boolean;
  selected?: boolean;
  dragPreview?: boolean;
  coachRecommended?: boolean;
  isWild?: boolean;
  wildLabel?: string;
  deckIndex?: number;
  showDeckMarker?: boolean;
  cornerBadge?: CardCornerBadge;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps['size']>, string> = {
  xs: 'w-[var(--card-xs-w)] h-[var(--card-xs-h)] rounded-[6px]',
  sm: 'w-[var(--card-sm-w)] h-[var(--card-sm-h)] rounded-lg',
  md: 'w-[var(--card-md-w)] h-[var(--card-md-h)] rounded-[10px]',
  lg: 'w-[var(--card-lg-w)] h-[var(--card-lg-h)] rounded-xl',
};

const BADGE_TONE_CLASSES: Record<NonNullable<CardCornerBadge['tone']>, string> = {
  gold: 'bg-gradient-to-br from-amber-300 to-amber-500 text-emerald-950 border-amber-200/80',
  emerald: 'bg-emerald-600 text-white border-emerald-300/60',
  crimson: 'bg-rose-600 text-white border-rose-300/60',
  sky: 'bg-sky-500 text-slate-950 border-sky-200/70',
};

const DECK_MARKERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

function getCornerRankLabel(rank: number): string {
  switch (rank) {
    case 1:
    case 14:
      return 'A';
    case 2:
    case 15:
      return '2';
    case 10:
      return '10';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 16:
    case 17:
      return 'JOKER';
    default:
      return String(rank);
  }
}

function SuitIcon({
  suit,
  className = 'w-4 h-4',
}: {
  suit: Exclude<CardSuit, 'joker'>;
  className?: string;
}) {
  switch (suit) {
    case 'spades':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 1.8C8.8 6.4 3.8 10.2 3.8 14.3c0 2.6 2 4.5 4.5 4.5 1.3 0 2.4-.6 3.1-1.5-.2 1.8-.9 3.4-2.3 4.5h5.8c-1.4-1.1-2.1-2.7-2.3-4.5.7.9 1.8 1.5 3.1 1.5 2.5 0 4.5-1.9 4.5-4.5C20.2 10.2 15.2 6.4 12 1.8z" />
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
          <path d="M12 2.4a4.2 4.2 0 0 0-4.2 4.2c0 1.4.7 2.7 1.8 3.4a4.2 4.2 0 0 0-5.6 4c0 2.3 1.9 4.2 4.2 4.2 1.4 0 2.6-.7 3.3-1.7-.2 1.8-.9 3.4-2.1 4.5h5.2c-1.2-1.1-1.9-2.7-2.1-4.5.7 1 1.9 1.7 3.3 1.7 2.3 0 4.2-1.9 4.2-4.2a4.2 4.2 0 0 0-5.6-4c1.1-.7 1.8-2 1.8-3.4A4.2 4.2 0 0 0 12 2.4z" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 1.8L20.8 12 12 22.2 3.2 12 12 1.8z" />
        </svg>
      );
  }
}

function JokerCrownSvg({
  isBig,
  gradId,
  className,
}: {
  isBig: boolean;
  gradId: string;
  className: string;
}) {
  const bandFill = isBig ? '#d4af37' : '#94a3b8';
  const bandStroke = isBig ? '#92400e' : '#1e293b';
  const bellFill = isBig ? '#d4af37' : '#cbd5e1';
  const centerBellFill = isBig ? '#fde047' : '#e2e8f0';
  const bellStroke = isBig ? '#78350f' : '#334155';

  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isBig ? '#ef4444' : '#334155'} />
          <stop offset="55%" stopColor={isBig ? '#f59e0b' : '#64748b'} />
          <stop offset="100%" stopColor={isBig ? '#b91c1c' : '#0f172a'} />
        </linearGradient>
      </defs>
      {/* Radiant Halo */}
      <circle
        cx="36"
        cy="36"
        r="28"
        fill="none"
        stroke={isBig ? '#f59e0b' : '#94a3b8'}
        strokeOpacity="0.32"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />
      {/* Jester 3-Horn Crown */}
      <path
        d="M14 48 C15 33, 21 23, 14 15 C22 19, 28 28, 30 34 C32 23, 34 15, 36 10 C38 15, 40 23, 42 34 C44 28, 50 19, 58 15 C51 23, 57 33, 58 48 Z"
        fill={`url(#${gradId})`}
        stroke={isBig ? '#991b1b' : '#0f172a'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Jester Bells */}
      <circle cx="14" cy="14" r="3.6" fill={bellFill} stroke={bellStroke} strokeWidth="1" />
      <circle cx="36" cy="9.5" r="4.2" fill={centerBellFill} stroke={bellStroke} strokeWidth="1" />
      <circle cx="58" cy="14" r="3.6" fill={bellFill} stroke={bellStroke} strokeWidth="1" />
      {/* Crown Band & Diamond */}
      <rect x="13" y="48" width="46" height="6.5" rx="3" fill={bandFill} stroke={bandStroke} strokeWidth="1" />
      <path
        d="M36 44 L40 51.2 L36 58 L32 51.2 Z"
        fill={isBig ? '#e11d48' : '#0f172a'}
        stroke={isBig ? '#fef08a' : '#e2e8f0'}
        strokeWidth="1"
      />
    </svg>
  );
}

function RoyalCourtArtwork({
  rank,
  suit,
  isRed,
  gradId,
  size,
}: {
  rank: number;
  suit: CardSuit;
  isRed: boolean;
  gradId: string;
  size: NonNullable<PlayingCardProps['size']>;
}) {
  const accent = isRed ? '#be123c' : '#0f172a';
  const secondary = isRed ? '#fb7185' : '#334155';
  const gold = '#d4af37';

  // Jokers: Color Red/Gold (Big Joker) vs Monochrome Black/Silver (Small Joker), zero Chinese text
  if (rank === 16 || rank === 17) {
    const isBig = rank === 17;
    return (
      <JokerCrownSvg
        isBig={isBig}
        gradId={gradId}
        className={
          size === 'sm'
            ? 'h-6 w-6 short-h:h-5 short-h:w-5'
            : size === 'md'
              ? 'h-9 w-9 short-h:h-8 short-h:w-8'
              : 'h-12 w-12 md:h-14 md:w-14 short-h:h-9 short-h:w-9'
        }
      />
    );
  }

  // Ace of Spades Ornate Centerpiece
  if ((rank === 1 || rank === 14) && suit === 'spades') {
    return (
      <svg
        viewBox="0 0 72 72"
        className={size === 'sm' ? 'h-8 w-8' : size === 'md' ? 'h-11 w-11' : 'h-13 w-13 md:h-15 md:w-15'}
        aria-hidden="true"
      >
        <circle cx="36" cy="36" r="24" fill="none" stroke={gold} strokeOpacity="0.45" strokeWidth="1.4" />
        <circle cx="36" cy="36" r="20" fill="none" stroke="#0f172a" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="2 2" />
        <path
          d="M36 14 C27 25, 19 32, 19 40 C19 45.5, 23 49.5, 28.5 49.5 C31.5 49.5, 33.8 48, 35 46 C34.4 50.5, 32.8 54, 29.5 56.5 L42.5 56.5 C39.2 54, 37.6 50.5, 37 46 C38.2 48, 40.5 49.5, 43.5 49.5 C49 49.5, 53 45.5, 53 40 C53 32, 45 25, 36 14 Z"
          fill="#0f172a"
          stroke={gold}
          strokeWidth="1.2"
        />
        <path d="M36 27 L39.5 34 L36 41 L32.5 34 Z" fill={gold} fillOpacity="0.85" />
      </svg>
    );
  }

  // Court Cards (J, Q, K) with Ornate Gold-Trimmed Medallion
  return (
    <svg
      viewBox="0 0 72 88"
      className={size === 'sm' ? 'h-8 w-7' : size === 'md' ? 'h-12 w-10' : 'h-15 w-12 md:h-17 md:w-14'}
      aria-hidden="true"
    >
      {/* Inner Gold Court Frame */}
      <rect
        x="8"
        y="8"
        width="56"
        height="72"
        rx="6"
        fill={isRed ? 'rgba(225,29,72,0.05)' : 'rgba(15,23,42,0.05)'}
        stroke={gold}
        strokeWidth="1.6"
      />
      <rect
        x="11"
        y="11"
        width="50"
        height="66"
        rx="4"
        fill="none"
        stroke={accent}
        strokeOpacity="0.22"
        strokeWidth="0.9"
      />
      {/* Corner Flourishes */}
      <circle cx="13" cy="13" r="1.5" fill={gold} />
      <circle cx="59" cy="13" r="1.5" fill={gold} />
      <circle cx="13" cy="75" r="1.5" fill={gold} />
      <circle cx="59" cy="75" r="1.5" fill={gold} />

      {rank === 13 && (
        // KING: Imperial Crown & Crossed Scepters
        <g>
          <path d="M22 60 L50 28 M50 60 L22 28" stroke={gold} strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
          <path
            d="M19 46 L23 26 L31 35 L36 20 L41 35 L49 26 L53 46 Z"
            fill={accent}
            stroke={gold}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="36" cy="18" r="2.8" fill={gold} />
          <circle cx="23" cy="24" r="2.2" fill={gold} />
          <circle cx="49" cy="24" r="2.2" fill={gold} />
          <rect x="19" y="47" width="34" height="5" rx="2" fill={gold} />
          <circle cx="36" cy="49.5" r="2" fill={secondary} />
        </g>
      )}

      {rank === 12 && (
        // QUEEN: Royal Tiara & Floral Crest
        <g>
          <path
            d="M21 47 C22 36, 26 27, 36 21 C46 27, 50 36, 51 47 Z"
            fill="none"
            stroke={gold}
            strokeWidth="1.6"
          />
          <path
            d="M20 46 L25 30 L32 37 L36 24 L40 37 L47 30 L52 46 Z"
            fill={accent}
            stroke={gold}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M36 33 L40 39 L36 45 L32 39 Z" fill="#fef08a" />
          <circle cx="36" cy="22" r="2.6" fill={secondary} stroke={gold} strokeWidth="1" />
          <rect x="20" y="47" width="32" height="4.5" rx="2.2" fill={gold} />
        </g>
      )}

      {rank === 11 && (
        // JACK: Knight Shield & Plumed Crest
        <g>
          <path
            d="M24 23 L48 23 L48 41 C48 51, 36 57, 36 57 C36 57, 24 51, 24 41 Z"
            fill={accent}
            stroke={gold}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M36 25 L36 54 M26 37 L46 37" stroke={gold} strokeWidth="1.6" />
          <circle cx="36" cy="37" r="4" fill={secondary} stroke="#fef08a" strokeWidth="1.1" />
        </g>
      )}

      <text
        x="36"
        y="69"
        textAnchor="middle"
        fontSize="12"
        fontWeight="900"
        fill={accent}
        letterSpacing="1"
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
  isWild,
  wildLabel,
  deckIndex,
  showDeckMarker = false,
  cornerBadge,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const sizeCls = SIZE_CLASSES[size];
  const resolvedDeck = deckIndex ?? card?.deckIndex;
  const deckMarkerText =
    resolvedDeck && resolvedDeck >= 1
      ? DECK_MARKERS[resolvedDeck - 1] ?? `D${resolvedDeck}`
      : null;

  if (faceDown || !card) {
    const isAltDeck = (resolvedDeck ?? 1) % 2 === 0;
    const backGradCls = isAltDeck
      ? 'from-[#7f1d1d] via-[#4c0519] to-[#1f0610]'
      : 'from-[#065f46] via-[#064e3b] to-[#022c22]';
    const centerFill = isAltDeck ? '#4c0519' : '#064e3b';

    return (
      <div
        className={`${sizeCls} relative select-none overflow-hidden border border-amber-300/75 bg-gradient-to-br ${backGradCls} shadow-[0_2px_0_rgba(120,85,20,0.7),0_7px_16px_rgba(0,0,0,0.52)] ${className}`}
      >
        <svg viewBox="0 0 80 112" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id={`cardBack-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M5 0 L10 5 L5 10 L0 5 Z"
                fill="none"
                stroke="#f5d061"
                strokeOpacity="0.28"
                strokeWidth="0.8"
              />
              <circle cx="5" cy="5" r="0.9" fill="#f5d061" fillOpacity="0.25" />
            </pattern>
            <linearGradient id={`cardBackGloss-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
            </linearGradient>
          </defs>
          <rect
            x="3.5"
            y="3.5"
            width="73"
            height="105"
            rx="5"
            fill={`url(#cardBack-${uid})`}
            stroke="#e8c35a"
            strokeOpacity="0.65"
            strokeWidth="1.2"
          />
          <rect
            x="6.5"
            y="6.5"
            width="67"
            height="99"
            rx="3.5"
            fill="none"
            stroke="#fde68a"
            strokeOpacity="0.32"
            strokeWidth="0.7"
          />
          {/* Central Casino Medallion */}
          <circle
            cx="40"
            cy="56"
            r="15"
            fill={centerFill}
            stroke="#f59e0b"
            strokeOpacity="0.8"
            strokeWidth="1.5"
          />
          <circle
            cx="40"
            cy="56"
            r="11.5"
            fill="none"
            stroke="#fde68a"
            strokeOpacity="0.45"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
          />
          <path d="M40 44 L49 56 L40 68 L31 56 Z" fill="#e8c35a" fillOpacity="0.82" />
          <circle cx="40" cy="56" r="3" fill={centerFill} />
          <rect x="0" y="0" width="80" height="112" fill={`url(#cardBackGloss-${uid})`} />
        </svg>
        {showDeckMarker && deckMarkerText && (
          <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[9px] font-bold text-amber-200">
            {deckMarkerText}
          </span>
        )}
      </div>
    );
  }

  const isJoker = card.suit === 'joker';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds' || card.rank === 17;
  const colorCls = isRed ? 'text-[#d90429]' : 'text-[#09090b]';
  const label = getCornerRankLabel(card.rank);
  const showRoyalArt =
    isJoker ||
    card.rank === 11 ||
    card.rank === 12 ||
    card.rank === 13 ||
    ((card.rank === 1 || card.rank === 14) && card.suit === 'spades');

  const wildActive = isWild ?? Boolean(card.isWild);
  const resolvedWildLabel = wildLabel ?? card.wildLabel ?? '百搭';
  const resolvedBadge: CardCornerBadge | null = cornerBadge
    ? cornerBadge
    : wildActive
      ? { text: resolvedWildLabel, tone: 'gold' }
      : coachRecommended
        ? { text: '荐', tone: 'emerald' }
        : card.badge
          ? { text: card.badge, tone: 'sky' }
          : null;

  const borderGlow = selected
    ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_3px_0_rgba(180,83,9,0.75),0_14px_26px_rgba(245,158,11,0.5)]'
    : dragPreview
      ? 'ring-2 ring-sky-400 border-sky-300 shadow-[0_2px_0_rgba(14,116,144,0.6),0_12px_22px_rgba(56,189,248,0.35)]'
      : coachRecommended
        ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-[0_2px_0_rgba(4,120,87,0.6),0_12px_22px_rgba(52,211,153,0.42)]'
        : wildActive
          ? 'ring-2 ring-amber-300/90 border-amber-400 shadow-[0_2px_0_rgba(180,83,9,0.65),0_10px_20px_rgba(212,175,55,0.42)]'
          : 'border-slate-300/95 shadow-[0_2px_0_rgba(148,163,184,0.85),0_7px_16px_rgba(0,0,0,0.46)]';

  const cornerTextSize =
    size === 'xs'
      ? 'text-[10px]'
      : size === 'sm'
        ? largeFont
          ? 'text-xs leading-none'
          : 'text-[11px] leading-none'
        : size === 'md'
          ? largeFont
            ? 'text-base short-h:text-[13px] leading-none'
            : 'text-[13px] sm:text-sm leading-none'
          : largeFont
            ? 'text-lg sm:text-xl short-h:text-[15px] leading-none'
            : 'text-[14px] sm:text-[15px] short-h:text-[13px] leading-none';

  const jokerCornerTextSize =
    size === 'xs'
      ? 'text-[7px]'
      : size === 'sm'
        ? 'text-[6px] sm:text-[6.5px] short-h:text-[5.5px] leading-[0.88]'
        : size === 'md'
          ? 'text-[7.5px] sm:text-[8.5px] short-h:text-[6.5px] leading-[0.92]'
          : largeFont
            ? 'text-[9px] sm:text-[10px] short-h:text-[8px] leading-[0.94]'
            : 'text-[8px] sm:text-[9px] short-h:text-[7.5px] leading-[0.94]';

  if (size === 'xs') {
    const isBig = card.rank === 17;
    return (
      <div
        className={`${sizeCls} ${borderGlow} relative select-none overflow-hidden border bg-gradient-to-b ${
          wildActive
            ? 'from-[#fff9e6] via-[#fef3c7] to-[#fde68a]'
            : 'from-[#ffffff] via-[#fdfbf5] to-[#f1eadc]'
        } transition-shadow ${className}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/75 to-transparent" />
        <div
          className={`pointer-events-none absolute inset-[1.5px] rounded-[inherit] border ${
            wildActive ? 'border-amber-600/35' : 'border-amber-900/10'
          }`}
        />
        <div
          className={`relative z-10 flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5 leading-none ${colorCls}`}
        >
          {isJoker ? (
            <>
              <JokerCrownSvg
                isBig={isBig}
                gradId={`jokerGradXs-${uid}`}
                className="h-4 w-4 short-h:h-3.5 short-h:w-3.5"
              />
              <span className="text-[7px] short-h:text-[6.5px] font-black leading-none tracking-tighter">
                JOKER
              </span>
            </>
          ) : (
            <>
              <span
                className={`${
                  largeFont ? 'text-[14px] short-h:text-[13px]' : 'text-[13px] short-h:text-[12px]'
                } font-black leading-none tracking-tighter`}
              >
                {label}
              </span>
              <SuitIcon
                suit={card.suit as Exclude<CardSuit, 'joker'>}
                className="h-3.5 w-3.5 short-h:h-3 short-h:w-3"
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${sizeCls} ${borderGlow} relative select-none overflow-hidden border bg-gradient-to-b ${
        wildActive
          ? 'from-[#fff9e6] via-[#fef3c7] to-[#fde68a]'
          : 'from-[#ffffff] via-[#fdfbf5] to-[#f1eadc]'
      } transition-shadow ${className}`}
    >
      {/* Top glossy paper highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/75 to-transparent" />

      {/* Subtle inner frame */}
      <div
        className={`pointer-events-none absolute inset-[2.5px] rounded-[inherit] border ${
          wildActive ? 'border-amber-600/35' : 'border-amber-900/10'
        }`}
      />

      {/* Top-right badge (Wild / Coach / Custom) */}
      {resolvedBadge && (
        <span
          className={`absolute right-1 top-1 z-10 rounded border px-1 py-0.5 text-[9px] font-black leading-none shadow ${
            BADGE_TONE_CLASSES[resolvedBadge.tone ?? 'gold']
          }`}
        >
          {resolvedBadge.text}
        </span>
      )}

      {/* Multi-deck marker */}
      {showDeckMarker && deckMarkerText && (
        <span className="absolute bottom-1 left-1 z-10 rounded bg-slate-900/10 px-1 text-[9px] font-bold text-slate-600">
          {deckMarkerText}
        </span>
      )}

      {/* Top-left rank & suit */}
      <div className={`absolute left-1 top-1 flex flex-col items-center leading-none ${colorCls}`}>
        {isJoker ? (
          <div className={`flex flex-col items-center ${jokerCornerTextSize} font-black`}>
            {['J', 'O', 'K', 'E', 'R'].map((ch, idx) => (
              <span key={idx}>{ch}</span>
            ))}
          </div>
        ) : (
          <>
            <span className={`${cornerTextSize} font-black tracking-tighter`}>{label}</span>
            <SuitIcon
              suit={card.suit as Exclude<CardSuit, 'joker'>}
              className={
                largeFont
                  ? 'mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 short-h:h-3 short-h:w-3'
                  : 'mt-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3'
              }
            />
          </>
        )}
      </div>

      {/* Center artwork */}
      <div
        className={`flex h-full w-full items-center justify-center ${
          size === 'sm' ? 'pl-2 pt-2' : ''
        } ${colorCls}`}
      >
        {showRoyalArt ? (
          <RoyalCourtArtwork
            rank={card.rank}
            suit={card.suit}
            isRed={isRed}
            gradId={`jokerGrad-${uid}`}
            size={size}
          />
        ) : (
          <SuitIcon
            suit={card.suit as Exclude<CardSuit, 'joker'>}
            className={
              size === 'sm'
                ? 'h-3.5 w-3.5 sm:h-4 sm:w-4'
                : largeFont
                  ? 'h-7 w-7 sm:h-8 sm:w-8'
                  : 'h-5 w-5 sm:h-7 sm:w-7'
            }
          />
        )}
      </div>

      {/* Bottom-right mirrored index on large cards */}
      {size === 'lg' && (
        <div
          className={`absolute bottom-1 right-1 flex rotate-180 flex-col items-center leading-none opacity-85 ${colorCls}`}
        >
          {isJoker ? (
            <div className={`flex flex-col items-center ${jokerCornerTextSize} font-black`}>
              {['J', 'O', 'K', 'E', 'R'].map((ch, idx) => (
                <span key={idx}>{ch}</span>
              ))}
            </div>
          ) : (
            <>
              <span className={`${largeFont ? 'text-sm sm:text-base' : 'text-[11px] sm:text-xs'} font-black tracking-tighter`}>
                {label}
              </span>
              <SuitIcon suit={card.suit as Exclude<CardSuit, 'joker'>} className="mt-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </>
          )}
        </div>
      )}
    </div>
  );
};

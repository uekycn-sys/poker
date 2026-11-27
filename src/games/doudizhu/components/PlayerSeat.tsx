import React, { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, GamePhase, Seat, sortCardsByRank } from '../engine';
import { PlayingCard } from '../../../shared/cards/PlayingCard';

interface PlayerSeatProps {
  seat: Seat;
  name: string;
  align: 'left' | 'right';
  isLandlord: boolean;
  isCurrentTurn: boolean;
  isThinking: boolean;
  isMingpai: boolean;
  phase: GamePhase;
  cards: Card[];
  bubble: string | null;
  doubleChoice: number | null;
}

function CharacterPortraitSvg({ isLandlord }: { isLandlord: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 68 68"
      className="h-11 w-11 sm:h-13 sm:w-13 md:h-14 md:w-14 shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`frame-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isLandlord ? '#fef08a' : '#a7f3d0'} />
          <stop offset="50%" stopColor={isLandlord ? '#eab308' : '#10b981'} />
          <stop offset="100%" stopColor={isLandlord ? '#92400e' : '#064e3b'} />
        </linearGradient>
        <radialGradient id={`bg-${uid}`} cx="40%" cy="30%" r="72%">
          <stop offset="0%" stopColor={isLandlord ? '#78350f' : '#065f46'} />
          <stop offset="100%" stopColor={isLandlord ? '#290f04' : '#022419'} />
        </radialGradient>
      </defs>

      {/* Beveled Medallion Frame */}
      <circle cx="34" cy="34" r="31" fill={`url(#bg-${uid})`} stroke={`url(#frame-${uid})`} strokeWidth="3" />
      <circle cx="34" cy="34" r="27" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />

      {/* Shoulders & Silk/Tunic Collar */}
      <path
        d="M14 58 C17 44, 51 44, 54 58 Z"
        fill={isLandlord ? '#991b1b' : '#047857'}
        stroke={isLandlord ? '#fbbf24' : '#6ee7b7'}
        strokeWidth="1.2"
      />
      <path
        d="M27 46 L34 53 L41 46"
        fill="none"
        stroke={isLandlord ? '#fde68a' : '#f43f5e'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Face */}
      <circle cx="34" cy="32" r="11.5" fill="#fde68a" stroke="#d97706" strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="29.5" cy="31" r="1.5" fill="#1e293b" />
      <circle cx="38.5" cy="31" r="1.5" fill="#1e293b" />
      <path d="M27.5 28 Q29.5 26.5 31.5 28" fill="none" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M36.5 28 Q38.5 26.5 40.5 28" fill="none" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M30.5 36.5 Q34 39.5 37.5 36.5" fill="none" stroke="#92400e" strokeWidth="1.4" strokeLinecap="round" />

      {isLandlord ? (
        /* Embroidered Landlord Silk Cap with Ruby/Gold Jewel */
        <g>
          <path
            d="M19 24 C20 14, 48 14, 49 24 Z"
            fill="#1e293b"
            stroke="#fbbf24"
            strokeWidth="1.5"
          />
          <rect x="18" y="21.5" width="32" height="4.2" rx="2" fill="#b45309" stroke="#fde047" strokeWidth="0.9" />
          <circle cx="34" cy="18.5" r="3" fill="#e11d48" stroke="#fef08a" strokeWidth="1.1" />
        </g>
      ) : (
        /* Farmer Woven Golden Straw Hat */
        <g>
          <ellipse cx="34" cy="22.5" rx="19" ry="4.2" fill="#fcd34d" stroke="#b45309" strokeWidth="1.2" />
          <path d="M23 21.5 L26.5 13 L41.5 13 L45 21.5 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
          <path d="M24.5 19.5 L43.5 19.5" stroke="#dc2626" strokeWidth="1.8" />
        </g>
      )}
    </svg>
  );
}

function MiniCardStack({ count }: { count: number }) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Layered mini card-back stack */}
      <div className="relative h-9 w-7 sm:h-11 sm:w-8">
        <div className="absolute -left-0.5 -top-0.5 h-full w-full rounded-md border border-amber-300/45 bg-emerald-900 shadow" />
        <div className="relative flex h-full w-full items-center justify-center rounded-md border border-amber-300/80 bg-gradient-to-br from-emerald-800 via-emerald-950 to-black shadow-md">
          <span className="font-mono text-xs sm:text-sm font-black text-amber-200 drop-shadow">
            {count}
          </span>
        </div>
      </div>
    </div>
  );
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  seat,
  name,
  align,
  isLandlord,
  isCurrentTurn,
  isThinking,
  isMingpai,
  phase,
  cards,
  bubble,
  doubleChoice,
}) => {
  const cardCount = cards.length;
  const isAlarm = phase === 'PLAYING' && (cardCount === 1 || cardCount === 2);

  return (
    <div
      className={`relative flex flex-col ${align === 'left' ? 'items-start' : 'items-end'} gap-1.5`}
    >
      <div
        className={`relative flex items-center gap-2 rounded-2xl border px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur-md transition-all ${
          isCurrentTurn
            ? 'border-amber-300 bg-emerald-900/90 shadow-[0_0_24px_rgba(251,191,36,0.42)] ring-2 ring-amber-400/65'
            : 'border-amber-500/25 bg-black/55 shadow-xl'
        } ${align === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}
      >
        {/* Portrait + Turn Ring + Siren */}
        <div className="relative shrink-0">
          {isCurrentTurn && (
            <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-amber-300/80 animate-pulse" />
          )}
          <CharacterPortraitSvg isLandlord={isLandlord} />
          {isAlarm && (
            <span
              className="siren-pulse absolute -right-1.5 -top-1.5 flex h-5 items-center rounded-full border border-rose-200 bg-rose-600 px-1.5 text-[9px] font-black text-white shadow"
              title="报牌警报"
            >
              {cardCount === 1 ? '报单' : '报双'}
            </span>
          )}
        </div>

        {/* Name + Identity + Mini Card Count Stack */}
        <div className="min-w-[74px] sm:min-w-[90px]">
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
            <span className="truncate text-[11px] sm:text-xs font-black text-amber-50">{name}</span>
          </div>

          <div
            className={`mt-0.5 flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}
          >
            <span
              className={`rounded-full border px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black ${
                isLandlord
                  ? 'border-amber-400/50 bg-amber-400/20 text-amber-300'
                  : 'border-emerald-400/35 bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isLandlord ? '地主' : seat === 1 ? '下家' : '上家'}
            </span>
            {doubleChoice && doubleChoice > 1 && (
              <span className="rounded bg-rose-500/30 px-1 py-0.2 text-[9px] font-black text-rose-200">
                ×{doubleChoice}
              </span>
            )}
          </div>

          {isThinking && (
            <div className="mt-0.5 animate-pulse text-[10px] font-bold text-amber-300">
              思考中…
            </div>
          )}
        </div>

        <MiniCardStack count={cardCount} />
      </div>

      {/* Speech Callout Bubble */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.78, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`rounded-xl border border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-1 text-[11px] sm:text-xs font-black text-emerald-950 shadow-lg ${
              align === 'left' ? 'ml-2' : 'mr-2'
            }`}
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mingpai Open Hand */}
      {isMingpai && cards.length > 0 && (
        <div className="flex max-w-[175px] sm:max-w-[210px] flex-wrap gap-0.5 rounded-xl border border-amber-400/35 bg-black/50 p-1 backdrop-blur-sm">
          {sortCardsByRank(cards).map((c) => (
            <PlayingCard key={c.id} card={c} size="xs" />
          ))}
        </div>
      )}
    </div>
  );
};

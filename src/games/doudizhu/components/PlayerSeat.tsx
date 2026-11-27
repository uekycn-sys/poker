import React from 'react';
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

function AvatarSvg({ isLandlord }: { isLandlord: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12 md:h-14 md:w-14" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="30"
        fill={isLandlord ? '#451a03' : '#064e3b'}
        stroke={isLandlord ? '#fbbf24' : '#34d399'}
        strokeWidth="2.5"
      />
      <path d="M14 54 C16 42, 48 42, 50 54 Z" fill={isLandlord ? '#b45309' : '#047857'} />
      <circle cx="32" cy="30" r="11" fill="#fde68a" />
      <circle cx="28" cy="29" r="1.4" fill="#1e293b" />
      <circle cx="36" cy="29" r="1.4" fill="#1e293b" />
      <path
        d="M29 34 Q32 37 35 34"
        fill="none"
        stroke="#92400e"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {isLandlord ? (
        <>
          <path
            d="M18 22 L46 22 L43 13 L21 13 Z"
            fill="#1e293b"
            stroke="#fbbf24"
            strokeWidth="1.4"
          />
          <circle cx="32" cy="17.5" r="2.5" fill="#fbbf24" />
        </>
      ) : (
        <>
          <ellipse
            cx="32"
            cy="21"
            rx="17"
            ry="3.8"
            fill="#fcd34d"
            stroke="#b45309"
            strokeWidth="1.2"
          />
          <path d="M23 20 L26 12 L38 12 L41 20 Z" fill="#f59e0b" />
        </>
      )}
    </svg>
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
      className={`relative flex flex-col ${align === 'left' ? 'items-start' : 'items-end'} gap-2`}
    >
      <AnimatePresence>
        {bubble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`rounded-xl border border-amber-300/60 bg-amber-400 px-3 py-1 text-xs font-black text-emerald-950 shadow-lg ${
              align === 'left' ? 'ml-2' : 'mr-2'
            }`}
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`relative flex items-center gap-2.5 rounded-2xl border px-3 py-2 backdrop-blur-md transition-all ${
          isCurrentTurn
            ? 'border-amber-300 bg-emerald-900/90 shadow-[0_0_24px_rgba(251,191,36,0.35)]'
            : 'border-amber-500/25 bg-emerald-950/75 shadow-lg'
        } ${align === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}
      >
        <div className="relative">
          <AvatarSvg isLandlord={isLandlord} />
          {isAlarm && (
            <span
              className="siren-pulse absolute -right-1 -top-1 flex h-5 items-center gap-0.5 rounded-full border border-rose-200 bg-rose-600 px-1.5 text-[10px] font-black text-white shadow"
              title="警报"
            >
              {cardCount === 1 ? '报单' : '报双'}
            </span>
          )}
        </div>

        <div className="min-w-[82px]">
          <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
            <span className="text-xs md:text-sm font-bold text-amber-50">{name}</span>
          </div>

          <div
            className={`mt-1 flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}
          >
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isLandlord
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {isLandlord ? '地主' : seat === 1 ? '下家农民' : '上家农民'}
            </span>
            {doubleChoice && doubleChoice > 1 && (
              <span className="rounded bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                ×{doubleChoice}
              </span>
            )}
          </div>

          <div
            className={`mt-1.5 flex items-center gap-2 text-xs ${align === 'right' ? 'justify-end' : ''}`}
          >
            <span className="inline-flex items-center gap-1 rounded-md bg-black/30 px-2 py-0.5 font-mono font-bold text-amber-200">
              余 {cardCount} 张
            </span>
            {isThinking && (
              <span className="animate-pulse text-[11px] font-medium text-amber-300">思考中…</span>
            )}
          </div>
        </div>
      </div>

      {isMingpai && cards.length > 0 && (
        <div className="flex max-w-[200px] flex-wrap gap-0.5 rounded-xl border border-amber-400/30 bg-black/35 p-1.5">
          {sortCardsByRank(cards).map((c) => (
            <PlayingCard key={c.id} card={c} size="xs" />
          ))}
        </div>
      )}
    </div>
  );
};

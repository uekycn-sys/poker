import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, GamePhase, Seat, sortCardsByRank } from '../engine';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { DoudizhuRole, RoleBadge, RolePortraitSvg } from './RoleIcons';

interface PlayerSeatProps {
  seat: Seat;
  name: string;
  align: 'left' | 'right';
  role: DoudizhuRole;
  isCurrentTurn: boolean;
  isThinking: boolean;
  isMingpai: boolean;
  phase: GamePhase;
  cards: Card[];
  bubble: string | null;
  doubleChoice: number | null;
  largeFont?: boolean;
}

function MiniCardStack({ count }: { count: number }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center">
      {/* Layered mini card-back stack */}
      <div className="relative h-9 w-7 sm:h-11 sm:w-8 short-h:h-8 short-h:w-6">
        <div className="absolute -left-0.5 -top-0.5 h-full w-full rounded-md border border-amber-300/45 bg-emerald-900 shadow" />
        <div className="relative flex h-full w-full items-center justify-center rounded-md border border-amber-300/80 bg-gradient-to-br from-emerald-800 via-emerald-950 to-black shadow-md">
          <span className="font-mono text-xs sm:text-sm short-h:text-[11px] font-black text-amber-200 drop-shadow">
            {count}
          </span>
        </div>
      </div>
    </div>
  );
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  seat: _seat,
  name,
  align,
  role,
  isCurrentTurn,
  isThinking,
  isMingpai,
  phase,
  cards,
  bubble,
  doubleChoice,
  largeFont = false,
}) => {
  const cardCount = cards.length;
  const isAlarm = phase === 'PLAYING' && (cardCount === 1 || cardCount === 2);

  const cardTone = isCurrentTurn
    ? 'border-amber-300 bg-emerald-900/90 shadow-[0_0_24px_rgba(251,191,36,0.42)] ring-2 ring-amber-400/75'
    : role === 'landlord'
      ? 'border-amber-400/60 bg-gradient-to-br from-rose-950/75 via-red-950/70 to-black/75 shadow-xl'
      : role === 'farmer'
        ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-950/75 via-teal-950/65 to-black/75 shadow-xl'
        : 'border-amber-500/25 bg-black/55 shadow-xl';

  return (
    <div
      className={`relative flex min-w-0 max-w-full flex-col ${align === 'left' ? 'items-start' : 'items-end'}`}
    >
      <div
        className={`relative flex min-w-0 max-w-full items-center gap-2 short-h:gap-1.5 rounded-2xl border px-2 py-1.5 sm:px-3 sm:py-2 short-h:px-2 short-h:py-1 backdrop-blur-md transition-all ${cardTone} ${
          align === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left'
        }`}
      >
        {/* Portrait + Turn Ring + Siren */}
        <div className="relative shrink-0">
          {isCurrentTurn && (
            <span className="pointer-events-none absolute -inset-1 rounded-full border-2 border-amber-300/80 animate-pulse" />
          )}
          <RolePortraitSvg role={role} size="md" />
          {isAlarm && (
            <span
              className="siren-pulse absolute -right-1.5 -top-1.5 flex h-5 items-center rounded-full border border-rose-200 bg-rose-600 px-1.5 text-[10px] font-black text-white shadow"
              title="报牌警报"
            >
              {cardCount === 1 ? '报单' : '报双'}
            </span>
          )}
        </div>

        {/* Name + Identity + Inline Thinking Indicator */}
        <div className="min-w-0 max-w-[96px] sm:max-w-[130px]">
          <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
            <span className="truncate text-xs sm:text-sm short-h:text-[11px] font-black text-amber-50">
              {name}
            </span>
          </div>

          <div
            className={`mt-0.5 flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}
          >
            <RoleBadge role={role} size="sm" />
            {doubleChoice && doubleChoice > 1 && (
              <span className="shrink-0 rounded bg-rose-500/35 px-1.5 py-0.5 text-[10px] font-black text-rose-100">
                ×{doubleChoice}
              </span>
            )}
            {isThinking && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-amber-300 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                <span className="short-h-hide">思考</span>
              </span>
            )}
          </div>
        </div>

        <MiniCardStack count={cardCount} />
      </div>

      {/* Speech Callout Bubble (positioned absolutely so it never shifts table height) */}
      <AnimatePresence>
        {bubble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.78, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`pointer-events-none absolute top-full mt-1 z-20 whitespace-nowrap rounded-xl border border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 py-0.5 text-xs sm:text-sm font-black text-emerald-950 shadow-lg ${
              align === 'left' ? 'left-1' : 'right-1'
            }`}
          >
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mingpai Open Hand */}
      {isMingpai && cards.length > 0 && (
        <div
          className={`mt-1.5 short-h:mt-0 short-h:absolute short-h:top-full short-h:mt-1 short-h:z-20 ${
            align === 'left' ? 'short-h:left-0' : 'short-h:right-0'
          } flex max-w-[180px] sm:max-w-[220px] flex-wrap gap-0.5 rounded-xl border border-amber-400/35 bg-black/65 p-1 backdrop-blur-sm`}
        >
          {sortCardsByRank(cards).map((c) => (
            <PlayingCard key={c.id} card={c} size="xs" largeFont={largeFont} />
          ))}
        </div>
      )}
    </div>
  );
};

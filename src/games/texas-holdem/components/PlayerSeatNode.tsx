import React from 'react';
import { motion } from 'framer-motion';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { ChipStack, ChipTokenSvg } from '../../../shared/components/ChipAnimation';
import { PlayerAvatar } from '../../../shared/components/PlayerAvatar';
import { AvatarStyleId } from '../../../shared/store/playerStore';
import { AiPersona, getPfrPct, getVpipPct, PlayerHudStats } from '../ai/personas';
import { PlayerState } from '../engine/types';
import {
  formatActionLabelWithBb,
  formatChipsOrBb,
  formatSignedChipsOrBb,
} from '../utils/formatChips';

interface PlayerSeatNodeProps {
  player: PlayerState;
  bigBlind: number;
  displayInBb: boolean;
  isDealer: boolean;
  isActive: boolean;
  isShowdown: boolean;
  isWinner: boolean;
  wonAmount: number;
  winningCardIds: ReadonlySet<string>;
  persona?: AiPersona;
  hudStat?: PlayerHudStats;
  humanAvatarId: AvatarStyleId;
  handEvalLabel?: string;
  betAlign?: 'top' | 'bottom' | 'left' | 'right';
  largeFont?: boolean;
}

const STYLE_BADGE_COLORS: Record<string, string> = {
  TAG: 'border-sky-400/45 bg-sky-500/20 text-sky-200',
  LAG: 'border-rose-400/45 bg-rose-500/20 text-rose-200',
  CALLING_STATION: 'border-amber-400/45 bg-amber-500/20 text-amber-200',
  NIT: 'border-slate-400/45 bg-slate-500/20 text-slate-200',
  GTO_PRO: 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200',
};

const BET_ALIGN_CLASSES: Record<NonNullable<PlayerSeatNodeProps['betAlign']>, string> = {
  top: '-top-6 left-1/2 -translate-x-1/2',
  bottom:
    '-bottom-6 left-1/2 -translate-x-1/2 short-h:bottom-auto short-h:top-1/2 short-h:left-full short-h:translate-x-1.5 short-h:-translate-y-1/2',
  left: 'top-1/2 -left-16 -translate-y-1/2',
  right: 'top-1/2 -right-16 -translate-y-1/2',
};

export const PlayerSeatNode: React.FC<PlayerSeatNodeProps> = ({
  player,
  bigBlind,
  displayInBb,
  isDealer,
  isActive,
  isShowdown,
  isWinner,
  wonAmount,
  winningCardIds,
  persona,
  hudStat,
  humanAvatarId,
  handEvalLabel,
  betAlign = 'bottom',
  largeFont = false,
}) => {
  const revealCards = player.isHuman || (isShowdown && !player.folded);
  const vpip = getVpipPct(hudStat);
  const pfr = getPfrPct(hudStat);
  const handsSample = hudStat?.handsPlayed ?? 0;
  const formattedActionLabel = formatActionLabelWithBb(
    player.lastActionLabel,
    bigBlind,
    displayInBb,
  );

  return (
    <div
      className={`relative flex flex-col items-center transition-opacity duration-300 ${
        player.folded ? 'opacity-45' : 'opacity-100'
      }`}
    >
      {/* Projected Street Bet Chip Stack */}
      {player.streetBet > 0 && !isShowdown && (
        <div className={`pointer-events-none absolute z-30 ${BET_ALIGN_CLASSES[betAlign]}`}>
          <ChipStack
            amount={player.streetBet}
            displayText={formatChipsOrBb(player.streetBet, bigBlind, displayInBb)}
            compact
          />
        </div>
      )}

      {/* Hero and top seat (UTG) go side-by-side on mobile landscape (`max-height: 540px`) */}
      <div
        className={`flex flex-col items-center ${
          player.isHuman || player.seat === 3 ? 'short-h-row' : ''
        }`}
      >
        {/* Hole Cards */}
        <div
          className={`flex items-center justify-center ${
            player.isHuman || player.seat === 3
              ? 'mb-1 short-h:mb-0'
              : 'mb-1 short-h:mb-0.5'
          }`}
        >
          {player.isHuman ? (
            <div className="group relative flex items-end -space-x-2.5 pt-1 short-h:pt-0">
              {player.holeCards.map((card, idx) => {
                const isWinCard = isShowdown && winningCardIds.has(card.id);
                return (
                  <div
                    key={card.id}
                    className={`relative transition-all duration-200 ease-out ${
                      idx === 0
                        ? '-rotate-6 group-hover:-translate-y-2 group-hover:-rotate-9'
                        : 'rotate-6 group-hover:-translate-y-2.5 group-hover:rotate-9'
                    } ${
                      isWinCard
                        ? 'z-20 -translate-y-2 rounded-xl ring-2 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.95)]'
                        : ''
                    }`}
                  >
                    <PlayingCard card={card} size="md" selected={isWinCard} largeFont={largeFont} />
                    <span className="pointer-events-none absolute right-0 top-0 h-4 w-4 rounded-bl-lg bg-gradient-to-bl from-amber-200/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  </div>
                );
              })}
              {!isShowdown && !player.folded && (
                <span className="short-h-hide pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5 text-[9px] font-bold text-amber-200 opacity-0 transition-opacity group-hover:opacity-100">
                  悬停看牌
                </span>
              )}
            </div>
          ) : (
            <div className="flex -space-x-2 short-h:-space-x-1.5">
              {player.holeCards.map((card, idx) => {
                const isWinCard = isShowdown && winningCardIds.has(card.id);
                return (
                  <div
                    key={card.id}
                    className={`transition-transform duration-300 ${
                      idx === 0 ? '-rotate-4' : 'rotate-4'
                    } ${
                      isWinCard
                        ? 'z-20 -translate-y-1.5 scale-105 rounded-lg ring-2 ring-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.95)]'
                        : ''
                    }`}
                  >
                    <PlayingCard
                      card={card}
                      faceDown={!revealCards}
                      size={revealCards ? 'sm' : 'xs'}
                      selected={isWinCard}
                      largeFont={largeFont}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Commercial VIP Curved Seat Plate */}
        <motion.div
          animate={isActive ? { scale: 1.04 } : { scale: 1 }}
          className={`relative flex min-w-[114px] sm:min-w-[140px] short-h:min-w-[106px] items-center gap-1.5 sm:gap-2 rounded-2xl border px-2 py-1 sm:px-2.5 sm:py-1.5 short-h:py-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.75)] backdrop-blur-md ${
            isWinner
              ? 'border-amber-300 bg-gradient-to-r from-amber-500/30 via-[#08251a]/95 to-amber-500/25 ring-2 ring-amber-300/80'
              : isActive
                ? 'border-amber-300 bg-gradient-to-b from-[#0b3828]/95 to-[#041811]/95 ring-2 ring-amber-400/70 shadow-[0_0_24px_rgba(251,191,36,0.45)]'
                : player.allIn
                  ? 'border-rose-400/80 bg-gradient-to-b from-rose-950/90 to-black/90 ring-1 ring-rose-400/60'
                  : 'border-amber-400/25 bg-gradient-to-b from-slate-900/90 to-black/90'
          }`}
        >
          {isActive && (
            <span className="pointer-events-none absolute -inset-[3px] rounded-[18px] border border-amber-300/60 animate-pulse" />
          )}

          {isDealer && (
            <span
              title="庄位按钮 (BTN)"
              className="absolute -right-1.5 -top-1.5 z-20 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border-2 border-amber-100 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-[9px] sm:text-[10px] font-black text-emerald-950 shadow-[0_3px_8px_rgba(0,0,0,0.65)]"
            >
              D
            </span>
          )}

          <PlayerAvatar
            avatarId={player.isHuman ? humanAvatarId : persona?.avatarId ?? 'spade'}
            size="sm"
            className="short-h:h-7 short-h:w-7"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] sm:text-xs font-black text-amber-50">
                {player.name}
              </span>
              <span className="rounded border border-amber-300/25 bg-black/50 px-1 py-0.2 font-mono text-[8px] sm:text-[9px] font-black text-amber-300">
                {player.position}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] sm:text-xs font-black text-amber-300">
              <ChipTokenSvg className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span>{formatChipsOrBb(player.stack, bigBlind, displayInBb)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI HUD Stats & Style Tag */}
      {!player.isHuman && persona && (
        <div
          title={persona.exploitTipZh}
          className="mt-0.5 flex items-center gap-1 rounded-full border border-white/10 bg-black/80 px-1.5 py-0.2 text-[8px] sm:text-[10px] shadow whitespace-nowrap"
        >
          <span
            className={`rounded border px-1 font-black ${
              STYLE_BADGE_COLORS[persona.styleId] ?? ''
            }`}
          >
            {persona.shortTag}
          </span>
          <span className="font-mono font-bold text-emerald-200/90">
            {vpip}/{pfr}
            {handsSample > 0 ? ` (${handsSample})` : ''}
          </span>
        </div>
      )}

      {/* Action / Showdown Eval Pill */}
      {(formattedActionLabel || handEvalLabel || wonAmount > 0) && (
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
          {formattedActionLabel && !isWinner && (
            <span
              className={`rounded-full px-1.5 sm:px-2 py-0.2 sm:py-0.5 text-[9px] sm:text-[10px] font-black shadow whitespace-nowrap ${
                player.folded
                  ? 'bg-slate-800/90 text-slate-400'
                  : player.allIn
                    ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white'
                    : 'border border-emerald-400/35 bg-emerald-950/90 text-emerald-200'
              }`}
            >
              {formattedActionLabel}
            </span>
          )}
          {handEvalLabel && !player.folded && (
            <span className="rounded-full border border-amber-300/45 bg-black/90 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-200">
              {handEvalLabel}
            </span>
          )}
          {wonAmount > 0 && (
            <span className="rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2 py-0.5 font-mono text-[10px] sm:text-[11px] font-black text-emerald-950 shadow-lg">
              {formatSignedChipsOrBb(wonAmount, bigBlind, displayInBb)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

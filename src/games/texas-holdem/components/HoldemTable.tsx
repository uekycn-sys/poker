import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BrainCircuit,
  Home,
  Megaphone,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  ZoomIn,
} from 'lucide-react';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { ChipBalancePill, ChipStack, FullscreenButton } from '../../../shared/components';
import { TableEffects } from '../../../shared/effects/TableEffects';
import { useStageViewport } from '../../../shared/hooks/useStageViewport';
import { usePlayerStore } from '../../../shared/store/playerStore';
import { AI_PERSONAS_BY_SEAT } from '../ai/personas';
import { calculateSidePots } from '../engine/sidePots';
import { ActionControlBar } from './ActionControlBar';
import { CoachHudPanel } from './CoachHudPanel';
import { HandReviewModal } from './HandReviewModal';
import { OutsQuizModal } from './OutsQuizModal';
import { PlayerSeatNode } from './PlayerSeatNode';
import { PreflopRangeMatrix } from './PreflopRangeMatrix';
import { useHoldemGameStore } from '../store/holdemGameStore';
import { useHoldemProfileStore } from '../store/holdemProfileStore';

interface HoldemTableProps {
  onExitToLobby: () => void;
}

const SEAT_POSITIONS: Record<
  number,
  { posClass: string; betAlign: 'top' | 'bottom' | 'left' | 'right' }
> = {
  0: { posClass: 'bottom-0 left-1/2 -translate-x-1/2 z-20', betAlign: 'top' },
  1: {
    posClass: 'bottom-[12%] short-h:bottom-0 left-0 sm:left-2 z-10',
    betAlign: 'right',
  },
  2: {
    posClass: 'top-[10%] short-h:top-0 left-0 sm:left-2 z-10',
    betAlign: 'right',
  },
  3: { posClass: 'top-0 left-1/2 -translate-x-1/2 z-10', betAlign: 'bottom' },
  4: {
    posClass: 'top-[10%] short-h:top-0 right-0 sm:right-2 z-10',
    betAlign: 'left',
  },
  5: {
    posClass: 'bottom-[12%] short-h:bottom-0 right-0 sm:right-2 z-10',
    betAlign: 'left',
  },
};

const STREET_TITLES: Record<string, string> = {
  preflop: '翻前 Pre-Flop',
  flop: '翻牌 Flop',
  turn: '转牌 Turn',
  river: '河牌 River',
  showdown: '摊牌结算 Showdown',
};

export const HoldemTable: React.FC<HoldemTableProps> = ({ onExitToLobby }) => {
  const chips = usePlayerStore((s) => s.chips);
  const lastChipDelta = usePlayerStore((s) => s.lastChipDelta);
  const humanAvatarId = usePlayerStore((s) => s.avatarId);
  const sfxEnabled = usePlayerStore((s) => s.sfxEnabled);
  const voiceEnabled = usePlayerStore((s) => s.voiceEnabled);
  const largeCardFont = usePlayerStore((s) => s.largeCardFont);
  const toggleSfx = usePlayerStore((s) => s.toggleSfx);
  const toggleVoice = usePlayerStore((s) => s.toggleVoice);
  const toggleLargeCardFont = usePlayerStore((s) => s.toggleLargeCardFont);
  const viewport = useStageViewport();

  const hudEnabled = useHoldemProfileStore((s) => s.hudEnabled);
  const outsQuizEnabled = useHoldemProfileStore((s) => s.outsQuizEnabled);
  const trainingPoints = useHoldemProfileStore((s) => s.trainingPoints);
  const toggleHud = useHoldemProfileStore((s) => s.toggleHud);
  const toggleOutsQuiz = useHoldemProfileStore((s) => s.toggleOutsQuiz);

  // Separate slide-over state for compact viewports (< xl) so initial mobile landscape table is unobstructed
  const [compactHudOpen, setCompactHudOpen] = useState(false);

  const handState = useHoldemGameStore((s) => s.handState);
  const hudStats = useHoldemGameStore((s) => s.hudStats);
  const coachAnalysis = useHoldemGameStore((s) => s.coachAnalysis);
  const coachLoading = useHoldemGameStore((s) => s.coachLoading);
  const activeReview = useHoldemGameStore((s) => s.activeReview);
  const showReviewModal = useHoldemGameStore((s) => s.showReviewModal);
  const showMatrixModal = useHoldemGameStore((s) => s.showMatrixModal);
  const allInSpotlight = useHoldemGameStore((s) => s.allInSpotlight);
  const tableFx = useHoldemGameStore((s) => s.tableFx);
  const outsQuiz = useHoldemGameStore((s) => s.outsQuiz);
  const isFastForwarding = useHoldemGameStore((s) => s.isFastForwarding);
  const isBranchedReplay = useHoldemGameStore((s) => s.isBranchedReplay);

  const openHub = useHoldemGameStore((s) => s.openHub);
  const startNextHand = useHoldemGameStore((s) => s.startNextHand);
  const submitHeroAction = useHoldemGameStore((s) => s.submitHeroAction);
  const submitOutsQuizAnswer = useHoldemGameStore((s) => s.submitOutsQuizAnswer);
  const dismissOutsQuiz = useHoldemGameStore((s) => s.dismissOutsQuiz);
  const fastForwardHand = useHoldemGameStore((s) => s.fastForwardHand);
  const openReviewModal = useHoldemGameStore((s) => s.openReviewModal);
  const closeReviewModal = useHoldemGameStore((s) => s.closeReviewModal);
  const setShowMatrixModal = useHoldemGameStore((s) => s.setShowMatrixModal);
  const clearTableFx = useHoldemGameStore((s) => s.clearTableFx);
  const branchFromStreet = useHoldemGameStore((s) => s.branchFromStreet);

  const livePots = useMemo(() => {
    if (!handState) return [];
    if (handState.showdown) return handState.showdown.pots;
    return calculateSidePots(
      handState.players.map((p) => ({
        seat: p.seat,
        totalCommitted: p.totalCommitted,
        folded: p.folded,
      })),
    );
  }, [handState]);

  const winningCardIdSet = useMemo(
    () => new Set(handState?.showdown?.winningCardIds ?? []),
    [handState?.showdown?.winningCardIds],
  );

  if (!handState) return null;

  const hero = handState.players.find((p) => p.seat === 0)!;
  const isHeroTurn = !handState.isHandOver && handState.activeSeat === 0;
  const isShowdown = handState.street === 'showdown';

  const handleHudToggle = () => {
    if (viewport.width < 1280) {
      setCompactHudOpen((v) => !v);
    } else {
      toggleHud();
    }
  };

  return (
    <div className="casino-room-bg safe-area-pad relative flex h-full w-full flex-col overflow-hidden select-none">
      {/* Overhead Casino Chandelier Ambient Cone */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_38%,rgba(253,230,138,0.08),transparent_70%)]" />

      {/* All-in Dramatic Spotlight Overlay */}
      <AnimatePresence>
        {allInSpotlight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-30 bg-[radial-gradient(circle_at_50%_45%,transparent_18%,rgba(0,0,0,0.82)_75%)]"
          />
        )}
      </AnimatePresence>

      {/* Top Floating Casino HUD Bar */}
      <header className="short-h-compact relative z-20 mx-auto flex w-full max-w-[1480px] shrink-0 items-center justify-between gap-2 px-3 pt-1.5 sm:px-5 sm:pt-2.5">
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={openHub}
            className="hud-glass inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-amber-100 hover:border-amber-300/60 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>训练营</span>
          </button>
          <button
            type="button"
            onClick={onExitToLobby}
            className="hud-glass inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-emerald-100 hover:border-amber-300/60 cursor-pointer"
          >
            <Home className="h-4 w-4" />
            <span>大厅</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="rounded-xl border border-amber-300/40 bg-amber-400/15 px-2.5 py-1 font-mono font-black text-amber-200">
              6-Max · {handState.smallBlind}/{handState.bigBlind}
            </span>
            <span className="short-h-hide rounded-xl border border-white/10 bg-black/45 px-2.5 py-1 font-bold text-emerald-200">
              第 #{handState.handId} 手 · {STREET_TITLES[handState.street]}
            </span>
            {isBranchedReplay && (
              <span className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-2 py-1 text-[11px] font-black text-sky-200">
                分支重演
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <ChipBalancePill chips={chips} lastDelta={lastChipDelta} compact />

          <button
            type="button"
            onClick={toggleOutsQuiz}
            className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-black transition cursor-pointer ${
              outsQuizEnabled
                ? 'border-sky-300/75 bg-sky-500/25 text-sky-100 shadow'
                : 'hud-glass text-slate-300 hover:border-amber-300/50'
            }`}
            title="开启后在翻牌/转牌听牌时弹窗进行 8 秒 Outs 盲测"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Outs</span>
            <span className="rounded bg-black/45 px-1 font-mono text-[10px] text-amber-300">
              {trainingPoints}
            </span>
          </button>

          {/* Desktop xl+ toggle reflects hudEnabled; < xl reflects compactHudOpen */}
          <button
            type="button"
            onClick={handleHudToggle}
            className={`hidden xl:inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-black transition cursor-pointer ${
              hudEnabled
                ? 'game-btn-gold'
                : 'hud-glass text-slate-300 hover:border-amber-300/50'
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>GTO HUD</span>
          </button>
          <button
            type="button"
            onClick={handleHudToggle}
            className={`inline-flex xl:hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-xs font-black transition cursor-pointer ${
              compactHudOpen
                ? 'game-btn-gold'
                : 'hud-glass text-amber-200 hover:border-amber-300/50'
            }`}
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">GTO</span>
          </button>

          <button
            type="button"
            onClick={toggleSfx}
            className={`hud-glass inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold cursor-pointer ${
              sfxEnabled ? 'text-emerald-200' : 'text-slate-400'
            }`}
            aria-label="音效开关"
            title="音效开关"
          >
            {sfxEnabled ? (
              <Volume2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
            <span className="hidden md:inline">音效</span>
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            className={`hud-glass inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold cursor-pointer ${
              voiceEnabled ? 'text-emerald-200' : 'text-slate-400'
            }`}
            aria-label="语音开关"
            title="语音开关"
          >
            {voiceEnabled ? (
              <Megaphone className="h-4 w-4 text-emerald-300" />
            ) : (
              <MicOff className="h-4 w-4 text-slate-400" />
            )}
            <span className="hidden md:inline">语音</span>
          </button>
          <button
            type="button"
            onClick={toggleLargeCardFont}
            className={`inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold cursor-pointer ${
              largeCardFont
                ? 'border border-amber-300/70 bg-amber-400/20 text-amber-200'
                : 'hud-glass text-amber-100'
            }`}
            aria-label="大字模式"
            title="适老大字清晰模式"
          >
            <ZoomIn className="h-4 w-4 text-amber-300" />
            <span>大字</span>
          </button>
          <FullscreenButton compact showLabel />
        </div>
      </header>

      {/* Main Arena: Fluid 3D Oval Table + Docked/Slide-over Coach HUD */}
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 items-stretch gap-3 px-2 py-1 sm:px-5 sm:py-2 short-h:py-0.5">
        {/* Left/Center Poker Table Column */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-1">
          {/* Fluid Stadium Table Container */}
          <div className="relative flex min-h-0 w-full max-w-[1040px] flex-1 items-center justify-center">
            {/* Multi-Layer 3D Walnut -> Leather Armrest -> Brushed Brass -> Emerald Speed Cloth */}
            <div className="holdem-rail-outer relative h-[76%] w-[78%] sm:h-[74%] sm:w-[82%] short-h:mt-2 short-h:h-[74%] short-h:w-[74%] rounded-[999px] p-[4px] sm:p-[7px]">
              <div className="holdem-leather-rail relative h-full w-full rounded-[999px] p-[7px] sm:p-[13px] md:p-[16px] short-h:p-[6px]">
                {/* Stitched Leather Inner Seam */}
                <div className="pointer-events-none absolute inset-[4px] sm:inset-[6px] rounded-[999px] border border-dashed border-amber-200/15" />

                <div className="holdem-brass-bezel relative h-full w-full rounded-[999px] p-[2px] sm:p-[3px]">
                  <div className="holdem-felt-surface relative flex h-full w-full flex-col items-center justify-center short-h:justify-end short-h:pb-2.5 rounded-[999px]">
                    {/* Inner Gold Betting Line Oval */}
                    <div className="pointer-events-none absolute inset-3 sm:inset-6 rounded-[999px] border border-amber-300/20" />
                    <div className="short-h-hide pointer-events-none absolute inset-6 sm:inset-9 rounded-[999px] border border-dashed border-amber-200/10" />

                    {/* Top Recessed Dealer Chip Tray Ornament */}
                    <div className="short-h-hide pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-b-xl border border-t-0 border-amber-300/25 bg-black/50 px-3 py-1 opacity-75">
                      <span className="h-1.5 w-3 rounded-full bg-rose-500/80" />
                      <span className="h-1.5 w-3 rounded-full bg-sky-500/80" />
                      <span className="h-1.5 w-3 rounded-full bg-amber-400/90" />
                      <span className="h-1.5 w-3 rounded-full bg-emerald-400/80" />
                    </div>

                    {/* Pot & Side Pots Breakdown */}
                    <div className="relative z-10 mb-1 sm:mb-2 flex flex-col items-center gap-0.5 sm:gap-1">
                      <div className="flex items-center gap-1.5">
                        {handState.pot > 0 && <ChipStack amount={handState.pot} compact />}
                        <div className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-black/75 px-2.5 py-0.5 sm:px-3.5 sm:py-1 shadow-lg backdrop-blur">
                          <span className="text-[9px] sm:text-xs font-bold text-amber-200/85">
                            总底池
                          </span>
                          <span className="font-mono text-[11px] sm:text-sm md:text-base font-black text-amber-300">
                            {handState.pot.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {livePots.length > 1 && (
                        <div className="flex flex-wrap justify-center gap-1">
                          {livePots.map((pot) => (
                            <span
                              key={pot.id}
                              className="rounded-full border border-white/15 bg-black/70 px-1.5 py-0.2 font-mono text-[8px] sm:text-[10px] font-bold text-emerald-200"
                            >
                              {pot.label}: {pot.amount.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 5 Community Cards Recessed Wells */}
                    <div className="relative z-10 flex items-center justify-center gap-1 sm:gap-2">
                      {Array.from({ length: 5 }, (_, idx) => {
                        const card = handState.communityCards[idx];
                        if (!card) {
                          return (
                            <div
                              key={`slot-${idx}`}
                              className="h-[var(--card-md-h)] w-[var(--card-md-w)] rounded-[8px] sm:rounded-[10px] border border-amber-200/18 bg-black/25 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]"
                            />
                          );
                        }
                        const isWinCard = isShowdown && winningCardIdSet.has(card.id);
                        return (
                          <motion.div
                            key={card.id}
                            initial={{ opacity: 0, y: -10, rotateY: 75 }}
                            animate={{ opacity: 1, y: 0, rotateY: 0 }}
                            transition={{ duration: 0.25, delay: idx >= 3 ? 0.05 : idx * 0.06 }}
                            className={
                              isWinCard
                                ? 'rounded-[10px] ring-2 ring-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.95)] scale-105'
                                : isShowdown && winningCardIdSet.size > 0
                                  ? 'opacity-65'
                                  : ''
                            }
                          >
                            <PlayingCard card={card} size="md" selected={isWinCard} largeFont={largeCardFont} />
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Subtle Gold Club Felt Crest */}
                    <div className="short-h-hide pointer-events-none mt-2 text-[9px] sm:text-[10px] font-black tracking-[0.28em] text-amber-200/20 uppercase select-none">
                      ROYAL TEXAS HOLD’EM · 6-MAX
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 6 Player Seats Positioned Around the Rail */}
            {handState.players.map((p) => {
              const persona = AI_PERSONAS_BY_SEAT[p.seat];
              const isWinner = handState.showdown?.winnerSeats.includes(p.seat) ?? false;
              const wonAmount = handState.showdown?.totalWonBySeat[p.seat] ?? 0;
              const evalLabel = handState.showdown?.evalsBySeat[p.seat]?.description;
              const seatPos = SEAT_POSITIONS[p.seat] ?? SEAT_POSITIONS[0];
              return (
                <div key={p.seat} className={`absolute ${seatPos.posClass}`}>
                  <PlayerSeatNode
                    player={p}
                    isDealer={handState.dealerSeat === p.seat}
                    isActive={!handState.isHandOver && handState.activeSeat === p.seat}
                    isShowdown={isShowdown}
                    isWinner={isWinner}
                    wonAmount={wonAmount}
                    winningCardIds={winningCardIdSet}
                    persona={persona}
                    hudStat={hudStats[p.seat]}
                    humanAvatarId={humanAvatarId}
                    handEvalLabel={evalLabel}
                    betAlign={seatPos.betAlign}
                    largeFont={largeCardFont}
                  />
                </div>
              );
            })}
          </div>

          {/* Bottom Casino Action Control Dock */}
          <div className="w-full max-w-[980px] shrink-0">
            <ActionControlBar
              handState={handState}
              isHeroTurn={isHeroTurn}
              onAction={submitHeroAction}
              onNextHand={startNextHand}
              onOpenReview={openReviewModal}
              onFastForward={fastForwardHand}
              isFastForwarding={isFastForwarding}
            />
          </div>
        </div>

        {/* Desktop Inline Coach HUD (xl+) */}
        {hudEnabled && (
          <div className="hidden xl:block h-full w-[320px] shrink-0">
            <CoachHudPanel
              hudEnabled={hudEnabled}
              outsQuizLocked={Boolean(outsQuiz && !outsQuiz.result)}
              loading={coachLoading}
              analysis={coachAnalysis}
              heroCards={hero.holeCards}
              heroPosition={hero.position}
              isPreflop={handState.street === 'preflop'}
              onOpenMatrix={() => setShowMatrixModal(true)}
            />
          </div>
        )}

        {/* Compact/Mobile Landscape Slide-Over Coach HUD Drawer (< xl) */}
        {compactHudOpen && (
          <div className="fixed right-3 top-12 bottom-14 z-40 w-[290px] xl:hidden">
            <CoachHudPanel
              hudEnabled={compactHudOpen}
              outsQuizLocked={Boolean(outsQuiz && !outsQuiz.result)}
              loading={coachLoading}
              analysis={coachAnalysis}
              heroCards={hero.holeCards}
              heroPosition={hero.position}
              isPreflop={handState.street === 'preflop'}
              onOpenMatrix={() => setShowMatrixModal(true)}
              onClose={() => setCompactHudOpen(false)}
            />
          </div>
        )}
      </div>

      {/* 13x13 GTO Range Matrix Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm">
          <div className="max-h-[94%] w-full max-w-2xl overflow-y-auto">
            <PreflopRangeMatrix
              heroCards={hero.holeCards}
              initialPosition={hero.position}
              initialFacingRaise={handState.currentBet > handState.bigBlind}
              onClose={() => setShowMatrixModal(false)}
            />
          </div>
        </div>
      )}

      {/* 8-Second Outs Blind Test Modal */}
      {outsQuiz && outsQuiz.active && (
        <OutsQuizModal
          quiz={outsQuiz}
          heroCards={hero.holeCards}
          boardCards={handState.communityCards}
          trainingPoints={trainingPoints}
          onSubmit={submitOutsQuizAnswer}
          onDismiss={dismissOutsQuiz}
        />
      )}

      {/* Post-Hand EV Review Modal */}
      {showReviewModal && activeReview && (
        <HandReviewModal
          review={activeReview}
          handState={handState}
          onBranchFromStreet={(snaps, st) => branchFromStreet(snaps, st)}
          onClose={closeReviewModal}
        />
      )}

      <TableEffects fx={tableFx} onComplete={clearTableFx} />
    </div>
  );
};

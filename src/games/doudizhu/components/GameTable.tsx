import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpCircle,
  ArrowUpDown,
  Ban,
  BookOpen,
  Brain,
  ChevronsUp,
  Clock,
  Crown,
  Eye,
  Home,
  Lightbulb,
  Megaphone,
  MicOff,
  RotateCcw,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  calculatePublicMultiplier,
  formatPatternLabel,
  matchPatternToBeat,
} from '../engine';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { TableEffects } from '../../../shared/effects/TableEffects';
import { ChipBalancePill, FullscreenButton } from '../../../shared/components';
import { useStageViewport } from '../../../shared/hooks/useStageViewport';
import { getRankTier, usePlayerStore } from '../../../shared/store/playerStore';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';
import { HandBar } from './HandBar';
import { CardCounterBar } from './CardCounterBar';
import { BlindQuizModal } from './BlindQuizModal';
import { PlayerSeat } from './PlayerSeat';
import { DoudizhuRole, RoleBadge, RoleEmblemIcon, RolePortraitSvg } from './RoleIcons';
import { SettlementModal } from './SettlementModal';

const DIFFICULTY_LABELS = {
  casual: '休闲 AI',
  intermediate: '进阶 AI',
  master: '大师 AI',
};

interface GameTableProps {
  onExitToLobby: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({ onExitToLobby }) => {
  const gameState = useDoudizhuGameStore((s) => s.gameState);
  const matchMode = useDoudizhuGameStore((s) => s.matchMode);
  const activePuzzle = useDoudizhuGameStore((s) => s.activePuzzle);
  const selectedCardIds = useDoudizhuGameStore((s) => s.selectedCardIds);
  const seatBubbles = useDoudizhuGameStore((s) => s.seatBubbles);
  const tablePlays = useDoudizhuGameStore((s) => s.tablePlays);
  const aiThinkingSeat = useDoudizhuGameStore((s) => s.aiThinkingSeat);
  const activeFx = useDoudizhuGameStore((s) => s.activeFx);
  const liveWinRate = useDoudizhuGameStore((s) => s.liveWinRate);
  const coachPanelOpen = useDoudizhuGameStore((s) => s.coachPanelOpen);
  const coachAdvice = useDoudizhuGameStore((s) => s.coachAdvice);
  const coachLoading = useDoudizhuGameStore((s) => s.coachLoading);
  const turnSecondsLeft = useDoudizhuGameStore((s) => s.turnSecondsLeft);

  const returnToHub = useDoudizhuGameStore((s) => s.returnToHub);
  const openPuzzlesScreen = useDoudizhuGameStore((s) => s.openPuzzlesScreen);
  const resetActivePuzzle = useDoudizhuGameStore((s) => s.resetActivePuzzle);
  const startMatch = useDoudizhuGameStore((s) => s.startMatch);
  const [showPuzzleHint, setShowPuzzleHint] = useState(false);
  const humanBid = useDoudizhuGameStore((s) => s.humanBid);
  const humanMingpai = useDoudizhuGameStore((s) => s.humanMingpai);
  const humanDouble = useDoudizhuGameStore((s) => s.humanDouble);
  const clearSelection = useDoudizhuGameStore((s) => s.clearSelection);
  const cycleHint = useDoudizhuGameStore((s) => s.cycleHint);
  const humanPlaySelected = useDoudizhuGameStore((s) => s.humanPlaySelected);
  const humanPass = useDoudizhuGameStore((s) => s.humanPass);
  const tickTurnTimer = useDoudizhuGameStore((s) => s.tickTurnTimer);
  const toggleCoachPanel = useDoudizhuGameStore((s) => s.toggleCoachPanel);
  const requestLiveCoach = useDoudizhuGameStore((s) => s.requestLiveCoach);
  const selectCoachCards = useDoudizhuGameStore((s) => s.selectCoachCards);
  const clearActiveFx = useDoudizhuGameStore((s) => s.clearActiveFx);

  const chips = usePlayerStore((s) => s.chips);
  const lastChipDelta = usePlayerStore((s) => s.lastChipDelta);
  const rankPoints = usePlayerStore((s) => s.rankPoints);
  const sfxEnabled = usePlayerStore((s) => s.sfxEnabled);
  const voiceEnabled = usePlayerStore((s) => s.voiceEnabled);
  const largeCardFont = usePlayerStore((s) => s.largeCardFont);
  const toggleSfx = usePlayerStore((s) => s.toggleSfx);
  const toggleVoice = usePlayerStore((s) => s.toggleVoice);
  const toggleLargeCardFont = usePlayerStore((s) => s.toggleLargeCardFont);

  const difficulty = useDoudizhuProfileStore((s) => s.difficulty);
  const sortMode = useDoudizhuProfileStore((s) => s.sortMode);
  const toggleSortMode = useDoudizhuProfileStore((s) => s.toggleSortMode);
  const { width: stageWidth, height: stageHeight, isShortLandscape, isUltraShort } = useStageViewport();

  const waitTurnLabel =
    gameState.currentTurn === 1
      ? '轮到下家操作…'
      : gameState.currentTurn === 2
        ? '轮到上家操作…'
        : null;

  useEffect(() => {
    const id = setInterval(() => {
      tickTurnTimer();
    }, 1000);
    return () => clearInterval(id);
  }, [tickTurnTimer]);

  const tier = getRankTier(rankPoints);
  const selectedCards = useMemo(
    () => gameState.hands[0].filter((c) => selectedCardIds.includes(c.id)),
    [gameState.hands, selectedCardIds],
  );
  const matchedSelection = useMemo(() => {
    if (selectedCards.length === 0) return null;
    return matchPatternToBeat(selectedCards, gameState.lastPlay?.pattern ?? null);
  }, [selectedCards, gameState.lastPlay]);

  const publicMult = calculatePublicMultiplier(
    gameState,
    gameState.settlement?.isSpring ?? false,
    gameState.settlement?.isAntiSpring ?? false,
  );
  const personalDouble = gameState.doubleChoices[0] ?? 1;
  const displayMultiplier = publicMult * personalDouble;

  const isHumanTurn = gameState.currentTurn === 0;
  const bottomRevealed = gameState.landlordSeat !== null;
  const shakeScreen = activeFx?.kind === 'BOMB' || activeFx?.kind === 'ROCKET';

  const getSeatRole = (seat: 0 | 1 | 2): DoudizhuRole => {
    if (gameState.landlordSeat === null) return 'pending';
    return gameState.landlordSeat === seat ? 'landlord' : 'farmer';
  };

  const heroRole = getSeatRole(0);

  return (
    <div
      className={`doudizhu-stage-bg safe-area-pad relative flex h-full w-full flex-col overflow-hidden select-none ${
        shakeScreen ? 'table-shake' : ''
      }`}
    >
      {/* Mahogany Perimeter Bezel & Subtle Gold Felt Inlay (framed inside safe area away from iOS status-bar blur) */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: 'var(--sat)',
          right: 'var(--sar)',
          bottom: 'var(--sab)',
          left: 'var(--sal)',
        }}
      >
        <div className="absolute inset-0 border-[6px] border-[#26140b] sm:border-[10px] short-h:border-[4px] short-h:rounded-xl" />
        <div className="absolute inset-[6px] sm:inset-[10px] short-h:inset-[4px] rounded-2xl short-h:rounded-xl border border-amber-300/20" />
      </div>

      {/* Center Embossed Table Watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center opacity-[0.07]">
          <div className="text-3xl sm:text-5xl font-black tracking-[0.28em] text-amber-200">
            欢乐斗地主
          </div>
          <div className="mt-1 text-[10px] font-bold tracking-[0.38em] text-amber-100 uppercase">
            HAPPY DOUDIZHU MASTER
          </div>
        </div>
      </div>

      <TableEffects fx={activeFx} onComplete={clearActiveFx} />

      {/* Top Floating HUD Row (Elder-Friendly: Every Key Action Has Icon + Clear Label) */}
      <header className="short-h-compact relative z-20 flex shrink-0 items-center justify-between gap-1 sm:gap-1.5 px-2.5 pt-1.5 sm:px-5 sm:pt-2.5">
        {/* Left Navigation & Audio Controls */}
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={onExitToLobby}
            title="返回大厅"
            className="hud-glass flex items-center gap-1 rounded-xl px-2.5 py-1.5 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-black text-amber-200 transition hover:border-amber-300/60 cursor-pointer"
          >
            <Home className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 text-amber-300" />
            <span>大厅</span>
          </button>
          <button
            type="button"
            onClick={matchMode === 'puzzle' ? openPuzzlesScreen : returnToHub}
            title={matchMode === 'puzzle' ? '残局列表' : '斗地主专区'}
            className="hud-glass flex items-center gap-1 rounded-xl px-2.5 py-1.5 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-black text-amber-100 transition hover:border-amber-300/60 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 short-h:h-3.5 short-h:w-3.5" />
            <span>{matchMode === 'puzzle' ? '残局' : '专区'}</span>
          </button>
          <button
            type="button"
            onClick={toggleSfx}
            title="音效开关"
            className={`hud-glass flex items-center gap-1 rounded-xl px-2.5 py-1.5 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-bold transition cursor-pointer ${
              sfxEnabled ? 'text-emerald-200' : 'text-slate-400'
            }`}
          >
            {sfxEnabled ? (
              <Volume2 className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 text-emerald-300" />
            ) : (
              <VolumeX className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline forced-l:inline">音效</span>
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            title="中文语音播报"
            className={`hud-glass flex items-center gap-1 rounded-xl px-2.5 py-1.5 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-bold transition cursor-pointer ${
              voiceEnabled ? 'text-emerald-200' : 'text-slate-400'
            }`}
          >
            {voiceEnabled ? (
              <Megaphone className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 text-emerald-300" />
            ) : (
              <MicOff className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline forced-l:inline">语音</span>
          </button>
          <span className="short-h-hide hidden lg:inline-flex rounded-xl border border-amber-400/25 bg-black/45 px-2.5 py-1.5 text-xs font-bold text-amber-200">
            {matchMode === 'puzzle' && activePuzzle
              ? `残局 #${activePuzzle.number} · ${activePuzzle.title}`
              : matchMode === 'replay-resume'
                ? '复盘重打 · 大师 AI'
                : DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        {/* Center Recessed Bottom-Cards Tray + Multiplier + Docked CardCounter */}
        <div className="flex min-w-0 items-center tall-h:flex-col gap-1">
          {matchMode === 'puzzle' && activePuzzle ? (
            <div className="hud-glass flex items-center gap-2 rounded-2xl px-3 py-1">
              <span className="whitespace-nowrap text-xs font-black text-amber-200">
                残局 #{activePuzzle.number} · {activePuzzle.title}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowPuzzleHint(false);
                  resetActivePuzzle();
                }}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-100 hover:bg-white/20 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 重置
              </button>
              <button
                type="button"
                onClick={() => setShowPuzzleHint((p) => !p)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-500/25 px-2.5 py-1 text-xs font-bold text-emerald-200 hover:bg-emerald-500/35 cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5" /> {showPuzzleHint ? '收起' : '解析'}
              </button>
            </div>
          ) : (
            <>
              <div className="hud-glass flex shrink-0 items-center gap-1.5 sm:gap-2.5 rounded-2xl px-2.5 py-1 short-h:px-2 short-h:py-0.5 shadow-xl whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="short-h-hide text-[11px] font-bold text-amber-200/85">底牌</span>
                  <div className="flex items-center gap-1.5 rounded-xl bg-black/35 px-1.5 py-0.5 ring-1 ring-amber-300/20">
                    {gameState.bottomCards.map((c) => (
                      <PlayingCard
                        key={c.id}
                        card={c}
                        faceDown={!bottomRevealed}
                        size="xs"
                        largeFont={largeCardFont}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-5 w-px bg-amber-300/20" />

                <motion.div
                  key={displayMultiplier}
                  initial={{ scale: 1.18 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 text-xs short-h:text-[11px]"
                >
                  <span className="text-[11px] font-bold text-emerald-200/85">
                    底{gameState.baseScore}
                  </span>
                  <span className="rounded-lg bg-amber-400/25 px-1.5 py-0.5 font-mono text-xs short-h:text-[11px] font-black text-amber-300">
                    ×{displayMultiplier}
                  </span>
                </motion.div>
              </div>

              {/* Compact Docked Card Counter */}
              <CardCounterBar />
            </>
          )}
        </div>

        {/* Right Controls: Large Font + Coach + Fullscreen */}
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={toggleLargeCardFont}
            title="适老大字清晰模式"
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-black transition cursor-pointer ${
              largeCardFont
                ? 'border border-amber-300 bg-amber-400/25 text-amber-200 shadow'
                : 'hud-glass text-emerald-100/80'
            }`}
          >
            <ZoomIn className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 text-amber-300" />
            <span>大字</span>
          </button>

          <button
            type="button"
            onClick={toggleCoachPanel}
            title="AI 教练出牌分析"
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-black transition cursor-pointer ${
              coachPanelOpen
                ? 'game-btn-gold'
                : 'hud-glass text-amber-200 hover:border-amber-300/60'
            }`}
          >
            <Brain className="h-4 w-4 short-h:h-3.5 short-h:w-3.5" />
            <span>教练</span>
          </button>

          <FullscreenButton compact showLabel />
        </div>
      </header>

      {/* Puzzle Description Banner */}
      {matchMode === 'puzzle' && activePuzzle && (
        <div className="relative z-20 mx-auto mt-1 max-w-2xl rounded-xl border border-amber-400/25 bg-black/50 px-3 py-1 text-center text-xs text-emerald-100 backdrop-blur-sm">
          <span className="font-bold text-amber-300">残局目标：</span>
          {activePuzzle.description}
          {showPuzzleHint && (
            <div className="mt-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-emerald-200">
              <span className="font-bold text-emerald-300">破解思路：</span>
              {activePuzzle.solutionExplanation}
            </div>
          )}
        </div>
      )}

      {/* Main Arena: Full-Width Opponents Row + (Win-Rate Bar | Played Cards) */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-2.5 sm:px-5">
        {/* Opponents Row (spans full width so 上家 and 下家 stay anchored to opposite corners) */}
        <div className="flex w-full min-w-0 shrink-0 items-start justify-between gap-2 pt-0.5 sm:pt-1">
          <PlayerSeat
            seat={2}
            name="上家 · 守门大师"
            align="left"
            role={getSeatRole(2)}
            isCurrentTurn={gameState.currentTurn === 2 && gameState.phase !== 'FINISHED'}
            isThinking={aiThinkingSeat === 2}
            isMingpai={matchMode === 'puzzle' || gameState.mingpaiSeats.includes(2)}
            phase={gameState.phase}
            cards={gameState.hands[2]}
            bubble={seatBubbles[2]}
            doubleChoice={gameState.doubleChoices[2]}
            largeFont={largeCardFont}
          />

          <PlayerSeat
            seat={1}
            name="下家 · 快攻专家"
            align="right"
            role={getSeatRole(1)}
            isCurrentTurn={gameState.currentTurn === 1 && gameState.phase !== 'FINISHED'}
            isThinking={aiThinkingSeat === 1}
            isMingpai={matchMode === 'puzzle' || gameState.mingpaiSeats.includes(1)}
            phase={gameState.phase}
            cards={gameState.hands[1]}
            bubble={seatBubbles[1]}
            doubleChoice={gameState.doubleChoices[1]}
            largeFont={largeCardFont}
          />
        </div>

        {/* Middle Stage: Left Edge Win-Rate Meter + Played Cards Felt Stage */}
        <div className="relative flex min-h-0 flex-1 items-stretch overflow-hidden">
          {/* Left Edge Slim Win-Rate Meter with Landlord & Farmer Emblems */}
          <aside className="z-10 mr-1 sm:mr-2.5 flex w-9 sm:w-12 shrink-0 flex-col items-center justify-center py-0.5 sm:py-2">
            <div className="mb-1 flex flex-col items-center text-[9px] sm:text-xs font-black text-amber-300 whitespace-nowrap">
              <RoleEmblemIcon role="landlord" className="h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5" />
              <span>地主 {Math.round(liveWinRate.landlordWinRate)}%</span>
            </div>
            <div className="relative h-14 sm:h-32 md:h-44 w-2.5 sm:w-3 overflow-hidden rounded-full border border-amber-300/45 bg-emerald-950 shadow-inner">
              <motion.div
                className="absolute inset-x-0 top-0 bg-gradient-to-b from-rose-400 via-amber-400 to-amber-600"
                animate={{ height: `${liveWinRate.landlordWinRate}%` }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-1 flex flex-col items-center text-[9px] sm:text-xs font-black text-emerald-300 whitespace-nowrap">
              <span>农民 {Math.round(liveWinRate.farmerWinRate)}%</span>
              <RoleEmblemIcon role="farmer" className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5" />
            </div>
          </aside>

          {/* Played Cards Felt Stage */}
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-between gap-2 px-1 sm:px-8 md:px-14">
            {([2, 0, 1] as const).map((seat) => {
              const play = tablePlays[seat];
              const alignClass =
                seat === 2
                  ? 'justify-start'
                  : seat === 1
                    ? 'justify-end'
                    : 'justify-center';
              const rowAlignClass =
                seat === 2
                  ? 'items-start'
                  : seat === 1
                    ? 'items-end'
                    : 'items-center';
              const initialOffset =
                seat === 2 ? { x: -24, y: 0 } : seat === 1 ? { x: 24, y: 0 } : { x: 0, y: 24 };
              const cardCount = play?.cards.length ?? 0;
              const cardSize: 'sm' | 'md' = isShortLandscape ? 'sm' : 'md';
              const cardWidth = isUltraShort
                ? 44
                : isShortLandscape
                  ? 48
                  : stageWidth >= 1440 && stageHeight >= 820
                    ? 72
                    : 66;
              const baseVisibleStep = isUltraShort
                ? largeCardFont
                  ? 28
                  : 26
                : isShortLandscape
                  ? largeCardFont
                    ? 30
                    : 28
                  : largeCardFont
                    ? 40
                    : 38;
              const visibleStep = cardCount <= 4 && !isUltraShort ? baseVisibleStep + 4 : baseVisibleStep;
              const overlapPx = Math.max(8, cardWidth - visibleStep);
              const maxPerRow = isShortLandscape ? 6 : 10;
              const cardRows = play
                ? play.cards.length > maxPerRow
                  ? [
                      play.cards.slice(0, Math.ceil(play.cards.length / 2)),
                      play.cards.slice(Math.ceil(play.cards.length / 2)),
                    ]
                  : [play.cards]
                : [];

              return (
                <div key={seat} className={`flex min-w-0 flex-1 overflow-visible ${alignClass}`}>
                  <AnimatePresence mode="wait">
                    {play && (
                      <motion.div
                        key={`play-${seat}-${play.cards.map((c) => c.id).join('-')}`}
                        initial={{ opacity: 0, ...initialOffset, scale: 0.85 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className={`flex flex-col ${rowAlignClass}`}
                      >
                        {cardRows.map((row, rowIdx) => (
                          <div
                            key={rowIdx}
                            className={`flex ${rowIdx > 0 ? (isShortLandscape ? '-mt-4' : '-mt-5') : ''}`}
                          >
                            {row.map((c, idx) => (
                              <div
                                key={c.id}
                                style={{
                                  marginLeft: idx === 0 ? 0 : -overlapPx,
                                  zIndex: rowIdx * 20 + idx + 1,
                                }}
                                className="shrink-0"
                              >
                                <PlayingCard card={c} size={cardSize} largeFont={largeCardFont} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Floating AI Coach Drawer */}
          <AnimatePresence>
            {coachPanelOpen && (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="hud-glass absolute right-1 top-2 z-30 max-h-[58%] w-64 sm:w-72 overflow-y-auto rounded-2xl p-3 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Brain className="h-4 w-4" /> AI 大师教练
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={requestLiveCoach}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-400/30 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" /> 重新分析
                    </button>
                    <button
                      type="button"
                      onClick={toggleCoachPanel}
                      aria-label="收起教练"
                      className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {coachLoading ? (
                  <div className="mt-2 text-xs text-emerald-200/80 animate-pulse">
                    正在推演最佳配合与残局算杀路径…
                  </div>
                ) : coachAdvice ? (
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {coachAdvice.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="leading-relaxed text-amber-50">{coachAdvice.reason}</p>
                    <div className="flex items-center justify-between text-xs text-emerald-200/80">
                      <span>预估胜率：{Math.round(coachAdvice.projectedWinRate)}%</span>
                      {!coachAdvice.isPass && isHumanTurn && gameState.phase === 'PLAYING' && (
                        <button
                          type="button"
                          onClick={selectCoachCards}
                          className="game-btn-emerald rounded-lg px-2.5 py-1 text-xs font-black cursor-pointer"
                        >
                          选中推荐牌
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-emerald-200/75">
                    轮到您出牌时将自动生成实时战术建议。
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Hero Action Bar + Full-Width Hand Dock */}
      <div className="relative z-20 flex w-full min-w-0 shrink-0 flex-col items-center gap-1 short-h:gap-0.5 px-2 sm:px-5 pb-1.5">
        <AnimatePresence>
          {seatBubbles[0] && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-xl border border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-0.5 text-xs sm:text-sm font-black text-emerald-950 shadow-lg"
            >
              {seatBubbles[0]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fixed-Height Action Controls Row (on mobile landscape, flanks with compact status & sort so HandBar gets 100% width) */}
        <div
          className={`flex h-[38px] tall-h:h-[46px] w-full shrink-0 items-center gap-1.5 ${
            isShortLandscape ? 'justify-between' : 'justify-center'
          }`}
        >
          {isShortLandscape && (
            <div className="hud-glass flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1 text-xs">
              <RolePortraitSvg role={heroRole} size="sm" />
              <RoleBadge role={heroRole} size="sm" />
              <span className="font-mono text-[11px] font-black text-amber-300">
                {chips.toLocaleString()}
              </span>
              {gameState.phase === 'PLAYING' && gameState.hands[0].length <= 2 && (
                <span className="siren-pulse rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {gameState.hands[0].length === 1 ? '报单' : '报双'}
                </span>
              )}
            </div>
          )}

          <div className="flex min-w-0 flex-1 items-center justify-center">
            {gameState.phase === 'BIDDING' && isHumanTurn ? (
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                <div className="flex h-[36px] tall-h:h-[44px] px-2.5 sm:px-3 items-center justify-center gap-1 rounded-full border-2 border-amber-300/80 bg-black/65 font-mono text-[13px] sm:text-sm font-black text-amber-300 shadow-lg">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" /> {turnSecondsLeft}
                </div>
                <button
                  type="button"
                  onClick={() => humanBid('PASS')}
                  className="game-btn-slate inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-3 sm:px-5 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <Ban className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {gameState.firstCallerSeat === null ? '不叫' : '不抢'}
                </button>
                <button
                  type="button"
                  onClick={() => humanBid(gameState.firstCallerSeat === null ? 'CALL' : 'GRAB')}
                  className="game-btn-gold inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-3.5 sm:px-6 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {gameState.firstCallerSeat === null ? '叫地主' : '抢地主 ×2'}
                </button>
                {!gameState.mingpaiSeats.includes(0) && (
                  <button
                    type="button"
                    onClick={humanMingpai}
                    className="game-btn-crimson inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-3 sm:px-4 text-[13px] sm:text-base font-black cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 明牌 ×4
                  </button>
                )}
              </div>
            ) : gameState.phase === 'DOUBLING' && gameState.doubleChoices[0] === null ? (
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                <div className="flex h-[36px] tall-h:h-[44px] px-2.5 sm:px-3 items-center justify-center gap-1 rounded-full border-2 border-amber-300/80 bg-black/65 font-mono text-[13px] sm:text-sm font-black text-amber-300 shadow-lg">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" /> {turnSecondsLeft}
                </div>
                <button
                  type="button"
                  onClick={() => humanDouble(1)}
                  className="game-btn-slate inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-3 sm:px-5 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <Ban className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 不加倍
                </button>
                <button
                  type="button"
                  onClick={() => humanDouble(2)}
                  className="game-btn-gold inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-3 sm:px-5 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <ChevronsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 加倍 ×2
                </button>
                <button
                  type="button"
                  onClick={() => humanDouble(4)}
                  className="game-btn-crimson inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-3 sm:px-5 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 超级加倍 ×4
                </button>
              </div>
            ) : gameState.phase === 'PLAYING' && isHumanTurn ? (
              <div className="flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap">
                <div
                  className={`flex h-[36px] tall-h:h-[44px] px-2.5 items-center justify-center gap-1 rounded-full border-2 bg-black/70 font-mono text-[13px] sm:text-sm font-black shadow-lg ${
                    turnSecondsLeft <= 5
                      ? 'border-rose-400 text-rose-300 animate-pulse'
                      : 'border-amber-300/80 text-amber-300'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{turnSecondsLeft}</span>
                  <span className="short-h-hide text-[11px] font-sans text-amber-100">轮到您</span>
                </div>

                {gameState.lastPlay !== null && (
                  <button
                    type="button"
                    onClick={humanPass}
                    className="game-btn-slate inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-2.5 sm:px-4 text-[13px] sm:text-base font-black cursor-pointer"
                  >
                    <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 不要
                  </button>
                )}

                <button
                  type="button"
                  onClick={cycleHint}
                  className="game-btn-sky inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-2.5 sm:px-4 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 提示
                </button>

                <button
                  type="button"
                  onClick={requestLiveCoach}
                  className="game-btn-emerald inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-2.5 sm:px-4 text-[13px] sm:text-base font-black cursor-pointer"
                >
                  <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 教练
                </button>

                {selectedCardIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="hud-glass inline-flex h-[36px] tall-h:h-[44px] items-center gap-1 rounded-xl px-2.5 sm:px-3 text-[13px] sm:text-sm font-bold text-amber-100 hover:border-amber-300/60 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 重选
                  </button>
                )}

                <button
                  type="button"
                  disabled={!matchedSelection}
                  onClick={humanPlaySelected}
                  className={`inline-flex h-[36px] tall-h:h-[44px] items-center gap-1.5 rounded-xl px-3 sm:px-6 text-[13px] sm:text-base font-black transition ${
                    matchedSelection
                      ? 'game-btn-gold cursor-pointer'
                      : 'cursor-not-allowed border border-white/15 bg-black/50 text-white/40'
                  }`}
                >
                  <ArrowUpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {matchedSelection ? `出牌 · ${formatPatternLabel(matchedSelection)}` : '出牌'}
                </button>
              </div>
            ) : (
              waitTurnLabel &&
              gameState.phase !== 'FINISHED' && (
                <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-bold text-emerald-200/75">
                  {waitTurnLabel}
                </div>
              )
            )}
          </div>

          {isShortLandscape && (
            <button
              type="button"
              onClick={toggleSortMode}
              title="切换手牌排序方式"
              className="hud-glass flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-black text-amber-200 hover:border-amber-300/60 cursor-pointer whitespace-nowrap"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-amber-300" />
              <span>{sortMode === 'rank' ? '按点数' : '按牌型'}</span>
            </button>
          )}
        </div>

        {/* Hero Hand Row: Full width on short landscape; flanked by status & sort on desktop/tall viewports */}
        <div className="flex w-full min-w-0 items-end justify-between gap-1 sm:gap-1.5">
          {!isShortLandscape && (
            <div className="hud-glass hidden sm:flex forced-l:flex shrink-0 items-center gap-1.5 rounded-2xl px-2 py-1.5 text-xs">
              <div className="flex items-center gap-1">
                <RolePortraitSvg role={heroRole} size="sm" />
                <RoleBadge role={heroRole} size="sm" />
              </div>
              <span className="font-bold" style={{ color: tier.badgeColor }}>
                {tier.name}
              </span>
              <ChipBalancePill chips={chips} lastDelta={lastChipDelta} compact />
              {gameState.phase === 'PLAYING' && gameState.hands[0].length <= 2 && (
                <span className="siren-pulse rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                  {gameState.hands[0].length === 1 ? '报单' : '报双'}
                </span>
              )}
            </div>
          )}

          <div className="flex min-w-0 flex-1 justify-center">
            <HandBar />
          </div>

          {!isShortLandscape && (
            <div className="shrink-0 flex items-center gap-1.5 pb-1">
              <button
                type="button"
                onClick={toggleSortMode}
                title="切换手牌排序方式"
                className="hud-glass flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-black text-amber-200 hover:border-amber-300/60 cursor-pointer whitespace-nowrap"
              >
                <ArrowUpDown className="h-4 w-4 text-amber-300" />
                <span>{sortMode === 'rank' ? '按点数' : '按牌型'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compact Mobile Portrait Hero Info Bar (only if narrow non-forced portrait) */}
      <div className="flex sm:hidden forced-l:hidden shrink-0 items-center justify-between border-t border-amber-400/15 bg-black/50 px-3 py-1 text-xs">
        <div className="flex items-center gap-2">
          <RoleBadge role={heroRole} size="sm" />
          <span className="font-bold" style={{ color: tier.badgeColor }}>
            {tier.name}
          </span>
        </div>
        <ChipBalancePill chips={chips} lastDelta={lastChipDelta} compact />
      </div>

      <BlindQuizModal />

      {gameState.phase === 'FINISHED' && (
        <SettlementModal
          gameState={gameState}
          onPlayAgain={() => (matchMode === 'puzzle' ? resetActivePuzzle() : startMatch())}
          onReturnHub={returnToHub}
          onExitToLobby={onExitToLobby}
        />
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  Brain,
  Clock,
  Eye,
  Home,
  Lightbulb,
  MessageSquare,
  MessageSquareOff,
  RotateCcw,
  Sparkles,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  calculatePublicMultiplier,
  formatPatternLabel,
  matchPatternToBeat,
} from '../engine';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { TableEffects } from '../../../shared/effects/TableEffects';
import { ChipBalancePill, FullscreenButton } from '../../../shared/components';
import { getRankTier, usePlayerStore } from '../../../shared/store/playerStore';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';
import { HandBar } from './HandBar';
import { CardCounterBar } from './CardCounterBar';
import { BlindQuizModal } from './BlindQuizModal';
import { PlayerSeat } from './PlayerSeat';
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

  return (
    <div
      className={`doudizhu-stage-bg safe-area-pad relative flex h-[100dvh] w-screen flex-col overflow-hidden select-none ${
        shakeScreen ? 'table-shake' : ''
      }`}
    >
      {/* Mahogany Perimeter Bezel & Subtle Gold Felt Inlay */}
      <div className="pointer-events-none fixed inset-0 border-[6px] border-[#26140b] sm:border-[10px]" />
      <div className="pointer-events-none fixed inset-[6px] sm:inset-[10px] rounded-2xl border border-amber-300/20" />

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

      {/* Top Floating HUD Row (Tencent Happy Dou Dizhu Style) */}
      <header className="short-h-compact relative z-20 flex shrink-0 items-center justify-between gap-1.5 px-2.5 pt-1.5 sm:px-5 sm:pt-2.5">
        {/* Left Navigation & Audio Icons */}
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={onExitToLobby}
            title="返回大厅"
            className="hud-glass flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-amber-200 transition hover:border-amber-300/60 cursor-pointer"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="short-h-hide hidden sm:inline">大厅</span>
          </button>
          <button
            type="button"
            onClick={matchMode === 'puzzle' ? openPuzzlesScreen : returnToHub}
            title={matchMode === 'puzzle' ? '残局列表' : '斗地主专区'}
            className="hud-glass flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-amber-100 transition hover:border-amber-300/60 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="short-h-hide hidden md:inline">
              {matchMode === 'puzzle' ? '残局' : '专区'}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleSfx}
            title="音效开关"
            className="hud-glass rounded-xl p-1.5 text-xs font-bold transition cursor-pointer"
          >
            {sfxEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            title="中文语音播报"
            className="hud-glass rounded-xl p-1.5 text-xs font-bold transition cursor-pointer"
          >
            {voiceEnabled ? (
              <MessageSquare className="h-3.5 w-3.5 text-emerald-300" />
            ) : (
              <MessageSquareOff className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
          <span className="short-h-hide hidden lg:inline-flex rounded-xl border border-amber-400/25 bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-amber-200">
            {matchMode === 'puzzle' && activePuzzle
              ? `残局 #${activePuzzle.number} · ${activePuzzle.title}`
              : matchMode === 'replay-resume'
                ? '复盘重打 · 大师 AI'
                : DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        {/* Center Recessed Bottom-Cards Tray + Multiplier + Docked CardCounter */}
        <div className="flex items-center [@media(min-height:541px)]:flex-col gap-1">
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
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold text-amber-100 hover:bg-white/20 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" /> 重置
              </button>
              <button
                type="button"
                onClick={() => setShowPuzzleHint((p) => !p)}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-500/25 px-2 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/35 cursor-pointer"
              >
                <BookOpen className="h-3 w-3" /> {showPuzzleHint ? '收起' : '解析'}
              </button>
            </div>
          ) : (
            <>
              <div className="hud-glass flex shrink-0 items-center gap-1.5 sm:gap-2.5 rounded-2xl px-2.5 py-1 shadow-xl whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <span className="short-h-hide text-[10px] font-bold text-amber-200/80">底牌</span>
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

                <div className="h-5 w-px bg-amber-300/20" />

                <motion.div
                  key={displayMultiplier}
                  initial={{ scale: 1.18 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1 text-xs"
                >
                  <span className="text-[10px] font-bold text-emerald-200/80">
                    底{gameState.baseScore}
                  </span>
                  <span className="rounded-lg bg-amber-400/20 px-1.5 py-0.5 font-mono text-xs font-black text-amber-300">
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
            title="大字清晰模式"
            className={`hud-glass flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-xs font-bold transition cursor-pointer ${
              largeCardFont ? 'border-amber-300 text-amber-200' : 'text-emerald-100/75'
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            <span className="short-h-hide hidden md:inline">大字</span>
          </button>

          <button
            type="button"
            onClick={toggleCoachPanel}
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-xs font-black transition cursor-pointer ${
              coachPanelOpen
                ? 'game-btn-gold'
                : 'hud-glass text-amber-200 hover:border-amber-300/60'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            <span className="short-h-hide hidden sm:inline">教练</span>
          </button>

          <FullscreenButton compact />
        </div>
      </header>

      {/* Puzzle Description Banner */}
      {matchMode === 'puzzle' && activePuzzle && (
        <div className="relative z-20 mx-auto mt-1 max-w-2xl rounded-xl border border-amber-400/25 bg-black/50 px-3 py-1 text-center text-[11px] text-emerald-100 backdrop-blur-sm">
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

      {/* Main Arena: Win-Rate Balance Bar + Opponents + Played Cards + Hero Hand */}
      <div className="relative z-10 flex min-h-0 flex-1 items-stretch px-2 sm:px-5 pb-1.5">
        {/* Left Edge Slim Win-Rate Meter */}
        <aside className="z-10 mr-1.5 sm:mr-3 flex shrink-0 flex-col items-center justify-center py-2">
          <div className="mb-1 text-[9px] sm:text-[10px] font-black text-amber-300">
            地主 {Math.round(liveWinRate.landlordWinRate)}%
          </div>
          <div className="relative h-28 sm:h-44 md:h-56 w-2.5 sm:w-3 overflow-hidden rounded-full border border-amber-300/45 bg-emerald-950 shadow-inner">
            <motion.div
              className="absolute inset-x-0 top-0 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600"
              animate={{ height: `${liveWinRate.landlordWinRate}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-1 text-[9px] sm:text-[10px] font-black text-emerald-300">
            农民 {Math.round(liveWinRate.farmerWinRate)}%
          </div>
        </aside>

        {/* Center Playing Stage */}
        <div className="relative flex min-h-0 flex-1 flex-col justify-between">
          {/* Opponents Row */}
          <div className="flex items-start justify-between gap-2 pt-1">
            <PlayerSeat
              seat={2}
              name="上家 · 守门大师"
              align="left"
              isLandlord={gameState.landlordSeat === 2}
              isCurrentTurn={gameState.currentTurn === 2 && gameState.phase !== 'FINISHED'}
              isThinking={aiThinkingSeat === 2}
              isMingpai={matchMode === 'puzzle' || gameState.mingpaiSeats.includes(2)}
              phase={gameState.phase}
              cards={gameState.hands[2]}
              bubble={seatBubbles[2]}
              doubleChoice={gameState.doubleChoices[2]}
            />

            <PlayerSeat
              seat={1}
              name="下家 · 快攻专家"
              align="right"
              isLandlord={gameState.landlordSeat === 1}
              isCurrentTurn={gameState.currentTurn === 1 && gameState.phase !== 'FINISHED'}
              isThinking={aiThinkingSeat === 1}
              isMingpai={matchMode === 'puzzle' || gameState.mingpaiSeats.includes(1)}
              phase={gameState.phase}
              cards={gameState.hands[1]}
              bubble={seatBubbles[1]}
              doubleChoice={gameState.doubleChoices[1]}
            />
          </div>

          {/* Played Cards Felt Stage */}
          <div className="relative my-auto flex min-h-[48px] [@media(min-height:541px)]:min-h-[104px] items-center justify-between px-3 sm:px-10 md:px-16">
            <div className="flex min-w-[90px] sm:min-w-[140px] justify-start">
              <AnimatePresence mode="wait">
                {tablePlays[2] && (
                  <motion.div
                    key={`play-2-${tablePlays[2].cards.map((c) => c.id).join('-')}`}
                    initial={{ opacity: 0, x: -24, scale: 0.85 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="flex"
                  >
                    {tablePlays[2].cards.map((c) => (
                      <div key={c.id} className="-ml-5 sm:-ml-6 first:ml-0">
                        <PlayingCard card={c} size="md" largeFont={largeCardFont} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-center">
              <AnimatePresence mode="wait">
                {tablePlays[0] && (
                  <motion.div
                    key={`play-0-${tablePlays[0].cards.map((c) => c.id).join('-')}`}
                    initial={{ opacity: 0, y: 24, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="flex"
                  >
                    {tablePlays[0].cards.map((c) => (
                      <div key={c.id} className="-ml-5 sm:-ml-6 first:ml-0">
                        <PlayingCard card={c} size="md" largeFont={largeCardFont} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex min-w-[90px] sm:min-w-[140px] justify-end">
              <AnimatePresence mode="wait">
                {tablePlays[1] && (
                  <motion.div
                    key={`play-1-${tablePlays[1].cards.map((c) => c.id).join('-')}`}
                    initial={{ opacity: 0, x: 24, scale: 0.85 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="flex"
                  >
                    {tablePlays[1].cards.map((c) => (
                      <div key={c.id} className="-ml-5 sm:-ml-6 first:ml-0">
                        <PlayingCard card={c} size="md" largeFont={largeCardFont} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Floating AI Coach Drawer */}
          <AnimatePresence>
            {coachPanelOpen && (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="hud-glass absolute right-1 top-2 z-30 max-h-[58dvh] w-64 sm:w-72 overflow-y-auto rounded-2xl p-3 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Brain className="h-4 w-4" /> AI 大师教练
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={requestLiveCoach}
                      className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-400/30 cursor-pointer"
                    >
                      重新分析
                    </button>
                    <button
                      type="button"
                      onClick={toggleCoachPanel}
                      aria-label="收起教练"
                      className="rounded-lg p-0.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
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
                    <div className="flex items-center justify-between text-[11px] text-emerald-200/75">
                      <span>预估胜率：{Math.round(coachAdvice.projectedWinRate)}%</span>
                      {!coachAdvice.isPass && isHumanTurn && gameState.phase === 'PLAYING' && (
                        <button
                          type="button"
                          onClick={selectCoachCards}
                          className="game-btn-emerald rounded-lg px-2.5 py-1 text-[11px] font-black cursor-pointer"
                        >
                          选中推荐牌
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-emerald-200/70">
                    轮到您出牌时将自动生成实时战术建议。
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Hero Action Bar + Hand + Integrated Profile Dock */}
          <div className="z-20 flex flex-col items-center gap-1">
            <AnimatePresence>
              {seatBubbles[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-0.5 text-xs font-black text-emerald-950 shadow-lg"
                >
                  {seatBubbles[0]}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tactile 3D Action Controls */}
            {gameState.phase === 'BIDDING' && isHumanTurn && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="flex h-8 w-14 items-center justify-center gap-1 rounded-full border-2 border-amber-300/75 bg-black/60 font-mono text-xs font-black text-amber-300 shadow-lg">
                  <Clock className="h-3.5 w-3.5 text-amber-400" /> {turnSecondsLeft}
                </div>
                <button
                  type="button"
                  onClick={() => humanBid('PASS')}
                  className="game-btn-slate rounded-xl px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  {gameState.firstCallerSeat === null ? '不叫' : '不抢'}
                </button>
                <button
                  type="button"
                  onClick={() => humanBid(gameState.firstCallerSeat === null ? 'CALL' : 'GRAB')}
                  className="game-btn-gold rounded-xl px-5 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  {gameState.firstCallerSeat === null ? '叫地主' : '抢地主 ×2'}
                </button>
                {!gameState.mingpaiSeats.includes(0) && (
                  <button
                    type="button"
                    onClick={humanMingpai}
                    className="game-btn-crimson flex items-center gap-1 rounded-xl px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> 明牌 ×4
                  </button>
                )}
              </div>
            )}

            {gameState.phase === 'DOUBLING' && gameState.doubleChoices[0] === null && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => humanDouble(1)}
                  className="game-btn-slate rounded-xl px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  不加倍
                </button>
                <button
                  type="button"
                  onClick={() => humanDouble(2)}
                  className="game-btn-gold rounded-xl px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  加倍 ×2
                </button>
                <button
                  type="button"
                  onClick={() => humanDouble(4)}
                  className="game-btn-crimson flex items-center gap-1 rounded-xl px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" /> 超级加倍 ×4
                </button>
              </div>
            )}

            {gameState.phase === 'PLAYING' && isHumanTurn && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                <div
                  className={`flex h-8 w-14 items-center justify-center gap-1 rounded-full border-2 bg-black/65 font-mono text-xs font-black shadow-lg ${
                    turnSecondsLeft <= 5
                      ? 'border-rose-400 text-rose-300 animate-pulse'
                      : 'border-amber-300/75 text-amber-300'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" /> {turnSecondsLeft}
                </div>

                {gameState.lastPlay !== null && (
                  <button
                    type="button"
                    onClick={humanPass}
                    className="game-btn-slate rounded-xl px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                  >
                    不要
                  </button>
                )}

                <button
                  type="button"
                  onClick={cycleHint}
                  className="game-btn-sky flex items-center gap-1 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  <Lightbulb className="h-3.5 w-3.5" /> 提示
                </button>

                <button
                  type="button"
                  onClick={requestLiveCoach}
                  className="game-btn-emerald flex items-center gap-1 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-black cursor-pointer"
                >
                  <Brain className="h-3.5 w-3.5" /> 教练
                </button>

                {selectedCardIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="hud-glass flex items-center gap-1 rounded-xl px-2.5 py-1.5 sm:py-2 text-xs font-bold text-amber-100 hover:border-amber-300/60 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 重选
                  </button>
                )}

                <button
                  type="button"
                  disabled={!matchedSelection}
                  onClick={humanPlaySelected}
                  className={`rounded-xl px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-black transition ${
                    matchedSelection
                      ? 'game-btn-gold cursor-pointer'
                      : 'cursor-not-allowed border border-white/15 bg-black/45 text-white/35'
                  }`}
                >
                  {matchedSelection ? `出牌 · ${formatPatternLabel(matchedSelection)}` : '出牌'}
                </button>
              </div>
            )}

            {/* Hero Hand + Flanked Floating Info & Sort Pills */}
            <div className="relative flex w-full items-end justify-center">
              {/* Left Floating Hero Status Capsule */}
              <div className="hud-glass hidden sm:flex [@media(max-height:540px)]:flex-col [@media(max-height:540px)]:items-start [@media(max-height:540px)]:gap-0.5 [@media(max-height:540px)]:px-1.5 [@media(max-height:540px)]:py-1 items-center gap-1.5 rounded-2xl px-2 py-1 text-[10px] md:text-[11px] absolute left-0 bottom-1">
                <span
                  className={`rounded-full px-1.5 py-0.5 font-black ${
                    gameState.landlordSeat === 0
                      ? 'border border-amber-400/50 bg-amber-400/20 text-amber-300'
                      : 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                  }`}
                >
                  {gameState.landlordSeat === null
                    ? '叫分'
                    : gameState.landlordSeat === 0
                      ? '地主'
                      : '农民'}
                </span>
                <span className="short-h-hide font-bold" style={{ color: tier.badgeColor }}>
                  {tier.name}
                </span>
                <ChipBalancePill chips={chips} lastDelta={lastChipDelta} compact />
                {gameState.phase === 'PLAYING' && gameState.hands[0].length <= 2 && (
                  <span className="siren-pulse rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                    {gameState.hands[0].length === 1 ? '报单' : '报双'}
                  </span>
                )}
              </div>

              <HandBar />

              {/* Right Floating Sort Pill */}
              <div className="absolute right-0 bottom-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSortMode}
                  className="hud-glass flex items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] sm:text-[11px] font-bold text-amber-200 hover:border-amber-300/60 cursor-pointer whitespace-nowrap"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span>{sortMode === 'rank' ? '点数' : '牌型'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Mobile Portrait Hero Info Bar (only on < sm narrow portrait) */}
      <div className="flex sm:hidden shrink-0 items-center justify-between border-t border-amber-400/15 bg-black/50 px-3 py-1 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              gameState.landlordSeat === 0
                ? 'bg-amber-400/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-200'
            }`}
          >
            {gameState.landlordSeat === null
              ? '叫分阶段'
              : gameState.landlordSeat === 0
                ? '地主（你）'
                : '农民（你）'}
          </span>
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

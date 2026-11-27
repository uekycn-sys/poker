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
  RotateCcw,
  Sparkles,
  Type,
  Volume2,
  VolumeX,
  MessageSquare,
  MessageSquareOff,
} from 'lucide-react';
import {
  calculatePublicMultiplier,
  formatPatternLabel,
  matchPatternToBeat,
} from '../engine';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { TableEffects } from '../../../shared/effects/TableEffects';
import { ChipBalancePill } from '../../../shared/components/ChipAnimation';
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
      className={`felt-table relative flex h-screen w-screen flex-col overflow-hidden select-none ${
        shakeScreen ? 'table-shake' : ''
      }`}
    >
      <div className="pointer-events-none fixed inset-2 rounded-3xl border border-amber-400/20" />

      <TableEffects fx={activeFx} onComplete={clearActiveFx} />

      <header className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/15 bg-black/30 px-3 py-2 backdrop-blur-md md:px-5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onExitToLobby}
            className="flex items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
          >
            <Home className="h-3.5 w-3.5" /> 大厅
          </button>
          <button
            type="button"
            onClick={matchMode === 'puzzle' ? openPuzzlesScreen : returnToHub}
            className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {matchMode === 'puzzle' ? '残局列表' : '斗地主专区'}
          </button>
          <span className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-200">
            {matchMode === 'puzzle' && activePuzzle
              ? `残局 #${activePuzzle.number} · ${activePuzzle.title}`
              : matchMode === 'replay-resume'
                ? '复盘重打 · 大师 AI'
                : DIFFICULTY_LABELS[difficulty]}
          </span>
        </div>

        {matchMode === 'puzzle' && activePuzzle ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPuzzleHint(false);
                resetActivePuzzle();
              }}
              className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 重置本关
            </button>
            <button
              type="button"
              onClick={() => setShowPuzzleHint((p) => !p)}
              className="flex items-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5" /> {showPuzzleHint ? '收起解析' : '查看解析'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-amber-400/25 bg-black/35 px-2.5 py-1">
              <span className="mr-1 text-[11px] font-bold text-amber-200/80">底牌</span>
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

            <motion.div
              key={displayMultiplier}
              initial={{ scale: 1.18 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-1.5 text-xs"
            >
              <span className="text-emerald-200/75">底分 {gameState.baseScore}</span>
              <span className="font-mono text-sm font-black text-amber-300">×{displayMultiplier}</span>
            </motion.div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleSfx}
            title="音效开关"
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              sfxEnabled
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            {sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            title="中文语音播报"
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              voiceEnabled
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            {voiceEnabled ? (
              <MessageSquare className="h-4 w-4" />
            ) : (
              <MessageSquareOff className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleLargeCardFont}
            title="大字清晰模式"
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              largeCardFont
                ? 'border-amber-300/50 bg-amber-400/25 text-amber-200'
                : 'border-white/10 bg-white/5 text-emerald-100/70'
            }`}
          >
            <Type className="h-3.5 w-3.5" /> 大字
          </button>
          <button
            type="button"
            onClick={toggleCoachPanel}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              coachPanelOpen
                ? 'border-amber-300 bg-amber-400 text-emerald-950 shadow'
                : 'border-amber-400/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
            }`}
          >
            <Brain className="h-3.5 w-3.5" /> 教练模式
          </button>
        </div>
      </header>

      {matchMode === 'puzzle' && activePuzzle ? (
        <div className="relative z-20 border-b border-amber-400/15 bg-black/25 px-4 py-1.5 text-xs text-emerald-100">
          <span className="font-bold text-amber-300">残局目标：</span>
          {activePuzzle.description}
          {showPuzzleHint && (
            <div className="mt-1 rounded-lg bg-emerald-500/15 px-3 py-1 text-emerald-200">
              <span className="font-bold text-emerald-300">破解思路：</span>
              {activePuzzle.solutionExplanation}
            </div>
          )}
        </div>
      ) : (
        <CardCounterBar />
      )}

      <div className="relative flex flex-1 items-stretch overflow-hidden px-3 py-2 md:px-6">
        <aside className="z-10 mr-2 flex flex-col items-center justify-center py-4 md:mr-4">
          <div className="mb-1 text-[10px] font-bold text-amber-300">
            地主 {Math.round(liveWinRate.landlordWinRate)}%
          </div>
          <div className="relative h-48 md:h-64 w-3.5 overflow-hidden rounded-full border border-amber-300/40 bg-emerald-950 shadow-inner">
            <motion.div
              className="absolute inset-x-0 top-0 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500"
              animate={{ height: `${liveWinRate.landlordWinRate}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-1 text-[10px] font-bold text-emerald-300">
            农民 {Math.round(liveWinRate.farmerWinRate)}%
          </div>
        </aside>

        <div className="relative flex flex-1 flex-col justify-between">
          <div className="mt-1 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
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
            </div>

            <div className="flex items-start gap-3">
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
          </div>

          <div className="relative my-auto flex min-h-[120px] items-center justify-between px-4 md:px-14">
            <div className="flex min-w-[140px] justify-start">
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
                      <div key={c.id} className="-ml-6 first:ml-0">
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
                    initial={{ opacity: 0, y: 26, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="flex"
                  >
                    {tablePlays[0].cards.map((c) => (
                      <div key={c.id} className="-ml-6 first:ml-0">
                        <PlayingCard card={c} size="md" largeFont={largeCardFont} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex min-w-[140px] justify-end">
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
                      <div key={c.id} className="-ml-6 first:ml-0">
                        <PlayingCard card={c} size="md" largeFont={largeCardFont} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {coachPanelOpen && (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="absolute right-1 top-28 z-30 w-72 rounded-2xl border border-amber-300/45 bg-emerald-950/92 p-3.5 shadow-2xl backdrop-blur-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Brain className="h-4 w-4" /> AI 大师教练
                  </div>
                  <button
                    type="button"
                    onClick={requestLiveCoach}
                    className="rounded-lg bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-400/30 cursor-pointer"
                  >
                    重新分析
                  </button>
                </div>

                {coachLoading ? (
                  <div className="mt-2.5 text-xs text-emerald-200/80 animate-pulse">
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
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 font-bold text-emerald-950 hover:brightness-110 cursor-pointer"
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

          <div className="z-20 flex flex-col items-center gap-2">
            <AnimatePresence>
              {seatBubbles[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl bg-amber-400 px-3.5 py-1 text-xs font-black text-emerald-950 shadow-lg"
                >
                  {seatBubbles[0]}
                </motion.div>
              )}
            </AnimatePresence>

            {gameState.phase === 'BIDDING' && isHumanTurn && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-xs font-mono font-bold text-amber-300">
                  <Clock className="h-3.5 w-3.5" /> {turnSecondsLeft}s
                </span>
                <button
                  type="button"
                  onClick={() => humanBid('PASS')}
                  className="rounded-xl border border-white/20 bg-slate-800/80 px-5 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  {gameState.firstCallerSeat === null ? '不叫' : '不抢'}
                </button>
                <button
                  type="button"
                  onClick={() => humanBid(gameState.firstCallerSeat === null ? 'CALL' : 'GRAB')}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-2 text-sm font-black text-emerald-950 shadow-lg hover:brightness-105 cursor-pointer"
                >
                  {gameState.firstCallerSeat === null ? '叫地主' : '抢地主 ×2'}
                </button>
                {!gameState.mingpaiSeats.includes(0) && (
                  <button
                    type="button"
                    onClick={humanMingpai}
                    className="flex items-center gap-1 rounded-xl border border-rose-400/50 bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-200 hover:bg-rose-500/30 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" /> 明牌 ×4
                  </button>
                )}
              </div>
            )}

            {gameState.phase === 'DOUBLING' && gameState.doubleChoices[0] === null && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => humanDouble(1)}
                  className="rounded-xl border border-white/20 bg-slate-800/80 px-5 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  不加倍
                </button>
                <button
                  type="button"
                  onClick={() => humanDouble(2)}
                  className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-black text-emerald-950 shadow-lg hover:brightness-105 cursor-pointer"
                >
                  加倍 ×2
                </button>
                <button
                  type="button"
                  onClick={() => humanDouble(4)}
                  className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-5 py-2 text-sm font-black text-white shadow-lg hover:brightness-105 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> 超级加倍 ×4
                </button>
              </div>
            )}

            {gameState.phase === 'PLAYING' && isHumanTurn && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-black/45 px-3 py-1 text-xs font-mono font-bold text-amber-300">
                  <Clock className="h-3.5 w-3.5" /> {turnSecondsLeft}s
                </span>

                {gameState.lastPlay !== null && (
                  <button
                    type="button"
                    onClick={humanPass}
                    className="rounded-xl border border-white/20 bg-slate-800/85 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    不要
                  </button>
                )}

                <button
                  type="button"
                  onClick={cycleHint}
                  className="flex items-center gap-1 rounded-xl border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-500/30 cursor-pointer"
                >
                  <Lightbulb className="h-4 w-4" /> 提示
                </button>

                <button
                  type="button"
                  onClick={requestLiveCoach}
                  className="flex items-center gap-1 rounded-xl border border-emerald-400/45 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
                >
                  <Brain className="h-4 w-4" /> 教练分析
                </button>

                {selectedCardIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> 重选
                  </button>
                )}

                <button
                  type="button"
                  disabled={!matchedSelection}
                  onClick={humanPlaySelected}
                  className={`rounded-xl px-6 py-2 text-sm font-black shadow-lg transition ${
                    matchedSelection
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-emerald-950 hover:brightness-105 cursor-pointer'
                      : 'cursor-not-allowed border border-white/10 bg-white/10 text-white/35'
                  }`}
                >
                  {matchedSelection ? `出牌 · ${formatPatternLabel(matchedSelection)}` : '出牌'}
                </button>
              </div>
            )}

            <HandBar />
          </div>
        </div>
      </div>

      <footer className="relative z-20 flex items-center justify-between border-t border-amber-400/15 bg-black/35 px-4 py-2 text-xs backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 font-bold ${
              gameState.landlordSeat === 0
                ? 'border border-amber-400/50 bg-amber-400/20 text-amber-300'
                : 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
            }`}
          >
            {gameState.landlordSeat === null
              ? '叫分阶段'
              : gameState.landlordSeat === 0
                ? '地主（你）'
                : '农民（你）'}
          </span>
          <span className="font-bold" style={{ color: tier.badgeColor }}>
            {tier.name} · {rankPoints}分
          </span>
          <ChipBalancePill chips={chips} lastDelta={lastChipDelta} compact />
          {gameState.phase === 'PLAYING' && gameState.hands[0].length <= 2 && (
            <span className="siren-pulse rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
              {gameState.hands[0].length === 1 ? '你已报单' : '你已报双'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-emerald-200/70 md:inline">
            提示：按住手牌横向滑动可连选 / 智能提炼顺子连对
          </span>
          <button
            type="button"
            onClick={toggleSortMode}
            className="flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-1 font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortMode === 'rank' ? '理牌：按点数' : '理牌：按炸弹/牌型'}
          </button>
        </div>
      </footer>

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

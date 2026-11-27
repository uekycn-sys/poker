import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  History,
  Home,
  LayoutGrid,
  Puzzle,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ENDGAME_PUZZLES, GameState } from '../engine';
import { getRankTier, usePlayerStore } from '../../../shared/store/playerStore';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';
import { DoudizhuRole, RoleBadge, RolePortraitSvg } from './RoleIcons';

interface SettlementModalProps {
  gameState: GameState;
  onPlayAgain: () => void;
  onReturnHub: () => void;
  onExitToLobby: () => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  gameState,
  onPlayAgain,
  onReturnHub,
  onExitToLobby,
}) => {
  const settlement = gameState.settlement;
  const matchMode = useDoudizhuGameStore((s) => s.matchMode);
  const activePuzzle = useDoudizhuGameStore((s) => s.activePuzzle);
  const puzzleRewardGranted = useDoudizhuGameStore((s) => s.puzzleRewardGranted);
  const startPuzzle = useDoudizhuGameStore((s) => s.startPuzzle);
  const openPuzzlesScreen = useDoudizhuGameStore((s) => s.openPuzzlesScreen);
  const openReplayScreen = useDoudizhuGameStore((s) => s.openReplayScreen);

  const recentMatches = useDoudizhuProfileStore((s) => s.recentMatches);
  const chips = usePlayerStore((s) => s.chips);
  const rankPoints = usePlayerStore((s) => s.rankPoints);
  const tier = getRankTier(rankPoints);

  if (!settlement || gameState.landlordSeat === null) return null;

  const humanIsLandlord = gameState.landlordSeat === 0;
  const humanRole: DoudizhuRole = humanIsLandlord ? 'landlord' : 'farmer';
  const humanWon =
    (humanIsLandlord && settlement.winnerRole === 'landlord') ||
    (!humanIsLandlord && settlement.winnerRole === 'farmer');

  const humanDelta = settlement.beanDeltas[0];

  const nextPuzzle =
    activePuzzle !== null
      ? ENDGAME_PUZZLES.find((p) => p.number === activePuzzle.number + 1) ?? null
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={`relative max-h-[94%] w-full max-w-2xl overflow-y-auto rounded-2xl sm:rounded-3xl border p-3.5 sm:p-5 shadow-2xl ${
          humanWon
            ? 'border-amber-300/75 bg-gradient-to-b from-[#133b2b] via-[#0c291d] to-[#071912]'
            : 'border-slate-500/45 bg-gradient-to-b from-slate-900 via-emerald-950 to-[#05140e]'
        }`}
      >
        {matchMode === 'puzzle' && activePuzzle ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 forced-l:grid-cols-2 items-center gap-3 sm:gap-5">
            {/* Left Column: Puzzle Outcome + Identity */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg ${
                    humanWon
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
                      : 'border-slate-500/40 bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <Puzzle className="h-6 w-6" />
                </div>
                <RolePortraitSvg role={humanRole} size="md" />
              </div>

              <h2
                className={`mt-2.5 text-xl sm:text-2xl font-black tracking-wide ${
                  humanWon ? 'text-amber-200' : 'text-slate-200'
                }`}
              >
                {humanWon ? '残局破解成功！' : '差之毫厘，再试一次'}
              </h2>

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-xs">
                <RoleBadge role={humanRole} size="sm" />
                {puzzleRewardGranted && (
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 font-bold text-amber-300">
                    首通奖励 +{puzzleRewardGranted} 金币
                  </span>
                )}
              </div>
            </div>

            {/* Right Column: Solution + Actions */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-400/25 bg-black/35 p-3 sm:p-4 text-xs">
                <div className="font-black text-amber-200">
                  残局 #{activePuzzle.number} · {activePuzzle.title}
                </div>
                <p className="mt-1 leading-relaxed text-emerald-100/90">
                  {activePuzzle.solutionExplanation}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" /> 重玩本关
                </button>
                {humanWon && nextPuzzle ? (
                  <button
                    type="button"
                    onClick={() => startPuzzle(nextPuzzle)}
                    className="game-btn-gold flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black cursor-pointer"
                  >
                    下一关 <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openPuzzlesScreen}
                    className="game-btn-gold flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" /> 残局列表
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 forced-l:grid-cols-2 items-center gap-3 sm:gap-5">
            {/* Left Column: Victory/Defeat Header + Role + Coins */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-2xl border shadow-lg ${
                    humanWon
                      ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
                      : 'border-slate-500/40 bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <Trophy className="h-6 w-6" />
                </div>
                <RolePortraitSvg role={humanRole} size="md" />
              </div>

              <h2
                className={`mt-2 text-xl sm:text-2xl font-black tracking-wide ${
                  humanWon ? 'text-amber-200' : 'text-slate-200'
                }`}
              >
                {humanWon ? '大获全胜！' : '惜败一局'}
              </h2>

              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                <RoleBadge role={humanRole} size="sm" />
                {settlement.isSpring && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 font-black text-emerald-950">
                    <Sparkles className="h-3 w-3" /> 春天 ×2
                  </span>
                )}
                {settlement.isAntiSpring && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 font-black text-white">
                    <Sparkles className="h-3 w-3" /> 反春 ×2
                  </span>
                )}
              </div>

              <div className="mt-2.5 w-full rounded-2xl border border-amber-400/25 bg-black/40 px-4 py-2.5 text-center">
                <div className="text-[11px] font-bold text-emerald-200/80">本局金币 / 欢乐豆结算</div>
                <div
                  className={`mt-0.5 font-mono text-2xl sm:text-3xl font-black ${
                    humanDelta >= 0 ? 'text-amber-300' : 'text-rose-400'
                  }`}
                >
                  {humanDelta >= 0 ? `+${humanDelta.toLocaleString()}` : humanDelta.toLocaleString()}
                </div>
                <div className="mt-0.5 text-xs text-emerald-200/80">
                  当前总金币：<span className="font-mono font-black text-amber-200">{chips.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Multiplier Breakdown + Rank + Action Buttons */}
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-emerald-100/90">
                <div className="flex justify-between">
                  <span>底分</span>
                  <span className="font-mono font-bold">{settlement.baseScore}</span>
                </div>
                <div className="flex justify-between">
                  <span>公共倍数</span>
                  <span className="font-mono font-black text-amber-300">
                    ×{settlement.publicMultiplier}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>抢地主</span>
                  <span className="font-mono">×{2 ** settlement.breakdown.grabCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>炸弹 / 王炸</span>
                  <span className="font-mono">
                    ×{2 ** (settlement.breakdown.bombCount + settlement.breakdown.rocketCount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>明牌</span>
                  <span className="font-mono">×{settlement.breakdown.mingpaiMultiplier}</span>
                </div>
                <div className="flex justify-between">
                  <span>个人加倍</span>
                  <span className="font-mono">×{gameState.doubleChoices[0] ?? 1}</span>
                </div>
              </div>

              <div className="rounded-xl bg-black/30 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black" style={{ color: tier.badgeColor }}>
                    {tier.name}段位 · {rankPoints} 分
                  </span>
                  <span className="text-[11px] text-emerald-200/75">
                    {tier.nextPoints
                      ? `差 ${tier.nextPoints - rankPoints} 分晋级`
                      : '已达最高段位'}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all"
                    style={{ width: `${tier.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="game-btn-gold flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" /> 再来一局
                </button>
                <button
                  type="button"
                  onClick={onReturnHub}
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-300/35 bg-white/10 px-3 py-2 text-sm font-bold text-amber-100 transition hover:bg-white/15 cursor-pointer"
                >
                  <LayoutGrid className="h-4 w-4" /> 玩法专区
                </button>
                {recentMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openReplayScreen(recentMatches[0])}
                    className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 cursor-pointer"
                  >
                    <History className="h-4 w-4" /> 上帝复盘
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExitToLobby}
                  className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-amber-100/90 transition hover:bg-white/10 cursor-pointer ${
                    recentMatches.length === 0 ? 'col-span-2' : ''
                  }`}
                >
                  <Home className="h-4 w-4" /> 返回大厅
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

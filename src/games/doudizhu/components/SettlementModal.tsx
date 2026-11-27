import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Home, Sparkles, History, ArrowRight, Puzzle } from 'lucide-react';
import { ENDGAME_PUZZLES, GameState } from '../engine';
import { getRankTier, usePlayerStore } from '../../../shared/store/playerStore';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';

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
  const humanWon =
    (humanIsLandlord && settlement.winnerRole === 'landlord') ||
    (!humanIsLandlord && settlement.winnerRole === 'farmer');

  const humanDelta = settlement.beanDeltas[0];

  const nextPuzzle =
    activePuzzle !== null
      ? ENDGAME_PUZZLES.find((p) => p.number === activePuzzle.number + 1) ?? null
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={`relative w-full max-w-md overflow-hidden rounded-3xl border p-6 shadow-2xl ${
          humanWon
            ? 'border-amber-300/70 bg-gradient-to-b from-[#133b2b] via-[#0c291d] to-[#071912]'
            : 'border-slate-500/40 bg-gradient-to-b from-slate-900 via-emerald-950 to-[#05140e]'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg ${
              humanWon
                ? 'border-amber-300/60 bg-amber-400/20 text-amber-300'
                : 'border-slate-500/40 bg-slate-800/70 text-slate-300'
            }`}
          >
            {matchMode === 'puzzle' ? (
              <Puzzle className="h-7 w-7" />
            ) : (
              <Trophy className="h-7 w-7" />
            )}
          </div>

          <h2
            className={`mt-3 text-2xl font-black tracking-wide ${
              humanWon ? 'text-amber-200' : 'text-slate-200'
            }`}
          >
            {matchMode === 'puzzle'
              ? humanWon
                ? '残局破解成功！'
                : '差之毫厘，再试一次'
              : humanWon
                ? '大获全胜！'
                : '惜败一局'}
          </h2>

          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-emerald-100">
              本局身份：{humanIsLandlord ? '地主' : '农民'}
            </span>
            {settlement.isSpring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 font-bold text-emerald-950">
                <Sparkles className="h-3 w-3" /> 春天 ×2
              </span>
            )}
            {settlement.isAntiSpring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 font-bold text-white">
                <Sparkles className="h-3 w-3" /> 反春 ×2
              </span>
            )}
          </div>
        </div>

        {matchMode === 'puzzle' && activePuzzle ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-amber-400/25 bg-black/35 p-4 text-xs">
              <div className="font-bold text-amber-200">
                残局 #{activePuzzle.number} · {activePuzzle.title}
              </div>
              <p className="mt-1.5 leading-relaxed text-emerald-100/85">
                {activePuzzle.solutionExplanation}
              </p>
              {puzzleRewardGranted && (
                <div className="mt-2 font-bold text-amber-300">
                  首次通关奖励：+{puzzleRewardGranted} 金币！
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" /> 重玩本关
              </button>
              {humanWon && nextPuzzle ? (
                <button
                  type="button"
                  onClick={() => startPuzzle(nextPuzzle)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-black text-emerald-950 shadow-lg hover:brightness-105 cursor-pointer"
                >
                  下一关 <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openPuzzlesScreen}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-black text-emerald-950 shadow-lg hover:brightness-105 cursor-pointer"
                >
                  返回残局列表
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-black/35 p-4 text-center">
              <div className="text-xs text-emerald-200/70">本局金币 / 欢乐豆结算</div>
              <div
                className={`mt-1 text-3xl font-black font-mono ${
                  humanDelta >= 0 ? 'text-amber-300' : 'text-rose-400'
                }`}
              >
                {humanDelta >= 0 ? `+${humanDelta.toLocaleString()}` : humanDelta.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-emerald-200/75">
                当前通用资产：<span className="font-bold text-amber-200">{chips.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-emerald-100/85">
              <div className="flex justify-between">
                <span>底分</span>
                <span className="font-mono font-bold">{settlement.baseScore}</span>
              </div>
              <div className="flex justify-between">
                <span>公共倍数</span>
                <span className="font-mono font-bold text-amber-300">
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

            <div className="mt-4 rounded-xl bg-black/25 px-3.5 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold" style={{ color: tier.badgeColor }}>
                  {tier.name}段位 · {rankPoints} 分
                </span>
                <span className="text-emerald-200/65">
                  {tier.nextPoints
                    ? `距下一段位还需 ${tier.nextPoints - rankPoints} 分`
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

            <div className="mt-5 flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-black text-emerald-950 shadow-lg transition hover:brightness-105 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" /> 再来一局
                </button>
                <button
                  type="button"
                  onClick={onReturnHub}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-amber-100 transition hover:bg-white/15 cursor-pointer"
                >
                  <Home className="h-4 w-4" /> 玩法专区
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {recentMatches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openReplayScreen(recentMatches[0])}
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/25 cursor-pointer"
                  >
                    <History className="h-4 w-4" /> 上帝视角复盘
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExitToLobby}
                  className={`flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100/85 transition hover:bg-white/10 cursor-pointer ${
                    recentMatches.length === 0 ? 'col-span-2' : ''
                  }`}
                >
                  返回棋牌大厅
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

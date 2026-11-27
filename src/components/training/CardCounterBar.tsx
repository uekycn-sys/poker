import React, { useMemo } from 'react';
import { Eye, EyeOff, HelpCircle, ShieldAlert } from 'lucide-react';
import { RANK_LABELS, Rank, computeExternalRemainingCounts } from '../../engine';
import { CardCounterMode, useProfileStore } from '../../store/profileStore';
import { useGameStore } from '../../store/gameStore';

const ALL_RANKS_DESC: Rank[] = [
  Rank.BIG_JOKER,
  Rank.SMALL_JOKER,
  Rank.TWO,
  Rank.ACE,
  Rank.KING,
  Rank.QUEEN,
  Rank.JACK,
  Rank.TEN,
  Rank.NINE,
  Rank.EIGHT,
  Rank.SEVEN,
  Rank.SIX,
  Rank.FIVE,
  Rank.FOUR,
  Rank.THREE,
];

const HIGH_RANKS_DESC: Rank[] = [
  Rank.BIG_JOKER,
  Rank.SMALL_JOKER,
  Rank.TWO,
  Rank.ACE,
  Rank.KING,
  Rank.QUEEN,
  Rank.JACK,
  Rank.TEN,
];

const MODES: Array<{ id: CardCounterMode; label: string }> = [
  { id: 'assist', label: '全记牌' },
  { id: 'advanced', label: '大牌模式' },
  { id: 'blind', label: '盲记抽测' },
  { id: 'off', label: '关闭' },
];

export const CardCounterBar: React.FC = () => {
  const hand = useGameStore((s) => s.gameState.hands[0]);
  const moveHistory = useGameStore((s) => s.gameState.moveHistory);
  const phase = useGameStore((s) => s.gameState.phase);
  const triggerManualBlindQuiz = useGameStore((s) => s.triggerManualBlindQuiz);

  const mode = useProfileStore((s) => s.cardCounterMode);
  const setMode = useProfileStore((s) => s.setCardCounterMode);

  const counts = useMemo(
    () => computeExternalRemainingCounts(hand, moveHistory),
    [hand, moveHistory],
  );

  const visibleRanks = mode === 'advanced' ? HIGH_RANKS_DESC : ALL_RANKS_DESC;

  return (
    <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/10 bg-black/25 px-3 py-1.5 backdrop-blur-sm md:px-5">
      {/* Mode Pills */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[11px] font-bold text-amber-200/80">记牌训练</span>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition cursor-pointer ${
              mode === m.id
                ? 'bg-amber-400 text-emerald-950 shadow'
                : 'bg-white/5 text-emerald-100/70 hover:bg-white/10'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Counts / Blind Mode Status */}
      {mode === 'off' ? (
        <div className="flex items-center gap-1 text-[11px] text-emerald-200/60">
          <EyeOff className="h-3.5 w-3.5" /> 记牌器已隐藏
        </div>
      ) : mode === 'blind' ? (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-amber-200">
            <Eye className="h-3.5 w-3.5 text-amber-300" />
            盲记训练中 · 关键回合随机抽测 (+500 豆)
          </span>
          {phase === 'PLAYING' && (
            <button
              type="button"
              onClick={triggerManualBlindQuiz}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
            >
              <HelpCircle className="h-3 w-3" /> 立即自测
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {visibleRanks.map((r) => {
            const count = counts[r];
            const isBombThreat = r <= Rank.TWO && count === 4;
            const shortLabel =
              r === Rank.BIG_JOKER ? '大' : r === Rank.SMALL_JOKER ? '小' : RANK_LABELS[r];
            return (
              <div
                key={r}
                className={`flex min-w-[26px] flex-col items-center rounded-md border px-1 py-0.5 leading-tight ${
                  count === 0
                    ? 'border-white/5 bg-white/5 opacity-30'
                    : isBombThreat
                      ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                      : 'border-amber-400/20 bg-emerald-950/70 text-amber-100'
                }`}
              >
                <span className="text-[10px] font-bold">{shortLabel}</span>
                <span className="font-mono text-[11px] font-black">{count}</span>
              </div>
            );
          })}
          {counts[Rank.BIG_JOKER] === 1 && counts[Rank.SMALL_JOKER] === 1 && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-rose-600/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
              <ShieldAlert className="h-3 w-3" /> 外有王炸
            </span>
          )}
        </div>
      )}
    </div>
  );
};

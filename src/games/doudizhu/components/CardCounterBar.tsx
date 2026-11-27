import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { RANK_LABELS, Rank, computeExternalRemainingCounts } from '../engine';
import { useStageViewport } from '../../../shared/hooks/useStageViewport';
import { CardCounterMode, useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';

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
  { id: 'advanced', label: '大牌' },
  { id: 'blind', label: '盲记' },
  { id: 'off', label: '关闭' },
];

export const CardCounterBar: React.FC = () => {
  const hand = useDoudizhuGameStore((s) => s.gameState.hands[0]);
  const moveHistory = useDoudizhuGameStore((s) => s.gameState.moveHistory);
  const phase = useDoudizhuGameStore((s) => s.gameState.phase);
  const triggerManualBlindQuiz = useDoudizhuGameStore((s) => s.triggerManualBlindQuiz);

  const mode = useDoudizhuProfileStore((s) => s.cardCounterMode);
  const setMode = useDoudizhuProfileStore((s) => s.setCardCounterMode);
  const { isShortLandscape } = useStageViewport();

  const [collapsed, setCollapsed] = useState(() => isShortLandscape);

  const counts = useMemo(
    () => computeExternalRemainingCounts(hand, moveHistory),
    [hand, moveHistory],
  );

  const visibleRanks = mode === 'advanced' ? HIGH_RANKS_DESC : ALL_RANKS_DESC;
  const jokerAlert = counts[Rank.BIG_JOKER] === 1 && counts[Rank.SMALL_JOKER] === 1;

  return (
    <div className="relative inline-flex flex-col items-center">
      <div className="hud-glass inline-flex max-w-full flex-col items-center gap-1 rounded-2xl px-2 py-1 sm:px-2.5 shadow-xl">
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-200/90 pr-0.5">
            <ClipboardList className="h-3.5 w-3.5 text-amber-300" />
            <span className="short-h-hide">记牌</span>
          </span>

          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setCollapsed(false);
              }}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-black transition cursor-pointer ${
                mode === m.id
                  ? 'bg-amber-400 text-emerald-950 shadow'
                  : 'bg-white/5 text-emerald-100/80 hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}

          {jokerAlert && collapsed && (
            <span className="inline-flex items-center gap-0.5 rounded bg-rose-600/50 px-1.5 py-0.5 text-[10px] font-black text-rose-100">
              <ShieldAlert className="h-3 w-3" /> 王炸
            </span>
          )}

          {mode !== 'off' && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="ml-0.5 inline-flex items-center gap-0.5 rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-white/20 cursor-pointer"
              title={collapsed ? '展开记牌器' : '收起记牌器'}
            >
              {collapsed ? (
                <>
                  <span>展开</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  <span className="short-h:inline hidden">收起</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Desktop inline rank bar */}
        {!collapsed && mode === 'off' && (
          <div className="short-h-hide flex items-center gap-1 text-[11px] text-emerald-200/65">
            <EyeOff className="h-3.5 w-3.5" /> 记牌器已关闭
          </div>
        )}

        {!collapsed && mode === 'blind' && (
          <div className="short-h-hide flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-amber-200">
              <Eye className="h-3.5 w-3.5 text-amber-300" />
              盲记抽测 (+500金币)
            </span>
            {phase === 'PLAYING' && (
              <button
                type="button"
                onClick={triggerManualBlindQuiz}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-500/20 px-2 py-0.5 font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" /> 自测
              </button>
            )}
          </div>
        )}

        {!collapsed && (mode === 'assist' || mode === 'advanced') && (
          <div className="short-h-hide flex items-center justify-center gap-1 whitespace-nowrap">
            {visibleRanks.map((r) => {
              const count = counts[r];
              const isBombThreat = r <= Rank.TWO && count === 4;
              const shortLabel =
                r === Rank.BIG_JOKER ? '大' : r === Rank.SMALL_JOKER ? '小' : RANK_LABELS[r];
              return (
                <div
                  key={r}
                  className={`flex min-w-[24px] flex-col items-center rounded border px-1 py-0.5 leading-tight ${
                    count === 0
                      ? 'border-white/5 bg-white/5 opacity-35'
                      : isBombThreat
                        ? 'border-rose-400/70 bg-rose-500/25 text-rose-100'
                        : 'border-amber-400/30 bg-emerald-950/85 text-amber-100'
                  }`}
                >
                  <span className="text-[10px] font-bold">{shortLabel}</span>
                  <span className="font-mono text-[11px] font-black">{count}</span>
                </div>
              );
            })}
            {jokerAlert && (
              <span className="ml-0.5 inline-flex items-center gap-0.5 rounded bg-rose-600/45 px-1.5 py-0.5 text-[10px] font-black text-rose-100">
                <ShieldAlert className="h-3 w-3" /> 王炸
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mobile / Forced Landscape Floating Popover */}
      {!collapsed && mode !== 'off' && (
        <div className="hidden short-h:flex hud-glass absolute top-full mt-1 z-30 items-center gap-1 rounded-xl px-2.5 py-1.5 shadow-2xl whitespace-nowrap">
          {mode === 'blind' ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-amber-200">盲记抽测中 (+500金币)</span>
              {phase === 'PLAYING' && (
                <button
                  type="button"
                  onClick={triggerManualBlindQuiz}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-0.5 font-black text-emerald-950 cursor-pointer"
                >
                  <HelpCircle className="h-3.5 w-3.5" /> 自测
                </button>
              )}
            </div>
          ) : (
            visibleRanks.map((r) => {
              const count = counts[r];
              const isBombThreat = r <= Rank.TWO && count === 4;
              const shortLabel =
                r === Rank.BIG_JOKER ? '大' : r === Rank.SMALL_JOKER ? '小' : RANK_LABELS[r];
              return (
                <div
                  key={r}
                  className={`flex min-w-[21px] flex-col items-center rounded border px-0.5 py-0.5 leading-tight ${
                    count === 0
                      ? 'border-white/5 bg-white/5 opacity-35'
                      : isBombThreat
                        ? 'border-rose-400/70 bg-rose-500/25 text-rose-100'
                        : 'border-amber-400/30 bg-emerald-950/85 text-amber-100'
                  }`}
                >
                  <span className="text-[9px] font-bold">{shortLabel}</span>
                  <span className="font-mono text-[10px] font-black">{count}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

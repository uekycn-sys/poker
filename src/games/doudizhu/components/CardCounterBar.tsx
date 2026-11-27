import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, HelpCircle, ShieldAlert } from 'lucide-react';
import { RANK_LABELS, Rank, computeExternalRemainingCounts } from '../engine';
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

  // On height-constrained mobile landscape, start collapsed as a single sleek pill and expand as an overlay
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight <= 540 : false,
  );

  const counts = useMemo(
    () => computeExternalRemainingCounts(hand, moveHistory),
    [hand, moveHistory],
  );

  const visibleRanks = mode === 'advanced' ? HIGH_RANKS_DESC : ALL_RANKS_DESC;
  const jokerAlert = counts[Rank.BIG_JOKER] === 1 && counts[Rank.SMALL_JOKER] === 1;

  return (
    <div className="relative inline-flex flex-col items-center">
      <div className="hud-glass inline-flex max-w-full flex-col items-center gap-1 rounded-2xl px-2 py-0.5 sm:px-2.5 sm:py-1 shadow-xl">
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setCollapsed(false);
              }}
              className={`rounded-lg px-1.5 sm:px-2 py-0.5 text-[10px] font-black transition cursor-pointer ${
                mode === m.id
                  ? 'bg-amber-400 text-emerald-950 shadow'
                  : 'bg-white/5 text-emerald-100/75 hover:bg-white/10'
              }`}
            >
              {m.label}
            </button>
          ))}

          {jokerAlert && collapsed && (
            <span className="inline-flex items-center gap-0.5 rounded bg-rose-600/45 px-1.5 py-0.5 text-[9px] font-black text-rose-200">
              <ShieldAlert className="h-2.5 w-2.5" /> 王炸
            </span>
          )}

          {mode !== 'off' && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="ml-0.5 inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-amber-200/90 hover:bg-white/15 cursor-pointer"
              title={collapsed ? '展开记牌器' : '收起记牌器'}
            >
              {collapsed ? (
                <>
                  <span className="text-[9px]">牌数</span>
                  <ChevronDown className="h-3 w-3" />
                </>
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {/* Desktop inline rank bar (hidden on short mobile landscape — rendered as floating overlay below instead) */}
        {!collapsed && mode === 'off' && (
          <div className="short-h-hide flex items-center gap-1 text-[10px] text-emerald-200/60">
            <EyeOff className="h-3 w-3" /> 记牌器已关闭
          </div>
        )}

        {!collapsed && mode === 'blind' && (
          <div className="short-h-hide flex items-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 text-amber-200">
              <Eye className="h-3 w-3 text-amber-300" />
              盲记抽测 (+500金币)
            </span>
            {phase === 'PLAYING' && (
              <button
                type="button"
                onClick={triggerManualBlindQuiz}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
              >
                <HelpCircle className="h-3 w-3" /> 自测
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
                  className={`flex min-w-[22px] flex-col items-center rounded border px-0.5 py-0.2 leading-tight ${
                    count === 0
                      ? 'border-white/5 bg-white/5 opacity-30'
                      : isBombThreat
                        ? 'border-rose-400/70 bg-rose-500/25 text-rose-200'
                        : 'border-amber-400/25 bg-emerald-950/80 text-amber-100'
                  }`}
                >
                  <span className="text-[9px] font-bold">{shortLabel}</span>
                  <span className="font-mono text-[10px] font-black">{count}</span>
                </div>
              );
            })}
            {jokerAlert && (
              <span className="ml-0.5 inline-flex items-center gap-0.5 rounded bg-rose-600/40 px-1.5 py-0.5 text-[9px] font-black text-rose-200">
                <ShieldAlert className="h-3 w-3" /> 王炸
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mobile Landscape Floating Popover (only when expanded at max-height: 540px so header never pushes hand offscreen) */}
      {!collapsed && mode !== 'off' && (
        <div className="hidden [@media(max-height:540px)]:flex hud-glass absolute top-full mt-1 z-30 items-center gap-1 rounded-xl px-2 py-1 shadow-2xl whitespace-nowrap">
          {mode === 'blind' ? (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-amber-200">盲记抽测中 (+500金币)</span>
              {phase === 'PLAYING' && (
                <button
                  type="button"
                  onClick={triggerManualBlindQuiz}
                  className="rounded-md bg-amber-400 px-2 py-0.5 font-black text-emerald-950 cursor-pointer"
                >
                  自测
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
                  className={`flex min-w-[19px] flex-col items-center rounded border px-0.5 leading-tight ${
                    count === 0
                      ? 'border-white/5 bg-white/5 opacity-30'
                      : isBombThreat
                        ? 'border-rose-400/70 bg-rose-500/25 text-rose-200'
                        : 'border-amber-400/25 bg-emerald-950/80 text-amber-100'
                  }`}
                >
                  <span className="text-[8px] font-bold">{shortLabel}</span>
                  <span className="font-mono text-[9px] font-black">{count}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

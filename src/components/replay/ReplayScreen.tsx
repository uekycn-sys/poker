import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  History,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  BlunderReport,
  Card,
  GameState,
  Seat,
  WinRateEvaluation,
  createInitialGameState,
  formatPatternLabel,
  requestBlunders,
  requestWinRate,
  sortCardsByRank,
} from '../../engine';
import { SavedMatchRecord, useProfileStore } from '../../store/profileStore';
import { useGameStore } from '../../store/gameStore';
import { PlayingCard } from '../cards/PlayingCard';

function reconstructStateAtStep(record: SavedMatchRecord, stepIndex: number): GameState {
  const base = createInitialGameState(record.baseScore);
  const moves = record.moveHistory;

  if (moves.length === 0) {
    return {
      ...base,
      phase: 'FINISHED',
      hands: record.initialHands,
      bottomCards: record.bottomCards,
      landlordSeat: record.landlordSeat,
      settlement: record.settlement,
    };
  }

  if (stepIndex < moves.length) {
    const move = moves[stepIndex];
    return {
      ...base,
      phase: 'PLAYING',
      hands: [
        sortCardsByRank(move.handsSnapshot[0]),
        sortCardsByRank(move.handsSnapshot[1]),
        sortCardsByRank(move.handsSnapshot[2]),
      ],
      bottomCards: record.bottomCards,
      landlordSeat: record.landlordSeat,
      currentTurn: move.seat,
      lastPlay: move.lastPlayBefore,
      moveHistory: moves.slice(0, stepIndex),
    };
  }

  const lastMove = moves[moves.length - 1];
  const playedIds = new Set(lastMove.cards.map((c) => c.id));
  const finalHands: [Card[], Card[], Card[]] = [
    lastMove.seat === 0
      ? lastMove.handsSnapshot[0].filter((c) => !playedIds.has(c.id))
      : lastMove.handsSnapshot[0],
    lastMove.seat === 1
      ? lastMove.handsSnapshot[1].filter((c) => !playedIds.has(c.id))
      : lastMove.handsSnapshot[1],
    lastMove.seat === 2
      ? lastMove.handsSnapshot[2].filter((c) => !playedIds.has(c.id))
      : lastMove.handsSnapshot[2],
  ];

  return {
    ...base,
    phase: 'FINISHED',
    hands: [
      sortCardsByRank(finalHands[0]),
      sortCardsByRank(finalHands[1]),
      sortCardsByRank(finalHands[2]),
    ],
    bottomCards: record.bottomCards,
    landlordSeat: record.landlordSeat,
    currentTurn: lastMove.seat,
    lastPlay: lastMove.isPass
      ? lastMove.lastPlayBefore
      : lastMove.pattern
        ? { seat: lastMove.seat, pattern: lastMove.pattern }
        : null,
    moveHistory: moves,
    settlement: record.settlement,
  };
}

const SEAT_LABELS: Record<Seat, string> = {
  0: '你 (本家)',
  1: '下家 AI',
  2: '上家 AI',
};

export const ReplayScreen: React.FC = () => {
  const recentMatches = useProfileStore((s) => s.recentMatches);
  const initialReplayMatch = useGameStore((s) => s.replayMatch);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const resumeFromReplaySnapshot = useGameStore((s) => s.resumeFromReplaySnapshot);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    initialReplayMatch?.id ?? recentMatches[0]?.id ?? '',
  );
  const activeRecord = useMemo(
    () => recentMatches.find((m) => m.id === selectedMatchId) ?? recentMatches[0] ?? null,
    [recentMatches, selectedMatchId],
  );

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [autoPlaying, setAutoPlaying] = useState<boolean>(false);
  const [blunders, setBlunders] = useState<BlunderReport[]>([]);
  const [blundersLoading, setBlundersLoading] = useState<boolean>(false);
  const [stepWinRate, setStepWinRate] = useState<WinRateEvaluation>({
    landlordWinRate: 50,
    farmerWinRate: 50,
    perspectiveWinRate: 50,
    advantage: 0,
  });

  useEffect(() => {
    setStepIndex(0);
    setAutoPlaying(false);
    if (!activeRecord) {
      setBlunders([]);
      return;
    }

    const fullState = reconstructStateAtStep(activeRecord, activeRecord.moveHistory.length);
    setBlundersLoading(true);
    void requestBlunders(fullState, 0, 3).then((reports) => {
      setBlunders(reports);
      setBlundersLoading(false);
    });
  }, [activeRecord]);

  const stepState = useMemo(
    () => (activeRecord ? reconstructStateAtStep(activeRecord, stepIndex) : null),
    [activeRecord, stepIndex],
  );

  useEffect(() => {
    if (!stepState) return;
    void requestWinRate(stepState, 0).then(setStepWinRate);
  }, [stepState]);

  useEffect(() => {
    if (!autoPlaying || !activeRecord) return;
    if (stepIndex >= activeRecord.moveHistory.length) {
      setAutoPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStepIndex((s) => Math.min(activeRecord.moveHistory.length, s + 1));
    }, 1050);
    return () => clearTimeout(timer);
  }, [autoPlaying, stepIndex, activeRecord]);

  const blunderIndexSet = useMemo(() => new Set(blunders.map((b) => b.moveIndex)), [blunders]);

  if (!activeRecord || !stepState) {
    return (
      <div className="felt-table flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <History className="h-12 w-12 text-amber-300/70" />
        <h2 className="mt-3 text-xl font-black text-amber-100">暂无保存的对局牌谱</h2>
        <p className="mt-1 text-xs text-emerald-200/75">
          完成一局实战对战后，系统将自动保存最近 10 局牌谱供上帝视角复盘。
        </p>
        <button
          type="button"
          onClick={returnToLobby}
          className="mt-5 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-emerald-950 cursor-pointer"
        >
          返回大厅开始对局
        </button>
      </div>
    );
  }

  const totalSteps = activeRecord.moveHistory.length;
  const activeMove = stepIndex < totalSteps ? activeRecord.moveHistory[stepIndex] : null;
  const resumeIndex = Math.min(stepIndex, Math.max(0, totalSteps - 1));

  return (
    <div className="felt-table min-h-screen w-full px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-black/35 px-5 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={returnToLobby}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> 大厅
            </button>
            <h1 className="flex items-center gap-2 text-lg font-black text-amber-50">
              <History className="h-5 w-5 text-amber-300" /> 上帝视角牌谱复盘
            </h1>
          </div>

          {/* Match Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeRecord.id}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="rounded-xl border border-amber-400/30 bg-emerald-950 px-3 py-1.5 text-xs font-bold text-amber-100"
            >
              {recentMatches.map((m, i) => {
                const delta = m.settlement.beanDeltas[0];
                return (
                  <option key={m.id} value={m.id}>
                    第 {i + 1} 近局 · {delta >= 0 ? `胜 +${delta}` : `负 ${delta}`} (底分 {m.baseScore})
                  </option>
                );
              })}
            </select>

            {totalSteps > 0 && (
              <button
                type="button"
                onClick={() => resumeFromReplaySnapshot(activeRecord, resumeIndex)}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5 text-xs font-black text-emerald-950 shadow hover:brightness-105 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> 从此处重新开打
              </button>
            )}
          </div>
        </header>

        {/* Main Split Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left 2 cols: God-View Table + Timeline */}
          <div className="space-y-4 lg:col-span-2">
            {/* Win Rate Strip */}
            <div className="rounded-2xl border border-amber-400/20 bg-black/35 px-4 py-2.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-amber-300">地主胜率 {Math.round(stepWinRate.landlordWinRate)}%</span>
                <span className="text-emerald-200/80">
                  第 {stepIndex} / {totalSteps} 手
                  {activeMove ? ` · 即将由 ${SEAT_LABELS[activeMove.seat]} 决策` : ' · 对局结束'}
                </span>
                <span className="text-emerald-300">农民胜率 {Math.round(stepWinRate.farmerWinRate)}%</span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-emerald-900">
                <div
                  className="bg-amber-400 transition-all duration-300"
                  style={{ width: `${stepWinRate.landlordWinRate}%` }}
                />
              </div>
            </div>

            {/* All 3 Open Hands */}
            <div className="grid gap-3 md:grid-cols-2">
              {([2, 1] as Seat[]).map((seat) => {
                const isLandlord = activeRecord.landlordSeat === seat;
                const isTurn = stepState.currentTurn === seat && stepState.phase !== 'FINISHED';
                return (
                  <div
                    key={seat}
                    className={`rounded-2xl border p-3.5 ${
                      isTurn
                        ? 'border-amber-300 bg-emerald-900/75'
                        : 'border-white/10 bg-emerald-950/75'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-100">{SEAT_LABELS[seat]}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isLandlord ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {isLandlord ? '地主' : '农民'} · {stepState.hands[seat].length} 张
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {stepState.hands[seat].map((c) => (
                        <PlayingCard key={c.id} card={c} size="xs" />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Table Play + Bottom Human Hand */}
            <div className="rounded-2xl border border-amber-400/25 bg-black/30 p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-200">桌面当前牌权</span>
                <span className="text-emerald-200/80">
                  {stepState.lastPlay
                    ? `${SEAT_LABELS[stepState.lastPlay.seat]} 打出 ${formatPatternLabel(stepState.lastPlay.pattern)}`
                    : '自由先手（无压制牌）'}
                </span>
              </div>
              {stepState.lastPlay ? (
                <div className="flex flex-wrap gap-1">
                  {stepState.lastPlay.pattern.cards.map((c) => (
                    <PlayingCard key={c.id} card={c} size="sm" />
                  ))}
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-emerald-200/50">新一轮先手出牌</div>
              )}

              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-100">
                    {SEAT_LABELS[0]} ({activeRecord.landlordSeat === 0 ? '地主' : '农民'}) ·{' '}
                    {stepState.hands[0].length} 张
                  </span>
                  {activeMove && activeMove.seat === 0 && (
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-200">
                      本手实际：{activeMove.isPass ? '不要' : formatPatternLabel(activeMove.pattern)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {stepState.hands[0].map((c) => (
                    <PlayingCard key={c.id} card={c} size="sm" />
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline Controls */}
            <div className="rounded-2xl border border-white/10 bg-black/35 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={stepIndex <= 0}
                    onClick={() => {
                      setAutoPlaying(false);
                      setStepIndex((s) => Math.max(0, s - 1));
                    }}
                    className="rounded-xl border border-white/15 bg-white/5 p-2 text-amber-100 disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPlaying((p) => !p)}
                    className="flex items-center gap-1 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-emerald-950 cursor-pointer"
                  >
                    {autoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {autoPlaying ? '暂停' : '自动回放'}
                  </button>
                  <button
                    type="button"
                    disabled={stepIndex >= totalSteps}
                    onClick={() => {
                      setAutoPlaying(false);
                      setStepIndex((s) => Math.min(totalSteps, s + 1));
                    }}
                    className="rounded-xl border border-white/15 bg-white/5 p-2 text-amber-100 disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-[11px] text-rose-300">红点标记为 AI 检测到的关键失误</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {activeRecord.moveHistory.map((m, idx) => {
                  const isBlunder = blunderIndexSet.has(m.index);
                  const active = stepIndex === idx;
                  return (
                    <button
                      key={m.index}
                      type="button"
                      onClick={() => {
                        setAutoPlaying(false);
                        setStepIndex(idx);
                      }}
                      className={`relative rounded-lg border px-2 py-1 text-[11px] font-mono font-bold transition cursor-pointer ${
                        active
                          ? 'border-amber-300 bg-amber-400 text-emerald-950'
                          : isBlunder
                            ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                            : 'border-white/10 bg-white/5 text-emerald-100/75 hover:bg-white/10'
                      }`}
                    >
                      {idx + 1}
                      {isBlunder && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setAutoPlaying(false);
                    setStepIndex(totalSteps);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                    stepIndex === totalSteps
                      ? 'border-amber-300 bg-amber-400 text-emerald-950'
                      : 'border-white/10 bg-white/5 text-emerald-100/75'
                  }`}
                >
                  终局
                </button>
              </div>
            </div>
          </div>

          {/* Right Col: Blunder Diagnosis */}
          <aside className="rounded-2xl border border-amber-400/25 bg-emerald-950/80 p-4 space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-black text-amber-200">
              <AlertTriangle className="h-4 w-4 text-rose-400" /> 关键失误复盘 (Blunders)
            </h2>

            {blundersLoading ? (
              <div className="text-xs text-emerald-200/75 animate-pulse">
                正在调用大师 AI 回溯对比每一手胜率变化…
              </div>
            ) : blunders.length === 0 ? (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                本局发挥非常稳健！未检测到胜率大幅下滑的关键失误。
              </div>
            ) : (
              <div className="space-y-3">
                {blunders.map((b) => (
                  <div
                    key={b.moveIndex}
                    className="rounded-2xl border border-rose-400/35 bg-black/35 p-3.5 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-amber-200">第 {b.moveIndex + 1} 手失误</span>
                      <span className="rounded-full bg-rose-500/25 px-2 py-0.5 font-mono font-bold text-rose-300">
                        胜率 -{b.winRateDrop}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-2">
                      <div>
                        <div className="text-[10px] text-rose-300">你的出牌</div>
                        <div className="font-bold text-rose-100">
                          {b.actualIsPass ? '不要' : formatPatternLabel(b.actualPattern)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-300">大师推荐</div>
                        <div className="font-bold text-emerald-100">
                          {b.bestIsPass ? '不要' : formatPatternLabel(b.bestPattern)}
                        </div>
                      </div>
                    </div>

                    <p className="leading-relaxed text-emerald-100/85">{b.reason}</p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAutoPlaying(false);
                          setStepIndex(b.moveIndex);
                        }}
                        className="flex-1 rounded-lg border border-white/15 bg-white/10 py-1.5 font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
                      >
                        定位到此手
                      </button>
                      <button
                        type="button"
                        onClick={() => resumeFromReplaySnapshot(activeRecord, b.moveIndex)}
                        className="flex-1 rounded-lg bg-amber-400 py-1.5 font-black text-emerald-950 hover:brightness-105 cursor-pointer"
                      >
                        从此处重打
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

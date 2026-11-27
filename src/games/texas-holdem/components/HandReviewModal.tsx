import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
  X,
} from 'lucide-react';
import { HandReviewReport } from '../ai/coach';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { BettingStreet, HandState, StreetSnapshot } from '../engine/types';
import { SavedHoldemHand } from '../store/holdemProfileStore';

interface HandReviewContentProps {
  review: HandReviewReport;
  handState: HandState;
  streetSnapshots: Partial<Record<BettingStreet, StreetSnapshot>>;
  sourceHand?: SavedHoldemHand;
  onBranchFromStreet: (
    snapshots: Partial<Record<BettingStreet, StreetSnapshot>>,
    street: BettingStreet,
    sourceHand?: SavedHoldemHand,
  ) => void;
  onClose?: () => void;
}

const GRADE_STYLE: Record<HandReviewReport['grade'], string> = {
  S: 'border-amber-300 bg-amber-400/25 text-amber-200',
  A: 'border-emerald-300 bg-emerald-500/25 text-emerald-200',
  B: 'border-sky-300 bg-sky-500/25 text-sky-200',
  C: 'border-orange-300 bg-orange-500/25 text-orange-200',
  D: 'border-rose-400 bg-rose-500/25 text-rose-200',
};

export const HandReviewContent: React.FC<HandReviewContentProps> = ({
  review,
  handState,
  streetSnapshots,
  sourceHand,
  onBranchFromStreet,
  onClose,
}) => {
  const hero = handState.players.find((p) => p.seat === 0);
  const points = review.streetCurve;
  const maxPot = Math.max(100, ...points.map((p) => p.pot));

  // SVG dual-curve dimensions
  const svgW = 520;
  const svgH = 170;
  const padX = 52;
  const padY = 26;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padY * 2;

  const getX = (idx: number) =>
    points.length <= 1
      ? padX + plotW / 2
      : padX + (idx / (points.length - 1)) * plotW;

  const eqLinePoints = points
    .map((p, idx) => {
      const x = getX(idx);
      const y = padY + plotH - (p.heroEquityPct / 100) * plotH;
      return `${x},${y}`;
    })
    .join(' ');

  const potLinePoints = points
    .map((p, idx) => {
      const x = getX(idx);
      const y = padY + plotH - (p.pot / maxPot) * plotH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-4">
      {/* Top Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border font-mono text-2xl font-black ${GRADE_STYLE[review.grade]}`}
          >
            {review.grade}
          </div>
          <div>
            <h3 className="text-base font-black text-amber-100">
              第 #{review.handId} 手牌 · 局后 EV 复盘与重打
            </h3>
            <p className="mt-0.5 text-xs text-emerald-200/80">{review.summaryZh}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`rounded-xl border px-3 py-1.5 font-mono text-sm font-black ${
              review.heroNetChips >= 0
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                : 'border-rose-400/40 bg-rose-500/15 text-rose-300'
            }`}
          >
            {review.heroNetChips >= 0
              ? `+${review.heroNetChips.toLocaleString()}`
              : review.heroNetChips.toLocaleString()}{' '}
            筹码
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/5 p-2 text-slate-300 hover:bg-white/15 cursor-pointer"
              aria-label="关闭复盘"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Hole Cards & Final Community Board */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 p-3.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-200/80">你的底牌</span>
          <div className="flex gap-1.5">
            {(hero?.holeCards ?? []).map((c) => (
              <PlayingCard key={c.id} card={c} size="xs" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-emerald-200/80">公共牌</span>
          <div className="flex gap-1.5">
            {handState.communityCards.length > 0 ? (
              handState.communityCards.map((c) => (
                <PlayingCard key={c.id} card={c} size="xs" />
              ))
            ) : (
              <span className="text-xs text-slate-400">翻前结束，未翻公共牌</span>
            )}
          </div>
        </div>
      </div>

      {/* 4-Street Pot & Equity Curve + Branch Replay Buttons */}
      <div className="rounded-2xl border border-amber-400/25 bg-black/45 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-200">
            <TrendingUp className="h-4 w-4 text-emerald-300" /> 四条街底池规模 & 胜率曲线
          </span>
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <span className="h-2 w-4 rounded-full bg-emerald-400" /> 胜率 Equity (%)
            </span>
            <span className="inline-flex items-center gap-1 text-amber-300">
              <span className="h-2 w-4 rounded-full bg-amber-400" /> 底池 Pot
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full overflow-visible">
          {/* Grid lines */}
          {[0, 50, 100].map((pct) => {
            const y = padY + plotH - (pct / 100) * plotH;
            return (
              <g key={pct}>
                <line
                  x1={padX}
                  y1={y}
                  x2={svgW - padX}
                  y2={y}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padX - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(167,243,208,0.65)"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <>
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                points={potLinePoints}
              />
              <polyline
                fill="none"
                stroke="#34d399"
                strokeWidth="3"
                points={eqLinePoints}
              />
            </>
          )}

          {points.map((pt, idx) => {
            const x = getX(idx);
            const eqY = padY + plotH - (pt.heroEquityPct / 100) * plotH;
            const potY = padY + plotH - (pt.pot / maxPot) * plotH;
            return (
              <g key={pt.street}>
                <circle cx={x} cy={potY} r="4.5" fill="#fbbf24" />
                <text
                  x={x}
                  y={potY - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#fde68a"
                >
                  池 {pt.pot}
                </text>

                <circle
                  cx={x}
                  cy={eqY}
                  r="5.5"
                  fill="#34d399"
                  stroke="#042f2e"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={eqY + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="800"
                  fill="#6ee7b7"
                >
                  {pt.heroEquityPct}%
                </text>

                <text
                  x={x}
                  y={svgH - 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  fill="#fef3c7"
                >
                  {pt.labelZh}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Branch & Replay From Any Played Street */}
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-2 text-[11px] font-bold text-emerald-200/75">
            点击任意已进行的街道，保留发牌牌序并从该节点重新推演打法：
          </div>
          <div className="flex flex-wrap gap-2">
            {(['preflop', 'flop', 'turn', 'river'] as BettingStreet[]).map((st) => {
              const snap = streetSnapshots[st];
              const label =
                st === 'preflop'
                  ? '翻前'
                  : st === 'flop'
                    ? '翻牌'
                    : st === 'turn'
                      ? '转牌'
                      : '河牌';
              if (!snap) return null;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => onBranchFromStreet(streetSnapshots, st, sourceHand)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/45 bg-amber-400/15 px-3.5 py-2 text-xs font-black text-amber-200 transition hover:bg-amber-400/25 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> 从【{label}】重新开打
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Decision Audit & -EV Blunders */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-black text-amber-200">
          <span>关键决策 EV 诊断 ({review.decisions.length} 步)</span>
          <span
            className={
              review.blunderCount > 0 ? 'text-rose-300' : 'text-emerald-300'
            }
          >
            {review.blunderCount > 0
              ? `发现 ${review.blunderCount} 处 -EV 失误`
              : '零 -EV 失误'}
          </span>
        </div>

        {review.decisions.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/35 p-3 text-xs text-slate-300">
            本手牌未产生需诊断的决策步骤。
          </div>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {review.decisions.map((item) => {
              const streetLabel =
                item.street === 'preflop'
                  ? '翻前'
                  : item.street === 'flop'
                    ? '翻牌'
                    : item.street === 'turn'
                      ? '转牌'
                      : '河牌';
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-3 text-xs ${
                    item.isBlunder
                      ? 'border-rose-400/50 bg-rose-950/35'
                      : 'border-white/10 bg-black/35'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.isBlunder ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                          <AlertTriangle className="h-3 w-3" /> -EV 失误
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> 合理决策
                        </span>
                      )}
                      <span className="font-bold text-amber-200">
                        {streetLabel} · 你的动作: {item.heroActionLabel}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-200/80">
                      胜率 {item.heroEquityPct}% vs 赔率 {item.potOddsPct}%
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-100/85">
                    {item.critiqueZh}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface HandReviewModalProps {
  review: HandReviewReport;
  handState: HandState;
  onBranchFromStreet: (
    snapshots: Partial<Record<BettingStreet, StreetSnapshot>>,
    street: BettingStreet,
  ) => void;
  onClose: () => void;
}

export const HandReviewModal: React.FC<HandReviewModalProps> = ({
  review,
  handState,
  onBranchFromStreet,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="gold-card-border max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border bg-[#051811] p-5 shadow-2xl">
        <HandReviewContent
          review={review}
          handState={handState}
          streetSnapshots={handState.streetSnapshots}
          onBranchFromStreet={(snaps, st) => onBranchFromStreet(snaps, st)}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

interface HoldemReplayScreenProps {
  hands: SavedHoldemHand[];
  selectedHandId: string | null;
  onSelectHand: (id: string) => void;
  onBranchFromStreet: (
    snapshots: Partial<Record<BettingStreet, StreetSnapshot>>,
    street: BettingStreet,
    sourceHand?: SavedHoldemHand,
  ) => void;
  onBack: () => void;
}

export const HoldemReplayScreen: React.FC<HoldemReplayScreenProps> = ({
  hands,
  selectedHandId,
  onSelectHand,
  onBranchFromStreet,
  onBack,
}) => {
  const activeHand =
    hands.find((h) => h.id === selectedHandId) ?? hands[0] ?? null;

  return (
    <div className="club-bg min-h-screen w-full px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="gold-card-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-black/45 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> 返回训练营
            </button>
            <div>
              <h1 className="text-lg font-black text-amber-100">
                德州扑克 · EV 牌局复盘中心
              </h1>
              <p className="text-[11px] text-emerald-200/70">
                回溯四条街底池与胜率曲线，修复 -EV 失误并从任意街道重新开打
              </p>
            </div>
          </div>
        </header>

        {hands.length === 0 || !activeHand ? (
          <div className="gold-card-border rounded-3xl border bg-black/40 p-10 text-center">
            <p className="text-sm font-bold text-amber-200">
              暂无已保存的德州扑克牌局记录
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">
              前往 6 人桌完成至少 1 手牌后，系统将自动生成四条街 EV 复盘报告。
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <aside className="gold-card-border space-y-2 rounded-3xl border bg-black/45 p-3.5">
              <div className="px-1 text-xs font-black text-amber-200">
                近期牌谱 ({hands.length}/12)
              </div>
              {hands.map((h) => {
                const selected = h.id === activeHand.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onSelectHand(h.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition cursor-pointer ${
                      selected
                        ? 'border-amber-300 bg-amber-400/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-amber-100">
                        #{h.review.handId} · {h.smallBlind}/{h.bigBlind}
                      </span>
                      <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] font-black text-amber-300">
                        评级 {h.review.grade}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span
                        className={
                          h.heroNetChips >= 0
                            ? 'font-bold text-emerald-300'
                            : 'font-bold text-rose-300'
                        }
                      >
                        {h.heroNetChips >= 0
                          ? `+${h.heroNetChips}`
                          : h.heroNetChips}
                      </span>
                      <span className="text-emerald-200/70">
                        {h.review.blunderCount} 失误
                      </span>
                    </div>
                  </button>
                );
              })}
            </aside>

            <div className="gold-card-border rounded-3xl border bg-black/45 p-5">
              <HandReviewContent
                review={activeHand.review}
                handState={activeHand.finalState}
                streetSnapshots={activeHand.streetSnapshots}
                sourceHand={activeHand}
                onBranchFromStreet={onBranchFromStreet}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

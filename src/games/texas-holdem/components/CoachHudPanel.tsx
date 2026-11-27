import React from 'react';
import {
  BrainCircuit,
  Calculator,
  EyeOff,
  Grid3X3,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { CoachAnalysis } from '../ai/coach';
import { HoldemCard, PositionName } from '../engine/types';

interface CoachHudPanelProps {
  hudEnabled: boolean;
  outsQuizLocked: boolean;
  loading: boolean;
  analysis: CoachAnalysis | null;
  heroCards: readonly HoldemCard[];
  heroPosition: PositionName;
  isPreflop: boolean;
  onOpenMatrix: () => void;
  onClose?: () => void;
}

export const CoachHudPanel: React.FC<CoachHudPanelProps> = ({
  hudEnabled,
  outsQuizLocked,
  loading,
  analysis,
  isPreflop,
  onOpenMatrix,
  onClose,
}) => {
  if (!hudEnabled) return null;

  return (
    <aside className="hud-glass flex max-h-full w-full flex-col gap-2.5 overflow-y-auto rounded-2xl p-3.5 shadow-2xl xl:w-[320px]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-300/50 bg-amber-400/15">
            <BrainCircuit className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black text-amber-100">职业 GTO 教练 HUD</h2>
            <p className="text-[10px] text-emerald-200/70">
              {analysis
                ? `蒙特卡洛计算 ${analysis.computeMs.toFixed(0)}ms`
                : '实时胜率 · 底池赔率 · 剥削建议'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenMatrix}
            className="inline-flex items-center gap-1 rounded-xl border border-amber-300/40 bg-amber-400/15 px-2.5 py-1.5 text-[11px] font-black text-amber-200 transition hover:bg-amber-400/25 cursor-pointer"
          >
            <Grid3X3 className="h-3.5 w-3.5" /> 范围图
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="收起教练面板"
              className="rounded-xl border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/15 cursor-pointer xl:hidden"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {outsQuizLocked ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 text-center">
          <EyeOff className="h-8 w-8 text-amber-300" />
          <div className="mt-2 text-sm font-black text-amber-200">
            Outs 盲测训练进行中
          </div>
          <p className="mt-1 text-xs text-emerald-100/80">
            为防止作弊，实时数学面板与补牌数已临时锁定隐藏，请先完成 8 秒盲测作答！
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/35 py-8 text-xs text-emerald-200/75">
          <Calculator className="h-6 w-6 animate-pulse text-amber-300" />
          <span>正在后台 Worker 执行 ≥1,200 次蒙特卡洛胜率推演...</span>
        </div>
      ) : !analysis ? (
        <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-xs leading-relaxed text-emerald-200/75">
          轮到你行动时，教练将自动计算：
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px]">
            <li>当前手牌真实胜率（Equity）与底池赔率对比</li>
            <li>翻牌/转牌听牌精准 Outs 与 2-4 法则成牌率</li>
            <li>SPR 控池深度、隐含赔率及对手风格剥削策略</li>
          </ul>
          {isPreflop && (
            <button
              type="button"
              onClick={onOpenMatrix}
              className="mt-3 w-full rounded-xl border border-amber-300/35 bg-amber-400/10 py-2 text-xs font-black text-amber-200 hover:bg-amber-400/20 cursor-pointer"
            >
              立即查看 13×13 GTO 翻前矩阵
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Equity vs Pot Odds Comparison */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-200">当前胜率 (Equity)</span>
              <span className="font-mono text-base font-black text-emerald-300">
                {analysis.heroEquityPct}%
              </span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-300"
                style={{ width: `${Math.min(100, analysis.heroEquityPct)}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-200/90">
                跟注门槛 (Pot Odds)
              </span>
              <span className="font-mono text-sm font-black text-amber-300">
                {analysis.toCall > 0 ? `${analysis.potOddsPct}% (需补 ${analysis.toCall})` : '0% (免费看牌)'}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-400 transition-all duration-300"
                style={{ width: `${Math.min(100, analysis.potOddsPct)}%` }}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-emerald-200/75">
              <span>底池: {analysis.potSize.toLocaleString()}</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono font-bold text-sky-200">
                SPR {analysis.spr}
              </span>
            </div>
          </div>

          {/* Outs Breakdown */}
          {analysis.outs.totalOuts > 0 && (
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-black text-sky-200">
                  <Sparkles className="h-3.5 w-3.5" /> 听牌补牌 (Outs)
                </span>
                <span className="font-mono text-sm font-black text-sky-300">
                  {analysis.outs.totalOuts} 张 ({analysis.outs.ruleOf2And4Pct}%)
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-sky-100/85">
                {analysis.outs.summaryZh}
              </p>
            </div>
          )}

          {/* Recommended Action + Chinese Explanation */}
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-emerald-950/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-300">
                <Target className="h-3.5 w-3.5" /> GTO 推荐动作
              </span>
              <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-xs font-black text-emerald-950">
                {analysis.recommendedLabelZh}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-amber-50/95">
              {analysis.explanationZh}
            </p>
          </div>

          {/* Implied Odds & Exploitative Note */}
          <div className="space-y-2 text-[11px]">
            <div className="rounded-xl border border-white/10 bg-black/35 p-2.5 text-emerald-100/80">
              <div className="mb-0.5 flex items-center gap-1 font-bold text-emerald-300">
                <Lightbulb className="h-3.5 w-3.5" /> 隐含赔率与控池提示
              </div>
              {analysis.impliedOddsZh}
            </div>
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-2.5 text-rose-100/90">
              <div className="mb-0.5 flex items-center gap-1 font-bold text-rose-300">
                <ShieldAlert className="h-3.5 w-3.5" /> 针对当前对手风格剥削
              </div>
              {analysis.exploitativeTipZh}
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

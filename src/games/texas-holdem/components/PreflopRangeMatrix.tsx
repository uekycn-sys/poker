import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getHandKey, getPreflopRangeMatrix, GtoMatrixCell } from '../ai/gtoRanges';
import { HoldemCard, PositionName } from '../engine/types';

interface PreflopRangeMatrixProps {
  heroCards?: readonly HoldemCard[];
  initialPosition?: PositionName;
  initialFacingRaise?: boolean;
  onClose?: () => void;
  compact?: boolean;
}

const POSITIONS: PositionName[] = ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export const PreflopRangeMatrix: React.FC<PreflopRangeMatrixProps> = ({
  heroCards = [],
  initialPosition = 'BTN',
  initialFacingRaise = false,
  onClose,
  compact = false,
}) => {
  const [position, setPosition] = useState<PositionName>(initialPosition);
  const [facingRaise, setFacingRaise] = useState<boolean>(initialFacingRaise);
  const [hoveredCell, setHoveredCell] = useState<GtoMatrixCell | null>(null);

  const heroKey = useMemo(() => getHandKey(heroCards), [heroCards]);
  const matrix = useMemo(
    () => getPreflopRangeMatrix(position, facingRaise),
    [position, facingRaise],
  );

  const activeCell = useMemo(() => {
    if (hoveredCell) return hoveredCell;
    if (heroKey) {
      for (const row of matrix) {
        for (const cell of row) {
          if (cell.handKey === heroKey) return cell;
        }
      }
    }
    return matrix[0][0];
  }, [hoveredCell, heroKey, matrix]);

  const stats = useMemo(() => {
    const all = matrix.flat();
    const raise = all.filter((c) => c.action === 'raise').length;
    const call = all.filter((c) => c.action === 'call').length;
    return {
      raisePct: Math.round((raise / 169) * 100),
      callPct: Math.round((call / 169) * 100),
    };
  }, [matrix]);

  return (
    <div className="rounded-2xl border border-amber-400/35 bg-[#061812]/95 p-3.5 shadow-2xl backdrop-blur-md">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-amber-200">
              GTO 翻前范围矩阵 (13×13)
            </h3>
            {heroKey && (
              <span className="rounded-full border border-amber-300/60 bg-amber-400/20 px-2 py-0.5 font-mono text-[11px] font-black text-amber-200">
                你的手牌: {heroKey}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-emerald-200/70">
            加注 {stats.raisePct}% · 跟注 {stats.callPct}% · 右上同花(s) / 左下非同花(o)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setFacingRaise(false)}
              className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                !facingRaise
                  ? 'bg-amber-400 text-emerald-950'
                  : 'text-emerald-200/75 hover:text-white'
              }`}
            >
              率先开池
            </button>
            <button
              type="button"
              onClick={() => setFacingRaise(true)}
              className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                facingRaise
                  ? 'bg-rose-500 text-white'
                  : 'text-emerald-200/75 hover:text-white'
              }`}
            >
              面对加注
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/15 cursor-pointer"
              aria-label="关闭矩阵"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Position Tabs */}
      <div className="mt-2.5 grid grid-cols-6 gap-1">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPosition(pos)}
            className={`rounded-lg border py-1 text-[11px] font-black transition cursor-pointer ${
              position === pos
                ? 'border-amber-300 bg-amber-400/25 text-amber-200 shadow'
                : 'border-white/10 bg-black/35 text-emerald-200/70 hover:bg-white/10'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold">
        <span className="inline-flex items-center gap-1 text-rose-300">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> 加注 (Raise / 3-Bet)
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-300">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> 跟注 (Call / Defend)
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-700" /> 弃牌 (Fold)
        </span>
      </div>

      {/* 13x13 Heatmap Grid */}
      <div
        className={`mt-2 grid grid-cols-13 gap-[2px] rounded-xl border border-white/10 bg-black/50 p-1.5 ${
          compact ? 'text-[8px]' : 'text-[9px] md:text-[10px]'
        }`}
        style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        {matrix.flat().map((cell) => {
          const isHero = heroKey === cell.handKey;
          const colorCls =
            cell.action === 'raise'
              ? 'bg-rose-500/80 text-white hover:bg-rose-400'
              : cell.action === 'call'
                ? 'bg-emerald-500/80 text-emerald-950 font-black hover:bg-emerald-400'
                : 'bg-slate-800/85 text-slate-400 hover:bg-slate-700';

          return (
            <button
              key={cell.handKey}
              type="button"
              onMouseEnter={() => setHoveredCell(cell)}
              onClick={() => setHoveredCell(cell)}
              className={`relative flex aspect-square items-center justify-center rounded-[3px] font-mono font-bold leading-none transition cursor-pointer ${colorCls} ${
                isHero
                  ? 'z-10 ring-2 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.95)] scale-105'
                  : ''
              }`}
              title={`${cell.handKey}: ${cell.action.toUpperCase()}`}
            >
              {cell.handKey}
            </button>
          );
        })}
      </div>

      {/* Active Cell Explanation */}
      <div className="mt-2.5 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-black text-amber-200">
            {activeCell.handKey} · {position} 位
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              activeCell.action === 'raise'
                ? 'bg-rose-500/25 text-rose-300'
                : activeCell.action === 'call'
                  ? 'bg-emerald-500/25 text-emerald-300'
                  : 'bg-slate-600/30 text-slate-300'
            }`}
          >
            {activeCell.action === 'raise'
              ? '建议加注'
              : activeCell.action === 'call'
                ? '建议跟注'
                : '建议弃牌'}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/80">
          {activeCell.reasonZh}
        </p>
      </div>
    </div>
  );
};

import React from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';

export interface TimelineMarker {
  tone: 'danger' | 'warning' | 'info';
  tooltip?: string;
}

export interface ReplayTimelineProps {
  totalSteps: number;
  currentStep: number;
  autoPlaying: boolean;
  markers?: Record<number, TimelineMarker>;
  legendText?: string;
  finalLabel?: string;
  onStepChange: (step: number) => void;
  onToggleAutoPlay: () => void;
}

export const ReplayTimeline: React.FC<ReplayTimelineProps> = ({
  totalSteps,
  currentStep,
  autoPlaying,
  markers = {},
  legendText,
  finalLabel = '终局',
  onStepChange,
  onToggleAutoPlay,
}) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentStep <= 0}
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-amber-100 disabled:opacity-35 cursor-pointer"
            aria-label="上一步"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleAutoPlay}
            className="flex items-center gap-1 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-emerald-950 cursor-pointer"
          >
            {autoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoPlaying ? '暂停' : '自动回放'}
          </button>
          <button
            type="button"
            disabled={currentStep >= totalSteps}
            onClick={() => onStepChange(Math.min(totalSteps, currentStep + 1))}
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-amber-100 disabled:opacity-35 cursor-pointer"
            aria-label="下一步"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {legendText && <span className="text-[11px] text-rose-300">{legendText}</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: totalSteps }, (_, idx) => {
          const marker = markers[idx];
          const active = currentStep === idx;
          const markerCls =
            marker?.tone === 'danger'
              ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
              : marker?.tone === 'warning'
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                : marker?.tone === 'info'
                  ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                  : 'border-white/10 bg-white/5 text-emerald-100/75 hover:bg-white/10';

          const dotCls =
            marker?.tone === 'danger'
              ? 'bg-rose-500'
              : marker?.tone === 'warning'
                ? 'bg-amber-400'
                : 'bg-sky-400';

          return (
            <button
              key={idx}
              type="button"
              title={marker?.tooltip}
              onClick={() => onStepChange(idx)}
              className={`relative rounded-lg border px-2 py-1 text-[11px] font-mono font-bold transition cursor-pointer ${
                active ? 'border-amber-300 bg-amber-400 text-emerald-950' : markerCls
              }`}
            >
              {idx + 1}
              {marker && <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${dotCls}`} />}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onStepChange(totalSteps)}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
            currentStep === totalSteps
              ? 'border-amber-300 bg-amber-400 text-emerald-950'
              : 'border-white/10 bg-white/5 text-emerald-100/75 hover:bg-white/10'
          }`}
        >
          {finalLabel}
        </button>
      </div>
    </div>
  );
};

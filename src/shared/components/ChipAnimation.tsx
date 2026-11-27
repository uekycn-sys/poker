import React, { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChipDeltaEvent } from '../store/playerStore';

export type ChipTone = 'gold' | 'crimson' | 'emerald' | 'sapphire' | 'obsidian';

const CHIP_PALETTE: Record<
  ChipTone,
  { outer: string; rim: string; mid: string; core: string; dash: string; star: string }
> = {
  gold: {
    outer: '#ca8a04',
    rim: '#fef08a',
    mid: '#eab308',
    core: '#92400e',
    dash: '#fef9c3',
    star: '#fffbeb',
  },
  crimson: {
    outer: '#be123c',
    rim: '#fecdd3',
    mid: '#f43f5e',
    core: '#881337',
    dash: '#fff1f2',
    star: '#ffe4e6',
  },
  emerald: {
    outer: '#047857',
    rim: '#a7f3d0',
    mid: '#10b981',
    core: '#064e3b',
    dash: '#ecfdf5',
    star: '#d1fae5',
  },
  sapphire: {
    outer: '#0369a1',
    rim: '#bae6fd',
    mid: '#0ea5e9',
    core: '#0c4a6e',
    dash: '#f0f9ff',
    star: '#e0f2fe',
  },
  obsidian: {
    outer: '#334155',
    rim: '#cbd5e1',
    mid: '#475569',
    core: '#0f172a',
    dash: '#f8fafc',
    star: '#fde047',
  },
};

export function ChipTokenSvg({
  className = 'w-5 h-5',
  tone = 'gold',
}: {
  className?: string;
  tone?: ChipTone;
}) {
  const uid = useId().replace(/:/g, '');
  const p = CHIP_PALETTE[tone];

  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`chipGrad-${uid}`} cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor={p.rim} />
          <stop offset="52%" stopColor={p.mid} />
          <stop offset="100%" stopColor={p.outer} />
        </radialGradient>
      </defs>
      {/* Outer Casino Clay Disc */}
      <circle cx="18" cy="18" r="15.5" fill={`url(#chipGrad-${uid})`} stroke={p.rim} strokeWidth="1.3" />
      {/* 6 Inlaid Edge Stripes */}
      <circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        stroke={p.dash}
        strokeOpacity="0.88"
        strokeWidth="2.4"
        strokeDasharray="3.4 4.4"
      />
      {/* Recessed Inner Ring */}
      <circle cx="18" cy="18" r="10.4" fill={p.core} fillOpacity="0.72" stroke={p.rim} strokeOpacity="0.65" strokeWidth="1" />
      {/* Inner Bevel & Diamond Crest */}
      <circle cx="18" cy="18" r="7.5" fill="none" stroke={p.rim} strokeOpacity="0.35" strokeWidth="0.8" />
      <path d="M18 12.2 L22 18 L18 23.8 L14 18 Z" fill={p.star} />
    </svg>
  );
}

interface ChipStackProps {
  amount: number;
  compact?: boolean;
  className?: string;
}

function getChipLayers(amount: number): ChipTone[] {
  if (amount >= 5000) return ['obsidian', 'gold', 'crimson', 'gold'];
  if (amount >= 1000) return ['crimson', 'gold', 'sapphire'];
  if (amount >= 200) return ['sapphire', 'emerald', 'gold'];
  return ['emerald', 'gold'];
}

export const ChipStack: React.FC<ChipStackProps> = ({
  amount,
  compact = false,
  className = '',
}) => {
  if (amount <= 0) return null;
  const layers = getChipLayers(amount);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300/45 bg-black/75 ${
        compact ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
      } shadow-[0_6px_14px_rgba(0,0,0,0.55)] backdrop-blur-sm ${className}`}
    >
      <div
        className="relative shrink-0"
        style={{
          width: compact ? 16 : 20,
          height: compact ? 16 + (layers.length - 1) * 2.5 : 20 + (layers.length - 1) * 3,
        }}
      >
        {layers.map((tone, idx) => (
          <div
            key={`${tone}-${idx}`}
            className="absolute inset-x-0"
            style={{
              bottom: idx * (compact ? 2.5 : 3),
              zIndex: idx + 1,
            }}
          >
            <ChipTokenSvg
              tone={tone}
              className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]`}
            />
          </div>
        ))}
      </div>
      <span
        className={`font-mono font-black tracking-tight text-amber-200 ${
          compact ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {amount.toLocaleString()}
      </span>
    </div>
  );
};

interface ChipBalancePillProps {
  chips: number;
  lastDelta?: ChipDeltaEvent | null;
  label?: string;
  compact?: boolean;
  className?: string;
}

export const ChipBalancePill: React.FC<ChipBalancePillProps> = ({
  chips,
  lastDelta,
  label,
  compact = false,
  className = '',
}) => {
  const [visibleDelta, setVisibleDelta] = useState<ChipDeltaEvent | null>(null);

  useEffect(() => {
    if (!lastDelta || lastDelta.amount === 0) return;
    if (Date.now() - lastDelta.timestamp > 4500) return;
    setVisibleDelta(lastDelta);
    const timer = setTimeout(() => {
      setVisibleDelta(null);
    }, 2400);
    return () => clearTimeout(timer);
  }, [lastDelta]);

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 rounded-full border border-amber-400/45 bg-black/55 ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      } shadow-[inset_0_1px_0_rgba(253,230,138,0.18)] backdrop-blur-sm ${className}`}
    >
      <motion.div
        key={chips}
        initial={{ rotate: -18, scale: 1.18 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 20 }}
      >
        <ChipTokenSvg className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </motion.div>

      <div className="flex items-baseline gap-1.5">
        {label && <span className="text-[11px] font-bold text-amber-200/75">{label}</span>}
        <motion.span
          key={`bal-${chips}`}
          initial={{ scale: 1.12, color: '#fde047' }}
          animate={{ scale: 1, color: '#fcd34d' }}
          transition={{ duration: 0.35 }}
          className="font-mono font-black tracking-tight text-amber-300"
        >
          {chips.toLocaleString()}
        </motion.span>
      </div>

      <AnimatePresence>
        {visibleDelta && (
          <motion.span
            key={visibleDelta.timestamp}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -16, scale: 1 }}
            exit={{ opacity: 0, y: -26 }}
            transition={{ duration: 0.5 }}
            className={`pointer-events-none absolute -top-2 right-2 rounded-full px-2 py-0.5 font-mono text-[11px] font-black shadow-lg ${
              visibleDelta.amount >= 0
                ? 'bg-emerald-500 text-emerald-950'
                : 'bg-rose-500 text-white'
            }`}
          >
            {visibleDelta.amount >= 0
              ? `+${visibleDelta.amount.toLocaleString()}`
              : visibleDelta.amount.toLocaleString()}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ChipBurstOverlayProps {
  triggerKey: string | number | boolean;
  count?: number;
}

export const ChipBurstOverlay: React.FC<ChipBurstOverlayProps> = ({ triggerKey, count = 14 }) => {
  if (!triggerKey) return null;

  const coins = Array.from({ length: count }, (_, idx) => {
    const angle = (idx / count) * Math.PI * 2;
    const distance = 68 + (idx % 3) * 32;
    return {
      idx,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 12,
      rotate: (idx % 2 === 0 ? 1 : -1) * (180 + idx * 24),
      delay: (idx % 4) * 0.04,
    };
  });

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      {coins.map((c) => (
        <motion.div
          key={`${String(triggerKey)}-${c.idx}`}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{
            x: c.tx,
            y: c.ty,
            scale: [0.4, 1.05, 0.8],
            rotate: c.rotate,
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 0.95, delay: c.delay, ease: 'easeOut' }}
          className="absolute"
        >
          <ChipTokenSvg className="h-5 w-5 drop-shadow" />
        </motion.div>
      ))}
    </div>
  );
};

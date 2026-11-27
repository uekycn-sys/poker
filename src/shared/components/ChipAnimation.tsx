import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChipDeltaEvent } from '../store/playerStore';

export function ChipTokenSvg({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="goldChipGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#goldChipGrad)" stroke="#fde047" strokeWidth="1.5" />
      <circle
        cx="16"
        cy="16"
        r="10.2"
        fill="none"
        stroke="#451a03"
        strokeOpacity="0.45"
        strokeWidth="1.6"
        strokeDasharray="3 2.5"
      />
      <circle cx="16" cy="16" r="7" fill="#78350f" fillOpacity="0.35" />
      <path d="M16 11 L19.5 16 L16 21 L12.5 16 Z" fill="#fef9c3" />
    </svg>
  );
}

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
      className={`relative inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/45 ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      } shadow-inner backdrop-blur-sm ${className}`}
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

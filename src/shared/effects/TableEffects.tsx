import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type FxKind =
  | 'BOMB'
  | 'ROCKET'
  | 'STRAIGHT'
  | 'PAIR_STRAIGHT'
  | 'AIRPLANE'
  | 'SPRING'
  | 'ANTI_SPRING'
  | 'ALL_IN'
  | 'JACKPOT'
  | 'VICTORY';

export interface TableFxEvent {
  id: number;
  kind: FxKind;
  label: string;
  subLabel?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  petal?: boolean;
  rotation?: number;
  vr?: number;
}

interface TableEffectsProps {
  fx: TableFxEvent | null;
  onComplete: () => void;
}

function spawnParticles(kind: FxKind, w: number, h: number): Particle[] {
  const cx = w * 0.5;
  const cy = h * 0.45;
  const particles: Particle[] = [];

  if (kind === 'BOMB' || kind === 'ROCKET' || kind === 'ALL_IN' || kind === 'JACKPOT') {
    const colors =
      kind === 'ROCKET'
        ? ['#38bdf8', '#f43f5e', '#fbbf24', '#ffffff']
        : kind === 'ALL_IN' || kind === 'JACKPOT'
          ? ['#fbbf24', '#fde047', '#f59e0b', '#34d399']
          : ['#f59e0b', '#ef4444', '#fde047', '#fb923c'];
    const count = kind === 'ROCKET' || kind === 'JACKPOT' ? 120 : 85;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 11;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 2.5 + Math.random() * 5,
        color: colors[i % colors.length],
        alpha: 1,
        decay: 0.015 + Math.random() * 0.016,
      });
    }
  } else if (kind === 'STRAIGHT' || kind === 'PAIR_STRAIGHT' || kind === 'AIRPLANE') {
    const colors = ['#fde047', '#34d399', '#fbbf24', '#fef08a'];
    for (let i = 0; i < 65; i++) {
      particles.push({
        x: w * 0.12 + Math.random() * w * 0.2,
        y: cy + (Math.random() - 0.5) * 90,
        vx: 7 + Math.random() * 9,
        vy: (Math.random() - 0.5) * 2.2,
        size: 2 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1,
        decay: 0.018 + Math.random() * 0.012,
      });
    }
  } else {
    // SPRING / ANTI_SPRING / VICTORY drifting petals
    const colors = ['#fbbf24', '#fb7185', '#fde047', '#f472b6'];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * w,
        y: -20 - Math.random() * 180,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 2.4 + Math.random() * 3.2,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
        alpha: 0.95,
        decay: 0.006,
        petal: true,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.08,
      });
    }
  }

  return particles;
}

export const TableEffects: React.FC<TableEffectsProps> = ({ fx, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!fx) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = spawnParticles(fx.kind, w, h);
    let animId = 0;
    const duration =
      fx.kind === 'SPRING' || fx.kind === 'ANTI_SPRING' || fx.kind === 'VICTORY' ? 2300 : 1450;
    const start = performance.now();

    const tick = (now: number) => {
      ctx.clearRect(0, 0, w, h);

      const elapsed = now - start;
      if ((fx.kind === 'ROCKET' || fx.kind === 'BOMB') && elapsed < 220) {
        const flashAlpha = (1 - elapsed / 220) * (fx.kind === 'ROCKET' ? 0.35 : 0.24);
        ctx.fillStyle =
          fx.kind === 'ROCKET'
            ? `rgba(125,211,252,${flashAlpha})`
            : `rgba(251,191,36,${flashAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (fx.kind === 'ROCKET' && elapsed < 420) {
        ctx.save();
        ctx.strokeStyle = `rgba(186,230,253,${1 - elapsed / 420})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.2, 0);
        ctx.lineTo(w * 0.48, h * 0.36);
        ctx.lineTo(w * 0.42, h * 0.46);
        ctx.lineTo(w * 0.78, h * 0.88);
        ctx.stroke();
        ctx.restore();
      }

      let alive = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (!p.petal) {
          p.vy += 0.14;
        } else {
          p.rotation = (p.rotation ?? 0) + (p.vr ?? 0);
          p.x += Math.sin(elapsed * 0.004 + p.y * 0.02) * 0.6;
        }
        p.alpha = Math.max(0, p.alpha - p.decay);
        if (p.alpha <= 0) continue;
        alive++;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        if (p.petal) {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation ?? 0);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < duration && alive > 0) {
        animId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        onComplete();
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [fx, onComplete]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />
      <AnimatePresence>
        {fx && (
          <motion.div
            key={fx.id}
            initial={{ opacity: 0, scale: 0.55, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.15, y: -16 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className="absolute inset-x-0 top-[24%] flex justify-center px-4"
          >
            <div
              className={`rounded-2xl border-2 px-6 py-2.5 text-center shadow-[0_18px_48px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md ${
                fx.kind === 'ROCKET'
                  ? 'border-sky-300/80 bg-gradient-to-r from-rose-900/95 via-slate-900/95 to-sky-900/95 text-sky-100'
                  : fx.kind === 'BOMB' ||
                      fx.kind === 'SPRING' ||
                      fx.kind === 'ANTI_SPRING' ||
                      fx.kind === 'ALL_IN' ||
                      fx.kind === 'JACKPOT' ||
                      fx.kind === 'VICTORY'
                    ? 'border-amber-300/90 bg-gradient-to-r from-amber-900/95 via-amber-700/95 to-amber-900/95 text-amber-100'
                    : 'border-emerald-300/70 bg-emerald-950/90 text-amber-200'
              }`}
            >
              <div className="gold-foil-text text-xl sm:text-2xl md:text-3xl font-black tracking-wider">
                {fx.label}
              </div>
              {fx.subLabel && (
                <div className="mt-0.5 text-[11px] sm:text-xs font-bold text-amber-200/90">{fx.subLabel}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

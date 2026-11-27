import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, Smartphone, X } from 'lucide-react';
import { enterFullscreenWithLandscape } from './FullscreenButton';

function checkPortraitNarrow(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 640 && window.innerHeight > window.innerWidth * 1.15;
}

export const LandscapeHintOverlay: React.FC = () => {
  const [isPortraitNarrow, setIsPortraitNarrow] = useState<boolean>(() => checkPortraitNarrow());
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const onResize = () => {
      const portrait = checkPortraitNarrow();
      setIsPortraitNarrow(portrait);
      if (!portrait) {
        setDismissed(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const visible = isPortraitNarrow && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-3 bottom-3 z-[60] flex justify-center pointer-events-none"
        >
          <div className="hud-glass pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-2xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/45 bg-amber-400/15 text-amber-300">
              <Smartphone className="h-5 w-5 -rotate-90" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-amber-100">横屏全屏畅玩体验更佳</div>
              <div className="text-[11px] text-emerald-200/75">
                横屏可完整展示牌桌筹码、手牌与教练面板
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void enterFullscreenWithLandscape();
                setDismissed(true);
              }}
              className="game-btn-gold inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-black cursor-pointer"
            >
              <Maximize2 className="h-3 w-3" /> 横屏全屏
            </button>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="继续竖屏"
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

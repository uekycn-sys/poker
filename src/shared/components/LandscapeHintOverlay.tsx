import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2, X } from 'lucide-react';
import { useStageViewport } from '../hooks/useStageViewport';
import {
  enterFullscreenWithLandscape,
  isFullscreenSupported,
  useFullscreen,
} from './FullscreenButton';

export const LandscapeHintOverlay: React.FC = () => {
  const { isForcedLandscape } = useStageViewport();
  const { isFullscreen } = useFullscreen();
  const [dismissed, setDismissed] = useState<boolean>(false);

  const visible = isForcedLandscape && isFullscreenSupported() && !isFullscreen && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed right-3 bottom-3 z-[60] flex items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => {
              void enterFullscreenWithLandscape();
              setDismissed(true);
            }}
            className="game-btn-gold inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-black shadow-2xl cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" /> 原生全屏横屏
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="关闭全屏横屏提示"
            className="hud-glass rounded-full p-1.5 text-amber-200 hover:bg-white/15 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Coins, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { ChipBurstOverlay } from './ChipAnimation';

export const BankruptcyAidModal: React.FC = () => {
  const pendingAidAnimation = usePlayerStore((s) => s.pendingAidAnimation);
  const lastAidGrant = usePlayerStore((s) => s.lastAidGrant);
  const chips = usePlayerStore((s) => s.chips);
  const dismissAidAnimation = usePlayerStore((s) => s.dismissAidAnimation);

  return (
    <AnimatePresence>
      {pendingAidAnimation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="relative max-h-[94%] w-full max-w-md overflow-y-auto rounded-2xl sm:rounded-3xl border border-amber-300/70 bg-gradient-to-b from-amber-950/95 via-emerald-950 to-emerald-950 p-4 sm:p-6 text-center shadow-2xl"
          >
            <ChipBurstOverlay triggerKey={pendingAidAnimation} count={16} />

            <motion.div
              animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 0.75 }}
              className="relative z-10 mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/20 text-amber-300 shadow-inner"
            >
              <Coins className="h-7 w-7 sm:h-9 sm:w-9" />
            </motion.div>

            <div className="relative z-10 mt-2 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> 破产补助已到账
            </div>
            <h3 className="relative z-10 mt-1.5 text-lg sm:text-xl font-black text-amber-100">
              东山再起补给金
            </h3>
            <p className="relative z-10 mt-1 text-xs text-emerald-200/80">
              检测到您的通用筹码 / 欢乐豆不足 1,000，俱乐部已自动为您发放助战补给！
            </p>

            <div className="relative z-10 my-3 rounded-2xl border border-amber-400/30 bg-black/35 py-2.5">
              <div className="font-mono text-2xl sm:text-3xl font-black text-amber-300">
                +{lastAidGrant.toLocaleString()}
              </div>
              <div className="mt-0.5 text-xs text-emerald-200/80">
                当前通用资产：{chips.toLocaleString()}
              </div>
            </div>

            <button
              type="button"
              onClick={dismissAidAnimation}
              className="game-btn-gold relative z-10 inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" /> 开心收下，继续征战
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

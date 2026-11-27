import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins, Sparkles } from 'lucide-react';
import { useProfileStore } from '../../store/profileStore';

export const BankruptcyAidModal: React.FC = () => {
  const pendingAidAnimation = useProfileStore((s) => s.pendingAidAnimation);
  const lastAidGrant = useProfileStore((s) => s.lastAidGrant);
  const beans = useProfileStore((s) => s.beans);
  const dismissAidAnimation = useProfileStore((s) => s.dismissAidAnimation);

  return (
    <AnimatePresence>
      {pendingAidAnimation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.78, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            className="w-full max-w-sm rounded-3xl border border-amber-300/70 bg-gradient-to-b from-amber-950/95 via-emerald-950 to-emerald-950 p-6 text-center shadow-2xl"
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 0.75 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/20 text-amber-300 shadow-inner"
            >
              <Coins className="h-9 w-9" />
            </motion.div>

            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-bold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> 破产补助已到账
            </div>
            <h3 className="mt-2 text-xl font-black text-amber-100">东山再起补给金</h3>
            <p className="mt-1 text-xs text-emerald-200/80">
              检测到您的欢乐豆不足 1,000，系统已自动为您发放助战豆子！
            </p>

            <div className="my-4 rounded-2xl border border-amber-400/30 bg-black/35 py-3">
              <div className="text-3xl font-black font-mono text-amber-300">
                +{lastAidGrant.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-emerald-200/75">
                当前欢乐豆：{beans.toLocaleString()}
              </div>
            </div>

            <button
              type="button"
              onClick={dismissAidAnimation}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-black text-emerald-950 shadow-lg transition hover:brightness-105 cursor-pointer"
            >
              开心收下，继续冲分
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

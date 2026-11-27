import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, CheckCircle2, Coins, XCircle } from 'lucide-react';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';

export const BlindQuizModal: React.FC = () => {
  const quiz = useDoudizhuGameStore((s) => s.activeBlindQuiz);
  const feedback = useDoudizhuGameStore((s) => s.blindQuizFeedback);
  const answerBlindQuiz = useDoudizhuGameStore((s) => s.answerBlindQuiz);
  const dismissBlindQuiz = useDoudizhuGameStore((s) => s.dismissBlindQuiz);

  return (
    <AnimatePresence>
      {quiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-md rounded-3xl border border-amber-300/60 bg-gradient-to-b from-emerald-950 via-[#07261b] to-[#041810] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
                <Brain className="h-4 w-4" /> 盲记抽测训练
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                <Coins className="h-3.5 w-3.5" /> 答对 +{quiz.rewardBeans} 金币
              </span>
            </div>

            <h3 className="mt-4 text-lg font-black text-amber-50">{quiz.prompt}</h3>
            <p className="mt-1 text-xs text-emerald-200/70">
              不包含你手中的牌，请回忆前面已经打出的牌张！
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5">
              {quiz.options.map((opt) => {
                const isSelected = feedback?.selected === opt;
                const isCorrectOpt = opt === quiz.correctText;
                let cls = 'border-white/15 bg-white/5 text-amber-100 hover:bg-white/10';
                if (feedback) {
                  if (isCorrectOpt) {
                    cls = 'border-emerald-400 bg-emerald-500/25 text-emerald-200';
                  } else if (isSelected) {
                    cls = 'border-rose-400 bg-rose-500/25 text-rose-200';
                  } else {
                    cls = 'border-white/10 bg-white/5 text-slate-400 opacity-60';
                  }
                }
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={Boolean(feedback)}
                    onClick={() => answerBlindQuiz(opt)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition cursor-pointer ${cls}`}
                  >
                    <span>{opt}</span>
                    {feedback && isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                    {feedback && isSelected && !isCorrectOpt && (
                      <XCircle className="h-4 w-4 text-rose-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className="mt-4 space-y-3">
                <div
                  className={`rounded-xl p-3 text-xs font-bold ${
                    feedback.isCorrect
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-rose-500/20 text-rose-200'
                  }`}
                >
                  {feedback.isCorrect
                    ? `记牌精准！已获得 +${quiz.rewardBeans} 通用金币奖励。`
                    : `记忆有偏差，正确答案是：${feedback.correctText}`}
                </div>
                <button
                  type="button"
                  onClick={dismissBlindQuiz}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-black text-emerald-950 shadow-lg hover:brightness-105 cursor-pointer"
                >
                  继续对局
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

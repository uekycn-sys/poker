import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Sparkles, XCircle } from 'lucide-react';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { formatCardShort } from '../engine/deck';
import { HoldemCard } from '../engine/types';
import { OutsQuizState } from '../store/holdemGameStore';

interface OutsQuizModalProps {
  quiz: OutsQuizState;
  heroCards: readonly HoldemCard[];
  boardCards: readonly HoldemCard[];
  trainingPoints: number;
  onSubmit: (answer: number | null, timedOut?: boolean) => void;
  onDismiss: () => void;
}

const TOTAL_MS = 8000;
const QUICK_PRESETS = [4, 6, 8, 9, 12, 15];

export const OutsQuizModal: React.FC<OutsQuizModalProps> = ({
  quiz,
  heroCards,
  boardCards,
  trainingPoints,
  onSubmit,
  onDismiss,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [remainingMs, setRemainingMs] = useState(TOTAL_MS);

  useEffect(() => {
    setInputVal('');
    setRemainingMs(TOTAL_MS);
  }, [quiz.startedAt]);

  useEffect(() => {
    if (quiz.result) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - quiz.startedAt;
      const left = Math.max(0, TOTAL_MS - elapsed);
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
        const parsed = inputVal.trim() === '' ? null : Number(inputVal);
        onSubmit(Number.isFinite(parsed) ? parsed : null, true);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [quiz.startedAt, quiz.result, inputVal, onSubmit]);

  const pct = Math.max(0, Math.min(100, (remainingMs / TOTAL_MS) * 100));
  const secondsLeft = (remainingMs / 1000).toFixed(1);

  const handleConfirm = (val?: number) => {
    if (quiz.result) return;
    const numeric = val ?? (inputVal.trim() === '' ? 0 : Number(inputVal));
    if (!Number.isFinite(numeric)) return;
    onSubmit(Math.max(0, Math.round(numeric)), false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="gold-card-border max-h-[94%] w-full max-w-lg overflow-y-auto rounded-2xl sm:rounded-3xl border bg-[#061b13] p-4 sm:p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <h3 className="text-base font-black text-amber-100">
              Outs 盲测挑战 · {quiz.street === 'flop' ? '翻牌圈' : '转牌圈'}
            </h3>
          </div>
          <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-0.5 font-mono text-xs font-black text-amber-200">
            训练积分: {trainingPoints}
          </span>
        </div>

        {/* 8-second Countdown Bar */}
        {!quiz.result && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="inline-flex items-center gap-1 text-amber-200">
                <Clock className="h-3.5 w-3.5" /> 请在 8 秒内计算当前补牌数 (Outs)
              </span>
              <span
                className={`font-mono font-black ${
                  remainingMs < 3000 ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {secondsLeft}s
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/60">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  remainingMs < 3000
                    ? 'bg-gradient-to-r from-rose-500 to-amber-400'
                    : 'bg-gradient-to-r from-emerald-400 to-amber-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Cards Preview */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-3.5">
          <div className="text-center">
            <div className="mb-1.5 text-[10px] font-bold text-amber-200/75">你的手牌</div>
            <div className="flex gap-1.5">
              {heroCards.map((c) => (
                <PlayingCard key={c.id} card={c} size="sm" />
              ))}
            </div>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div className="text-center">
            <div className="mb-1.5 text-[10px] font-bold text-emerald-200/75">公共牌</div>
            <div className="flex gap-1.5">
              {boardCards.map((c) => (
                <PlayingCard key={c.id} card={c} size="sm" />
              ))}
            </div>
          </div>
        </div>

        {!quiz.result ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_PRESETS.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleConfirm(num)}
                  className="rounded-xl border border-amber-300/35 bg-amber-400/15 px-3.5 py-2 font-mono text-sm font-black text-amber-200 transition hover:bg-amber-400/30 cursor-pointer"
                >
                  {num} Outs
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={47}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                placeholder="或手动输入补牌数量..."
                className="flex-1 rounded-xl border border-white/15 bg-black/50 px-3.5 py-2.5 font-mono text-sm font-bold text-white outline-none focus:border-amber-300"
              />
              <button
                type="button"
                onClick={() => handleConfirm()}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2.5 text-sm font-black text-emerald-950 shadow cursor-pointer hover:brightness-105"
              >
                提交答案
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div
              className={`flex items-start gap-3 rounded-2xl border p-3.5 ${
                quiz.result.exact
                  ? 'border-emerald-400/50 bg-emerald-500/15'
                  : quiz.result.close
                    ? 'border-amber-400/50 bg-amber-500/15'
                    : 'border-rose-400/50 bg-rose-500/15'
              }`}
            >
              {quiz.result.exact || quiz.result.close ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
              )}
              <div className="text-xs leading-relaxed">
                <div className="text-sm font-black text-white">
                  {quiz.result.exact
                    ? `完美命中！+${quiz.result.pointsEarned} 训练积分`
                    : quiz.result.close
                      ? `接近正确答案（误差 ±1）！+${quiz.result.pointsEarned} 训练积分`
                      : quiz.result.timedOut
                        ? '8 秒超时未作答'
                        : `回答为 ${quiz.result.userAnswer}，继续加油`}
                </div>
                <div className="mt-1 text-emerald-100/90">
                  实际精准补牌：<strong className="text-amber-300">{quiz.outsAnalysis.totalOuts} 张 Outs</strong> —{' '}
                  {quiz.outsAnalysis.summaryZh}
                </div>
                {quiz.outsAnalysis.outCards.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {quiz.outsAnalysis.outCards.map((oc) => (
                      <span
                        key={oc.id}
                        className={`rounded border border-white/15 bg-black/50 px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                          oc.suit === 'hearts' || oc.suit === 'diamonds'
                            ? 'text-rose-300'
                            : 'text-slate-200'
                        }`}
                      >
                        {formatCardShort(oc)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-black text-emerald-950 shadow cursor-pointer hover:brightness-105"
            >
              解锁数学面板并继续行动
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

import React from 'react';
import {
  ArrowLeft,
  BrainCircuit,
  Grid3X3,
  History,
  Play,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { ChipBalancePill, FullscreenButton, PlayerAvatar, usePlayerStore } from '../../../shared';
import { AI_PERSONAS } from '../ai/personas';
import { useHoldemProfileStore } from '../store/holdemProfileStore';
import { useHoldemGameStore } from '../store/holdemGameStore';

interface HoldemHubProps {
  onExitToLobby: () => void;
}

const STAKES = [
  { id: 'micro', name: '微额训练桌', sb: 10, bb: 20, buyIn: '2,000', tag: '适合新手熟悉范围' },
  { id: 'mid', name: '中额标准桌', sb: 50, bb: 100, buyIn: '10,000', tag: '100BB 经典深度' },
  { id: 'high', name: '豪客博弈桌', sb: 200, bb: 400, buyIn: '40,000', tag: '高压资金冲击' },
];

export const HoldemHub: React.FC<HoldemHubProps> = ({ onExitToLobby }) => {
  const chips = usePlayerStore((s) => s.chips);
  const lastChipDelta = usePlayerStore((s) => s.lastChipDelta);

  const selectedStake = useHoldemProfileStore((s) => s.selectedStake);
  const outsQuizEnabled = useHoldemProfileStore((s) => s.outsQuizEnabled);
  const trainingPoints = useHoldemProfileStore((s) => s.trainingPoints);
  const outsQuizCorrect = useHoldemProfileStore((s) => s.outsQuizCorrect);
  const outsQuizAttempts = useHoldemProfileStore((s) => s.outsQuizAttempts);
  const recentHands = useHoldemProfileStore((s) => s.recentHands);

  const setSelectedStake = useHoldemProfileStore((s) => s.setSelectedStake);
  const toggleOutsQuiz = useHoldemProfileStore((s) => s.toggleOutsQuiz);

  const startTable = useHoldemGameStore((s) => s.startTable);
  const openReplayScreen = useHoldemGameStore((s) => s.openReplayScreen);

  return (
    <div className="casino-room-bg safe-area-pad min-h-[100dvh] w-full px-4 py-4 sm:py-6 md:px-10">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Top Bar */}
        <header className="hud-glass flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExitToLobby}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-white/15 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> 返回大厅
            </button>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-black text-rose-200">
                TEXAS HOLD’EM · 6-MAX NLH
              </span>
              <h1 className="gold-shimmer-text mt-1 text-2xl font-black">
                德州扑克 · GTO 大师训练营
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ChipBalancePill chips={chips} lastDelta={lastChipDelta} label="俱乐部资产" />
            <FullscreenButton />
          </div>
        </header>

        {/* Stakes & Mode Launch Card */}
        <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="gold-card-border flex flex-col justify-between rounded-3xl border bg-gradient-to-br from-emerald-950/90 to-[#04160f] p-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-amber-100">
                <Target className="h-5 w-5 text-amber-300" /> 选择 6 人桌盲注级别
              </h2>
              <p className="mt-1 text-xs text-emerald-200/75">
                完整覆盖边池拆分、13×13 翻前范围矩阵、蒙特卡洛胜率教练、8 秒 Outs 盲测与四条街 EV 复盘重打。
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {STAKES.map((s) => {
                  const active = selectedStake === s.bb;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStake(s.bb)}
                      className={`rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        active
                          ? 'border-amber-300 bg-amber-400/20 shadow-lg'
                          : 'border-white/10 bg-black/35 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-black text-amber-100">{s.name}</div>
                      <div className="mt-1 font-mono text-lg font-black text-amber-300">
                        {s.sb} / {s.bb}
                      </div>
                      <div className="mt-1 text-[10px] text-emerald-200/75">
                        默认带入 {s.buyIn}
                      </div>
                      <div className="mt-0.5 text-[10px] text-amber-200/70">{s.tag}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => startTable(selectedStake)}
                className="game-btn-crimson flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" /> 立即入座开打 ({selectedStake / 2}/
                {selectedStake})
              </button>
              <button
                type="button"
                onClick={() => openReplayScreen()}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-5 py-3.5 text-xs font-black text-amber-200 hover:bg-amber-400/20 cursor-pointer"
              >
                <History className="h-4 w-4" /> EV 牌局复盘 ({recentHands.length})
              </button>
            </div>
          </div>

          {/* Outs Blind Quiz & Coach Stats Card */}
          <div className="gold-card-border flex flex-col justify-between rounded-3xl border bg-black/45 p-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-black text-sky-200">
                  <Sparkles className="h-4 w-4 text-sky-300" /> Outs 盲测训练模式
                </h2>
                <button
                  type="button"
                  onClick={toggleOutsQuiz}
                  className={`rounded-full px-3 py-1 text-xs font-black transition cursor-pointer ${
                    outsQuizEnabled
                      ? 'bg-sky-400 text-slate-950'
                      : 'border border-white/15 bg-white/5 text-slate-300'
                  }`}
                >
                  {outsQuizEnabled ? '已开启' : '未开启'}
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
                开启后，每当你在翻牌圈或转牌圈击中听牌，教练将自动锁定数学面板并弹出 8 秒倒计时，训练你瞬间心算补牌数（Outs）。
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/40 py-2.5">
                  <div className="font-mono text-lg font-black text-amber-300">
                    {trainingPoints}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">训练积分</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 py-2.5">
                  <div className="font-mono text-lg font-black text-emerald-300">
                    {outsQuizCorrect}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">精确命中</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 py-2.5">
                  <div className="font-mono text-lg font-black text-sky-300">
                    {outsQuizAttempts > 0
                      ? `${Math.round((outsQuizCorrect / outsQuizAttempts) * 100)}%`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">盲测准确率</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
              <BrainCircuit className="h-4 w-4 shrink-0 text-amber-300" />
              <span>
                支持牌桌内随时一键展开 <strong className="text-amber-200">13×13 GTO 范围矩阵</strong>
              </span>
              <Grid3X3 className="ml-auto h-4 w-4 shrink-0 text-amber-300" />
            </div>
          </div>
        </section>

        {/* 5 AI Opponents Scouting Board */}
        <section className="gold-card-border rounded-3xl border bg-black/40 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-black text-amber-100">
              <Users className="h-5 w-5 text-amber-300" /> 5 位风格鲜明的可剥削 AI 对手档案
            </h2>
            <span className="text-xs text-emerald-200/70">
              牌桌头像下方实时统计 VPIP（入池率）与 PFR（翻前加注率）
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {AI_PERSONAS.map((ai) => (
              <div
                key={ai.id}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-emerald-950/45 p-3.5"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar avatarId={ai.avatarId} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-amber-50">
                        {ai.name}
                      </div>
                      <div className="text-[10px] font-black text-amber-300">
                        {ai.styleLabel}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-emerald-100/80">
                    {ai.bioZh}
                  </p>
                </div>

                <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-2 text-[10px] leading-relaxed text-rose-200">
                  {ai.exploitTipZh}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

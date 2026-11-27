import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  Brain,
  Coins,
  Flame,
  History,
  Play,
  Puzzle,
  Sparkles,
  Volume2,
  VolumeX,
  MessageSquare,
  MessageSquareOff,
} from 'lucide-react';
import { AIDifficulty } from '../engine';
import { FullscreenButton } from '../../../shared/components';
import { getRankTier, usePlayerStore } from '../../../shared/store/playerStore';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';

const DIFFICULTY_OPTIONS: Array<{
  id: AIDifficulty;
  title: string;
  desc: string;
}> = [
  { id: 'casual', title: '休闲局', desc: '轻松娱乐，AI 偶有让步，适合热身' },
  { id: 'intermediate', title: '进阶局', desc: '完整手牌拆解 + 守门员顶牌配合' },
  { id: 'master', title: '大师局', desc: '全记牌推演 + 残局 Alpha-Beta 算杀' },
];

const ROOM_TIERS = [
  { baseScore: 50, name: '新手场', minChips: 0 },
  { baseScore: 100, name: '进阶场', minChips: 1000 },
  { baseScore: 200, name: '大师场', minChips: 3000 },
];

interface DoudizhuHubProps {
  onExitToLobby: () => void;
}

export const DoudizhuHub: React.FC<DoudizhuHubProps> = ({ onExitToLobby }) => {
  const chips = usePlayerStore((s) => s.chips);
  const rankPoints = usePlayerStore((s) => s.rankPoints);
  const doudizhuStats = usePlayerStore((s) => s.perGameStats.doudizhu);
  const sfxEnabled = usePlayerStore((s) => s.sfxEnabled);
  const voiceEnabled = usePlayerStore((s) => s.voiceEnabled);
  const toggleSfx = usePlayerStore((s) => s.toggleSfx);
  const toggleVoice = usePlayerStore((s) => s.toggleVoice);

  const springCount = useDoudizhuProfileStore((s) => s.springCount);
  const antiSpringCount = useDoudizhuProfileStore((s) => s.antiSpringCount);
  const difficulty = useDoudizhuProfileStore((s) => s.difficulty);
  const baseScore = useDoudizhuProfileStore((s) => s.baseScore);
  const recentMatches = useDoudizhuProfileStore((s) => s.recentMatches);
  const clearedPuzzles = useDoudizhuProfileStore((s) => s.clearedPuzzles);

  const setDifficulty = useDoudizhuProfileStore((s) => s.setDifficulty);
  const setBaseScore = useDoudizhuProfileStore((s) => s.setBaseScore);

  const startMatch = useDoudizhuGameStore((s) => s.startMatch);
  const openPuzzlesScreen = useDoudizhuGameStore((s) => s.openPuzzlesScreen);
  const openReplayScreen = useDoudizhuGameStore((s) => s.openReplayScreen);

  const tier = getRankTier(rankPoints);
  const totalMatches = doudizhuStats?.matches ?? 0;
  const wins = doudizhuStats?.wins ?? 0;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const springRate =
    totalMatches > 0 ? Math.round(((springCount + antiSpringCount) / totalMatches) * 100) : 0;

  return (
    <div className="casino-room-bg safe-area-pad min-h-[100dvh] w-full px-4 py-4 sm:py-6 md:px-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="hud-glass flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={onExitToLobby}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3.5 py-2 text-xs font-black text-amber-200 transition hover:bg-amber-500/25 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> 返回棋牌大厅
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-0.5 text-xs font-bold text-amber-300">
                <Sparkles className="h-3.5 w-3.5" /> 欢乐斗地主 · AI 实时教练专区
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-wide text-amber-50">
                欢乐斗地主 · 大师训练营
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSfx}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-white/10 cursor-pointer"
            >
              {sfxEnabled ? (
                <Volume2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-400" />
              )}
              音效
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-white/10 cursor-pointer"
            >
              {voiceEnabled ? (
                <MessageSquare className="h-4 w-4 text-emerald-300" />
              ) : (
                <MessageSquareOff className="h-4 w-4 text-slate-400" />
              )}
              中文配音
            </button>
            <FullscreenButton />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-amber-400/25 bg-emerald-950/75 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200/75">俱乐部段位</span>
              <Award className="h-5 w-5" style={{ color: tier.badgeColor }} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black" style={{ color: tier.badgeColor }}>
                {tier.name}
              </span>
              <span className="font-mono text-sm text-amber-100/80">{rankPoints} 积分</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                style={{ width: `${tier.progress}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-amber-400/25 bg-emerald-950/75 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200/75">通用金币 / 欢乐豆</span>
              <Coins className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-2 font-mono text-3xl font-black text-amber-300">
              {chips.toLocaleString()}
            </div>
            <div className="mt-2 text-xs text-emerald-200/70">
              低于 1,000 自动触发每日破产补助 (+3,000)
            </div>
          </div>

          <div className="rounded-3xl border border-amber-400/25 bg-emerald-950/75 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200/75">斗地主实战战绩</span>
              <Flame className="h-5 w-5 text-rose-400" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/30 py-2">
                <div className="font-mono text-lg font-black text-amber-100">{totalMatches}</div>
                <div className="text-[11px] text-emerald-200/70">总局数</div>
              </div>
              <div className="rounded-xl bg-black/30 py-2">
                <div className="font-mono text-lg font-black text-emerald-300">{winRate}%</div>
                <div className="text-[11px] text-emerald-200/70">胜率</div>
              </div>
              <div className="rounded-xl bg-black/30 py-2">
                <div className="font-mono text-lg font-black text-amber-300">{springRate}%</div>
                <div className="text-[11px] text-emerald-200/70">春天率</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-300/35 bg-black/35 p-6 shadow-2xl backdrop-blur-md">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black text-amber-200">
                <Brain className="h-4 w-4 text-amber-300" /> 选择 AI 对手强度
              </h2>
              <div className="mt-3 space-y-2.5">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = difficulty === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDifficulty(opt.id)}
                      className={`w-full rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                        active
                          ? 'border-amber-300 bg-amber-400/15 shadow-lg'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-amber-100">{opt.title}</span>
                        {active && (
                          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-emerald-950">
                            已选择
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-emerald-200/75">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-black text-amber-200">选择场次底分</h2>
                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  {ROOM_TIERS.map((room) => {
                    const active = baseScore === room.baseScore;
                    return (
                      <button
                        key={room.baseScore}
                        type="button"
                        onClick={() => setBaseScore(room.baseScore)}
                        className={`rounded-2xl border p-3 text-center transition cursor-pointer ${
                          active
                            ? 'border-amber-300 bg-amber-400/20 shadow-lg'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="text-xs font-bold text-emerald-200/80">{room.name}</div>
                        <div className="mt-1 font-mono text-lg font-black text-amber-300">
                          {room.baseScore}
                        </div>
                        <div className="text-[10px] text-emerald-200/60">底分</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={() => startMatch()}
                className="game-btn-gold mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-lg font-black cursor-pointer"
              >
                <Play className="h-5 w-5 fill-current" /> 开始对局 · 实战训练
              </motion.button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={openPuzzlesScreen}
            className="group rounded-3xl border border-emerald-400/35 bg-emerald-950/70 p-5 text-left transition hover:border-amber-300/60 hover:bg-emerald-900/70 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-black text-amber-200 group-hover:text-amber-300">
                <Puzzle className="h-5 w-5 text-emerald-300" /> 残局大师闯关
              </div>
              <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300">
                已通关 {clearedPuzzles.length} / 10
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-200/80">
              10 道经过 Alpha-Beta 引擎严格验证的经典斗地主残局（双王拆打、诱敌出炸、让牌控场、精确算张）。点击立即挑战 →
            </p>
          </button>

          <button
            type="button"
            onClick={() => openReplayScreen()}
            className="group rounded-3xl border border-amber-400/35 bg-emerald-950/70 p-5 text-left transition hover:border-amber-300/60 hover:bg-emerald-900/70 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-black text-amber-200 group-hover:text-amber-300">
                <History className="h-5 w-5 text-amber-300" /> 上帝视角牌谱复盘
              </div>
              <span className="rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-bold text-amber-300">
                已保存 {recentMatches.length} / 10 局
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-emerald-200/80">
              三家明牌复盘最近 10 局实战牌谱，高亮 1~3 处关键失误并支持“从此处重新开打”。点击查看 →
            </p>
          </button>
        </section>
      </div>
    </div>
  );
};

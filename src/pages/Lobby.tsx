import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  History,
  Layers,
  Lock,
  MessageSquare,
  MessageSquareOff,
  Play,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  AvatarStyleId,
  ChipBalancePill,
  PlayerAvatar,
  getRankTier,
  soundEngine,
  usePlayerStore,
} from '../shared';
import { GAME_REGISTRY, GameLaunchOptions, GameModuleMeta } from '../games';
import { useDoudizhuProfileStore } from '../games/doudizhu/store/doudizhuProfileStore';

interface LobbyProps {
  onLaunchGame: (gameId: string, options?: GameLaunchOptions) => void;
}

const AVATAR_CYCLE: AvatarStyleId[] = ['crown', 'spade', 'diamond', 'phoenix'];

const ACCENT_STYLES: Record<
  GameModuleMeta['accent'],
  { border: string; badge: string; glow: string }
> = {
  gold: {
    border: 'border-amber-400/45 hover:border-amber-300/80',
    badge: 'border-amber-300/50 bg-amber-400/15 text-amber-200',
    glow: 'from-amber-500/12 via-emerald-950/90 to-[#041811]',
  },
  crimson: {
    border: 'border-rose-400/25 hover:border-rose-300/45',
    badge: 'border-rose-400/35 bg-rose-500/15 text-rose-200',
    glow: 'from-rose-950/35 via-emerald-950/85 to-[#04150f]',
  },
  emerald: {
    border: 'border-emerald-400/25 hover:border-emerald-300/45',
    badge: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
    glow: 'from-emerald-900/35 via-emerald-950/85 to-[#04150f]',
  },
  sapphire: {
    border: 'border-sky-400/25 hover:border-sky-300/45',
    badge: 'border-sky-400/35 bg-sky-500/15 text-sky-200',
    glow: 'from-sky-950/35 via-emerald-950/85 to-[#04150f]',
  },
};

function renderAchievementIcon(icon: (typeof ACHIEVEMENTS)[number]['icon'], unlocked: boolean) {
  const cls = `h-4 w-4 ${unlocked ? 'text-amber-300' : 'text-slate-500'}`;
  switch (icon) {
    case 'trophy':
      return <Trophy className={cls} />;
    case 'flame':
      return <Flame className={cls} />;
    case 'coins':
      return <Coins className={cls} />;
    case 'crown':
      return <Crown className={cls} />;
    case 'sparkles':
      return <Sparkles className={cls} />;
    case 'puzzle':
      return <Puzzle className={cls} />;
  }
}

export const Lobby: React.FC<LobbyProps> = ({ onLaunchGame }) => {
  const nickname = usePlayerStore((s) => s.nickname);
  const avatarId = usePlayerStore((s) => s.avatarId);
  const chips = usePlayerStore((s) => s.chips);
  const lastChipDelta = usePlayerStore((s) => s.lastChipDelta);
  const rankPoints = usePlayerStore((s) => s.rankPoints);
  const totalMatches = usePlayerStore((s) => s.totalMatches);
  const totalWins = usePlayerStore((s) => s.totalWins);
  const bestStreak = usePlayerStore((s) => s.bestStreak);
  const perGameStats = usePlayerStore((s) => s.perGameStats);
  const unlockedAchievements = usePlayerStore((s) => s.unlockedAchievements);
  const sfxEnabled = usePlayerStore((s) => s.sfxEnabled);
  const voiceEnabled = usePlayerStore((s) => s.voiceEnabled);

  const setAvatarId = usePlayerStore((s) => s.setAvatarId);
  const checkBankruptcyAid = usePlayerStore((s) => s.checkBankruptcyAid);
  const toggleSfx = usePlayerStore((s) => s.toggleSfx);
  const toggleVoice = usePlayerStore((s) => s.toggleVoice);

  const clearedPuzzles = useDoudizhuProfileStore((s) => s.clearedPuzzles);
  const recentMatches = useDoudizhuProfileStore((s) => s.recentMatches);

  const [selectedStakes, setSelectedStakes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const game of GAME_REGISTRY) {
      if (game.stakes.length > 0) {
        const mid = game.stakes[Math.min(1, game.stakes.length - 1)];
        initial[game.id] = mid.baseBet;
      }
    }
    return initial;
  });

  const tier = getRankTier(rankPoints);
  const overallWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  const cycleAvatar = () => {
    soundEngine.playSelect();
    const idx = AVATAR_CYCLE.indexOf(avatarId);
    const next = AVATAR_CYCLE[(idx + 1) % AVATAR_CYCLE.length];
    setAvatarId(next);
  };

  return (
    <div className="club-bg min-h-screen w-full px-4 py-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Club Brand & Global Audio Header */}
        <header className="gold-card-border flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-black/45 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-400/25 via-amber-500/10 to-emerald-950 shadow-inner">
              <Crown className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-300">
                <Sparkles className="h-3 w-3" /> POKER MASTER SUITE · 插件化棋牌俱乐部
              </div>
              <h1 className="gold-shimmer-text mt-1 text-2xl md:text-3xl font-black tracking-wide">
                皇家棋牌大师会所
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ChipBalancePill chips={chips} lastDelta={lastChipDelta} label="通用资产" />
            <button
              type="button"
              onClick={toggleSfx}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-white/10 cursor-pointer"
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
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-amber-100 transition hover:bg-white/10 cursor-pointer"
            >
              {voiceEnabled ? (
                <MessageSquare className="h-4 w-4 text-emerald-300" />
              ) : (
                <MessageSquareOff className="h-4 w-4 text-slate-400" />
              )}
              语音播报
            </button>
          </div>
        </header>

        {/* VIP Player Strip: Avatar + Rank, Universal Chips + Aid, Win Rate */}
        <section className="grid gap-4 md:grid-cols-3">
          {/* Player Profile & Rank */}
          <div className="gold-card-border rounded-3xl border bg-gradient-to-br from-emerald-950/90 to-[#041710] p-5 backdrop-blur">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={cycleAvatar}
                title="点击切换 VIP 俱乐部头像徽章"
                className="group relative cursor-pointer rounded-full transition hover:scale-105"
              >
                <PlayerAvatar avatarId={avatarId} size="lg" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/60 bg-emerald-950 px-1.5 py-0.2 text-[9px] font-bold text-amber-200 opacity-90 group-hover:opacity-100">
                  换徽章
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-base font-black text-amber-50">{nickname}</span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black"
                    style={{
                      color: tier.badgeColor,
                      borderColor: `${tier.badgeColor}66`,
                      backgroundColor: `${tier.badgeColor}18`,
                    }}
                  >
                    <Award className="h-3 w-3" /> {tier.name}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-emerald-200/75">
                  <span className="font-mono font-bold text-amber-200">{rankPoints} 俱乐部积分</span>
                  <span>
                    {tier.nextPoints
                      ? `升级还需 ${tier.nextPoints - rankPoints}`
                      : '已登顶最高段位'}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/45">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-yellow-200 transition-all"
                    style={{ width: `${tier.progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Universal Chips / Gold Balance & Bankruptcy Aid */}
          <div className="gold-card-border flex flex-col justify-between rounded-3xl border bg-gradient-to-br from-emerald-950/90 to-[#041710] p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200/80">通用金币 / 筹码余额</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <ShieldCheck className="h-3 w-3" /> 全大厅通用
              </span>
            </div>

            <div className="my-2 flex items-baseline justify-between gap-3">
              <div className="font-mono text-3xl font-black tracking-tight text-amber-300">
                {chips.toLocaleString()}
              </div>
              {chips < 1000 && (
                <button
                  type="button"
                  onClick={() => checkBankruptcyAid()}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-1.5 text-xs font-black text-emerald-950 shadow cursor-pointer hover:brightness-105"
                >
                  领取破产补助 +3,000
                </button>
              )}
            </div>

            <div className="text-xs text-emerald-200/70">
              余额低于 1,000 自动触发每日破产补助 (+3,000)，畅玩所有已接入牌桌
            </div>
          </div>

          {/* Overall Win Rate & Streak */}
          <div className="gold-card-border flex flex-col justify-between rounded-3xl border bg-gradient-to-br from-emerald-950/90 to-[#041710] p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200/80">俱乐部总战绩</span>
              <span className="text-[11px] font-bold text-amber-200/80">
                成就 {unlockedAchievements.length}/{ACHIEVEMENTS.length}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/5 bg-black/35 py-2.5">
                <div className="font-mono text-xl font-black text-amber-100">{totalMatches}</div>
                <div className="text-[11px] text-emerald-200/70">总对局</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/35 py-2.5">
                <div className="font-mono text-xl font-black text-emerald-300">
                  {overallWinRate}%
                </div>
                <div className="text-[11px] text-emerald-200/70">总胜率</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/35 py-2.5">
                <div className="font-mono text-xl font-black text-amber-300">{bestStreak}</div>
                <div className="text-[11px] text-emerald-200/70">最高连胜</div>
              </div>
            </div>
          </div>
        </section>

        {/* Central Games Matrix */}
        <section className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black text-amber-100">
                <Layers className="h-5 w-5 text-amber-300" /> 玩法大厅 · 牌桌矩阵
              </h2>
              <p className="text-xs text-emerald-200/70">
                统一扑克渲染引擎、AI 复盘时间轴与通用资产池，新玩法在{' '}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-amber-200">
                  src/games/registry.ts
                </code>{' '}
                注册即可上线
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-200">
              已上线 {GAME_REGISTRY.filter((g) => g.status === 'available').length} 款 · 筹备中{' '}
              {GAME_REGISTRY.filter((g) => g.status === 'coming_soon').length} 款
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {GAME_REGISTRY.map((game, index) => {
              const style = ACCENT_STYLES[game.accent];
              const isAvailable = game.status === 'available';
              const activeStake = selectedStakes[game.id] ?? game.stakes[0]?.baseBet ?? 100;
              const stats = perGameStats[game.id];
              const gameWinRate =
                stats && stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : null;

              return (
                <motion.article
                  key={game.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-br ${style.glow} ${style.border} p-6 shadow-2xl backdrop-blur-md transition`}
                >
                  {/* Decorative Corner Suit Watermark */}
                  <div className="pointer-events-none absolute -right-4 -top-4 text-7xl font-black text-amber-300/[0.04] select-none">
                    {game.accent === 'gold'
                      ? '♠'
                      : game.accent === 'crimson'
                        ? '♥'
                        : game.accent === 'emerald'
                          ? '♣'
                          : '♦'}
                  </div>

                  <div>
                    {/* Top Row: Badges & Difficulty */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider ${style.badge}`}
                        >
                          {game.englishName}
                        </span>
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> 已上线 · 可立即开局
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                            <Lock className="h-3 w-3" /> 插件槽位就绪 · 即将上线
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-amber-300">
                        <span className="text-[11px] font-bold text-amber-200/80">
                          {game.difficulty}
                        </span>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, sIdx) => (
                            <Star
                              key={sIdx}
                              className={`h-3 w-3 ${
                                sIdx < game.difficultyStars ? 'fill-amber-300' : 'opacity-25'
                              }`}
                            />
                          ))}
                        </span>
                      </div>
                    </div>

                    {/* Title & Subtitle */}
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-2xl font-black text-amber-50">{game.name}</h3>
                      {gameWinRate !== null && (
                        <span className="rounded-lg bg-black/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                          战绩 {stats.matches} 局 · 胜率 {gameWinRate}%
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-bold text-amber-300/90">{game.subtitle}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-emerald-100/80">
                      {game.description}
                    </p>

                    {/* Core Training Pitch & Specs */}
                    <div className="mt-3.5 rounded-2xl border border-amber-400/20 bg-black/35 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-black text-amber-300">核心练牌卖点</span>
                        <span className="flex items-center gap-2 text-emerald-200/75">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {game.playerCount}
                          </span>
                          <span>· {game.deckInfo}</span>
                        </span>
                      </div>
                      <div className="mt-1 font-bold text-amber-50">{game.trainingPitch}</div>
                    </div>

                    {/* Feature Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {game.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-emerald-100/85"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Stakes Tier Selector */}
                    <div className="mt-4">
                      <div className="mb-1.5 text-[11px] font-bold text-emerald-200/70">
                        底注场次配置
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {game.stakes.map((stake) => {
                          const selected = activeStake === stake.baseBet;
                          return (
                            <button
                              key={stake.id}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() =>
                                setSelectedStakes((prev) => ({
                                  ...prev,
                                  [game.id]: stake.baseBet,
                                }))
                              }
                              className={`rounded-xl border px-2.5 py-2 text-center transition ${
                                !isAvailable
                                  ? 'border-white/10 bg-white/5 opacity-60 cursor-not-allowed'
                                  : selected
                                    ? 'border-amber-300 bg-amber-400/20 shadow cursor-pointer'
                                    : 'border-white/10 bg-black/30 hover:bg-white/10 cursor-pointer'
                              }`}
                            >
                              <div className="text-[11px] font-bold text-emerald-100">
                                {stake.name}
                              </div>
                              <div className="font-mono text-sm font-black text-amber-300">
                                {stake.baseBet}
                              </div>
                              <div className="text-[10px] text-emerald-200/60">
                                {stake.tag ?? `底注 ${stake.baseBet}`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer CTA */}
                  <div className="mt-5 pt-4 border-t border-white/10">
                    {isAvailable ? (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-2.5">
                          <motion.button
                            whileHover={{ scale: 1.015 }}
                            whileTap={{ scale: 0.985 }}
                            type="button"
                            onClick={() =>
                              onLaunchGame(game.id, {
                                initialView: 'table',
                                initialStake: activeStake,
                              })
                            }
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-4 py-3 text-sm font-black text-emerald-950 shadow-[0_10px_25px_rgba(245,158,11,0.3)] transition hover:brightness-105 cursor-pointer"
                          >
                            <Play className="h-4 w-4 fill-current" /> 立即入座开打 (底分{' '}
                            {activeStake})
                          </motion.button>
                          <button
                            type="button"
                            onClick={() => onLaunchGame(game.id, { initialView: 'hub' })}
                            className="flex items-center justify-center gap-1 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-xs font-black text-amber-200 transition hover:bg-amber-400/20 cursor-pointer"
                          >
                            进入专区 <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        {game.id === 'doudizhu' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => onLaunchGame(game.id, { initialView: 'puzzles' })}
                              className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/20 cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Puzzle className="h-3.5 w-3.5 text-emerald-300" /> 残局大师闯关
                              </span>
                              <span className="font-mono text-[11px] text-emerald-300">
                                {clearedPuzzles.length}/10
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onLaunchGame(game.id, { initialView: 'replay' })}
                              className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5 text-amber-300" /> 上帝视角复盘
                              </span>
                              <span className="font-mono text-[11px] text-amber-300">
                                {recentMatches.length}/10
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-300">
                        <span>引擎接口与牌桌基础设施已就绪</span>
                        <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-amber-200/80">
                          敬请期待
                        </span>
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* Club Achievements Bar */}
        <section className="gold-card-border rounded-3xl border bg-black/35 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black text-amber-200">
              <Trophy className="h-4 w-4 text-amber-300" /> 俱乐部荣誉勋章墙
            </h2>
            <span className="text-xs text-emerald-200/70">
              跨玩法累计解锁 · 持久化保存在本地档案
            </span>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = unlockedAchievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                    unlocked
                      ? 'border-amber-400/45 bg-amber-400/10'
                      : 'border-white/10 bg-white/[0.03] opacity-65'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      unlocked
                        ? 'border-amber-300/60 bg-amber-400/20'
                        : 'border-white/10 bg-black/30'
                    }`}
                  >
                    {renderAchievementIcon(ach.icon, unlocked)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-black ${
                          unlocked ? 'text-amber-100' : 'text-slate-300'
                        }`}
                      >
                        {ach.title}
                      </span>
                      {unlocked && (
                        <span className="rounded bg-emerald-500/25 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300">
                          已达成
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-emerald-200/70">{ach.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

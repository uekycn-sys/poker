import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  History,
  Megaphone,
  MicOff,
  Play,
  Puzzle,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  AvatarStyleId,
  ChipBalancePill,
  ChipStack,
  FullscreenButton,
  PlayerAvatar,
  PlayingCard,
  getRankTier,
  soundEngine,
  usePlayerStore,
} from '../shared';
import { GAME_REGISTRY, GameLaunchOptions, GameModuleMeta } from '../games';
import { useDoudizhuProfileStore } from '../games/doudizhu/store/doudizhuProfileStore';
import { useHoldemProfileStore } from '../games/texas-holdem/store/holdemProfileStore';

interface LobbyProps {
  onLaunchGame: (gameId: string, options?: GameLaunchOptions) => void;
}

const AVATAR_CYCLE: AvatarStyleId[] = ['crown', 'spade', 'diamond', 'phoenix'];

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

function DoudizhuCardDiorama() {
  return (
    <div className="relative flex h-16 sm:h-28 md:h-36 short-h:h-16 w-full items-center justify-center overflow-hidden rounded-2xl border border-amber-300/25 bg-[radial-gradient(ellipse_at_50%_40%,rgba(16,122,78,0.65),rgba(4,24,16,0.92))] px-4 shadow-inner">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(251,191,36,0.18),transparent_65%)]" />

      <div className="short-h-mini-cards relative flex items-center justify-center -space-x-4 sm:-space-x-3 pt-1 sm:pt-2">
        <div className="-rotate-12 translate-y-1.5 opacity-90 drop-shadow-xl">
          <PlayingCard card={{ id: 'demo-sj', suit: 'joker', rank: 16 }} size="sm" />
        </div>
        <div className="-rotate-3 -translate-y-0.5 z-10 drop-shadow-2xl">
          <PlayingCard card={{ id: 'demo-bj', suit: 'joker', rank: 17 }} size="md" />
        </div>
        <div className="rotate-6 translate-y-0.5 z-20 drop-shadow-2xl">
          <PlayingCard card={{ id: 'demo-2s', suit: 'spades', rank: 15 }} size="md" />
        </div>
        <div className="rotate-14 translate-y-2 opacity-90 z-10 drop-shadow-xl">
          <PlayingCard card={{ id: 'demo-ah', suit: 'hearts', rank: 14 }} size="sm" />
        </div>
      </div>

      <div className="short-h-hide absolute right-3 bottom-2.5 flex items-center gap-1.5 rounded-full border border-amber-300/55 bg-black/65 px-2.5 py-1 shadow-lg backdrop-blur-sm">
        <Crown className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[10px] font-black tracking-wide text-amber-200">叫抢翻倍 · 春天算杀</span>
      </div>
    </div>
  );
}

function HoldemCardDiorama() {
  return (
    <div className="relative flex h-16 sm:h-28 md:h-36 short-h:h-16 w-full items-center justify-center overflow-hidden rounded-2xl border border-rose-300/25 bg-[radial-gradient(ellipse_at_50%_40%,rgba(127,29,29,0.52),rgba(8,24,18,0.94))] px-4 shadow-inner">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(244,63,94,0.16),transparent_65%)]" />

      <div className="short-h-mini-cards relative flex items-center gap-4 sm:gap-6">
        <div className="flex items-center -space-x-3 pt-1">
          <div className="-rotate-10 translate-y-1 drop-shadow-2xl">
            <PlayingCard card={{ id: 'demo-as', suit: 'spades', rank: 14 }} size="md" />
          </div>
          <div className="rotate-8 -translate-y-0.5 z-10 drop-shadow-2xl">
            <PlayingCard card={{ id: 'demo-ah2', suit: 'hearts', rank: 14 }} size="md" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 border-amber-100 bg-gradient-to-br from-amber-300 to-amber-500 text-[10px] sm:text-xs font-black text-emerald-950 shadow-lg">
            D
          </div>
          <ChipStack amount={10000} compact />
        </div>
      </div>

      <div className="short-h-hide absolute right-3 bottom-2.5 flex items-center gap-1.5 rounded-full border border-rose-300/45 bg-black/65 px-2.5 py-1 shadow-lg backdrop-blur-sm">
        <Sparkles className="h-3.5 w-3.5 text-rose-300" />
        <span className="text-[10px] font-black tracking-wide text-rose-100">6人无限注 · GTO 教练</span>
      </div>
    </div>
  );
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
  const largeCardFont = usePlayerStore((s) => s.largeCardFont);

  const setAvatarId = usePlayerStore((s) => s.setAvatarId);
  const checkBankruptcyAid = usePlayerStore((s) => s.checkBankruptcyAid);
  const toggleSfx = usePlayerStore((s) => s.toggleSfx);
  const toggleVoice = usePlayerStore((s) => s.toggleVoice);
  const toggleLargeCardFont = usePlayerStore((s) => s.toggleLargeCardFont);

  const clearedPuzzles = useDoudizhuProfileStore((s) => s.clearedPuzzles);
  const recentMatches = useDoudizhuProfileStore((s) => s.recentMatches);
  const holdemTrainingPoints = useHoldemProfileStore((s) => s.trainingPoints);
  const holdemRecentHands = useHoldemProfileStore((s) => s.recentHands);

  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

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
    <div className="casino-room-bg safe-area-pad flex h-full w-full flex-col overflow-y-auto sm:overflow-hidden forced-l:overflow-hidden">
      <div className="pointer-events-none fixed inset-2 rounded-3xl border border-amber-400/15" />

      {/* Top Game Hall HUD Bar */}
      <header className="short-h-compact relative z-20 mx-auto flex w-full max-w-[1440px] shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-2.5">
        {/* Player Profile Capsule */}
        <div className="hud-glass flex items-center gap-2 rounded-2xl px-2.5 py-1 sm:px-3.5 sm:py-1.5">
          <button
            type="button"
            onClick={cycleAvatar}
            title="点击切换 VIP 徽章"
            className="group relative cursor-pointer rounded-full transition hover:scale-105"
          >
            <PlayerAvatar avatarId={avatarId} size="sm" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs sm:text-sm font-black text-amber-50">{nickname}</span>
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.2 text-[10px] font-black"
                style={{
                  color: tier.badgeColor,
                  borderColor: `${tier.badgeColor}66`,
                  backgroundColor: `${tier.badgeColor}1a`,
                }}
              >
                <Award className="h-2.5 w-2.5" /> {tier.name}
              </span>
            </div>
            <div className="short-h-hide mt-0.5 flex items-center gap-2">
              <div className="h-1.5 w-16 sm:w-24 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200"
                  style={{ width: `${tier.progress}%` }}
                />
              </div>
              <span className="font-mono text-[10px] font-bold text-amber-200/85">
                {rankPoints}分
              </span>
            </div>
          </div>
        </div>

        {/* Center Brand Title */}
        <div className="hidden lg:flex flex-col items-center">
          <div className="gold-foil-text text-xl font-black tracking-[0.16em]">
            皇家棋牌大师会所
          </div>
          <div className="short-h-hide text-[10px] font-bold tracking-[0.28em] text-amber-300/60 uppercase">
            ROYAL POKER MASTER CLUB
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ChipBalancePill chips={chips} lastDelta={lastChipDelta} compact />

          {chips < 1000 && (
            <button
              type="button"
              onClick={() => checkBankruptcyAid()}
              className="game-btn-gold whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[11px] font-black cursor-pointer"
            >
              补助 +3,000
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAchievementsModal(true)}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-amber-400/35 bg-black/45 px-2.5 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-400/15 cursor-pointer"
            title="俱乐部荣誉勋章"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span className="short-h-hide hidden md:inline">勋章</span>
            <span className="font-mono text-[10px] text-amber-300">
              {unlockedAchievements.length}/{ACHIEVEMENTS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleSfx}
            aria-label="音效开关"
            title="音效开关"
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-white/10 cursor-pointer"
          >
            {sfxEnabled ? (
              <Volume2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" />
            )}
            <span className="hidden sm:inline forced-l:inline">音效</span>
          </button>

          <button
            type="button"
            onClick={toggleVoice}
            aria-label="语音开关"
            title="语音播报开关"
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-white/10 cursor-pointer"
          >
            {voiceEnabled ? (
              <Megaphone className="h-4 w-4 text-emerald-300" />
            ) : (
              <MicOff className="h-4 w-4 text-slate-400" />
            )}
            <span className="hidden sm:inline forced-l:inline">语音</span>
          </button>

          <button
            type="button"
            onClick={toggleLargeCardFont}
            aria-label="大字模式"
            title="适老大字清晰模式"
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              largeCardFont
                ? 'border-amber-300/70 bg-amber-400/20 text-amber-200'
                : 'border-white/15 bg-black/45 text-amber-100 hover:bg-white/10'
            }`}
          >
            <ZoomIn className="h-4 w-4 text-amber-300" />
            <span className="hidden sm:inline forced-l:inline">大字</span>
          </button>

          <FullscreenButton showLabel />
        </div>
      </header>

      {/* Center Stage: Two Grand Commercial Game Banner Cards */}
      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1360px] flex-1 items-center px-3 py-1 sm:px-6 sm:py-2 short-h:py-0.5">
        <div className="grid h-full w-full grid-cols-1 gap-3 sm:grid-cols-2 forced-l:grid-cols-2 sm:gap-4 md:gap-5 items-stretch max-h-[660px]">
          {GAME_REGISTRY.map((game: GameModuleMeta, index: number) => {
            const isDoudizhu = game.id === 'doudizhu';
            const activeStake = selectedStakes[game.id] ?? game.stakes[0]?.baseBet ?? 100;
            const stats = perGameStats[game.id];
            const gameWinRate =
              stats && stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : null;

            const cardFrameClass = isDoudizhu
              ? 'border-amber-400/50 bg-gradient-to-b from-[#0f4531]/95 via-[#07261b]/95 to-[#03130d]/98 hover:border-amber-300/85'
              : 'border-rose-400/45 bg-gradient-to-b from-[#2f1019]/95 via-[#0c231c]/95 to-[#04120d]/98 hover:border-rose-300/80';

            return (
              <motion.article
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className={`card-sheen relative flex min-h-0 flex-col justify-between overflow-hidden rounded-3xl border-2 ${cardFrameClass} p-3 sm:p-4 md:p-5 short-h:p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,240,180,0.2)] backdrop-blur-md transition`}
              >
                {/* Top Card Header & Diorama */}
                <div className="flex flex-col gap-1.5 sm:gap-2.5 short-h:gap-1">
                  <div className="flex items-center justify-between gap-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-black tracking-wider ${
                          isDoudizhu
                            ? 'border-amber-300/60 bg-amber-400/15 text-amber-200'
                            : 'border-rose-300/55 bg-rose-500/15 text-rose-200'
                        }`}
                      >
                        {game.englishName}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-200/80">
                        <Users className="h-3 w-3" /> {game.playerCount}
                      </span>
                    </div>

                    {gameWinRate !== null ? (
                      <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                        {stats.matches}局 · {gameWinRate}%
                      </span>
                    ) : (
                      <span className="short-h-hide shrink-0 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[10px] font-bold text-amber-200/75">
                        {game.deckInfo}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="gold-foil-text whitespace-nowrap text-lg sm:text-2xl md:text-3xl short-h:text-lg font-black tracking-wide">
                      {isDoudizhu ? '欢乐斗地主' : '德州扑克 GTO'}
                    </h2>
                    <span className="short-h-hide truncate text-[11px] font-bold text-amber-200/80">
                      {game.trainingPitch}
                    </span>
                  </div>

                  {isDoudizhu ? <DoudizhuCardDiorama /> : <HoldemCardDiorama />}
                </div>

                {/* Middle: Stake Tier Selector */}
                <div className="my-1.5 sm:my-2.5 short-h:my-1">
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {game.stakes.map((stake) => {
                      const selected = activeStake === stake.baseBet;
                      return (
                        <button
                          key={stake.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playSelect();
                            setSelectedStakes((prev) => ({
                              ...prev,
                              [game.id]: stake.baseBet,
                            }));
                          }}
                          className={`rounded-xl border px-1.5 py-1 sm:px-2 sm:py-1.5 short-h:py-0.5 text-center transition cursor-pointer ${
                            selected
                              ? 'border-amber-300 bg-amber-400/22 shadow-[0_0_16px_rgba(251,191,36,0.22)]'
                              : 'border-white/10 bg-black/35 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-emerald-100/90">
                            {stake.name}
                          </div>
                          <div className="font-mono text-xs sm:text-base short-h:text-xs font-black text-amber-300">
                            {isDoudizhu ? stake.baseBet : `${stake.baseBet / 2}/${stake.baseBet}`}
                          </div>
                          <div className="short-h-hide text-[9px] text-emerald-200/60">
                            {stake.tag ?? `底注 ${stake.baseBet}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom: Glossy 3D CTA + Quick Mode Strip */}
                <div className="space-y-1.5 sm:space-y-2 border-t border-white/10 pt-2 sm:pt-2.5 short-h:pt-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onLaunchGame(game.id, {
                          initialView: 'table',
                          initialStake: activeStake,
                        })
                      }
                      className={`${
                        isDoudizhu ? 'game-btn-gold' : 'game-btn-crimson'
                      } flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2 sm:py-2.5 short-h:py-1.5 text-xs sm:text-sm md:text-base font-black cursor-pointer`}
                    >
                      <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                      {isDoudizhu
                        ? `立即开局 · 底分 ${activeStake}`
                        : `立即入座 · 盲注 ${activeStake / 2}/${activeStake}`}
                    </button>

                    <button
                      type="button"
                      onClick={() => onLaunchGame(game.id, { initialView: 'hub' })}
                      className="flex shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-2xl border border-amber-300/40 bg-black/45 px-2.5 sm:px-3.5 py-2 sm:py-2.5 short-h:py-1.5 text-[11px] sm:text-xs font-black text-amber-200 transition hover:bg-amber-400/15 cursor-pointer"
                    >
                      专区 <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isDoudizhu ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => onLaunchGame(game.id, { initialView: 'puzzles' })}
                        className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <Puzzle className="h-3 w-3 text-emerald-300" /> 残局闯关
                        </span>
                        <span className="font-mono text-emerald-300">
                          {clearedPuzzles.length}/10
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLaunchGame(game.id, { initialView: 'replay' })}
                        className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3 text-amber-300" /> 上帝复盘
                        </span>
                        <span className="font-mono text-amber-300">
                          {recentMatches.length}/10
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onLaunchGame(game.id, {
                            initialView: 'quiz',
                            initialStake: activeStake,
                          })
                        }
                        className="flex items-center justify-between rounded-xl border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-sky-200 transition hover:bg-sky-500/20 cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-sky-300" /> Outs 盲测
                        </span>
                        <span className="font-mono text-sky-300">{holdemTrainingPoints}分</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLaunchGame(game.id, { initialView: 'replay' })}
                        className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/20 cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3 text-amber-300" /> EV 复盘
                        </span>
                        <span className="font-mono text-amber-300">
                          {holdemRecentHands.length}/12
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </main>

      {/* Compact Club Bottom Status Strip */}
      <footer className="short-h-hide relative z-20 mx-auto flex w-full max-w-[1440px] shrink-0 items-center justify-between px-4 py-2 text-xs sm:px-6">
        <div className="hud-glass flex items-center gap-4 rounded-full px-4 py-1 text-[11px]">
          <span className="text-emerald-200/75">
            总对局 <strong className="font-mono text-amber-100">{totalMatches}</strong>
          </span>
          <span className="text-emerald-200/75">
            总胜率 <strong className="font-mono text-emerald-300">{overallWinRate}%</strong>
          </span>
          <span className="text-emerald-200/75">
            最高连胜 <strong className="font-mono text-amber-300">{bestStreak}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowAchievementsModal(true)}
          className="hud-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold text-amber-200 hover:border-amber-300/70 cursor-pointer"
        >
          <Trophy className="h-3.5 w-3.5 text-amber-300" /> 荣誉勋章墙 ({unlockedAchievements.length}/
          {ACHIEVEMENTS.length})
        </button>
      </footer>

      {/* Achievements Modal */}
      <AnimatePresence>
        {showAchievementsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              className="hud-glass max-h-[94%] w-full max-w-2xl overflow-y-auto rounded-3xl p-4 sm:p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-300" />
                  <h2 className="text-base font-black text-amber-100">
                    俱乐部荣誉勋章 ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAchievementsModal(false)}
                  aria-label="关闭勋章墙"
                  className="rounded-xl border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/15 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
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
                        <p className="text-[11px] text-emerald-200/70">{ach.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

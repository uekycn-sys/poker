import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Coins, Home, Play, Puzzle, Star } from 'lucide-react';
import { ENDGAME_PUZZLES } from '../engine';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';
import { RoleBadge } from './RoleIcons';

interface PuzzleLobbyProps {
  onExitToLobby: () => void;
}

export const PuzzleLobby: React.FC<PuzzleLobbyProps> = ({ onExitToLobby }) => {
  const clearedPuzzles = useDoudizhuProfileStore((s) => s.clearedPuzzles);
  const returnToHub = useDoudizhuGameStore((s) => s.returnToHub);
  const startPuzzle = useDoudizhuGameStore((s) => s.startPuzzle);

  return (
    <div className="felt-table safe-area-pad h-full w-full overflow-y-auto overflow-x-hidden px-3 py-2.5 md:px-8 md:py-6 short-h:px-3 short-h:py-2">
      <div className="mx-auto max-w-5xl space-y-4 short-h:space-y-2.5">
        <header className="flex items-center justify-between gap-2 rounded-2xl sm:rounded-3xl border border-amber-400/30 bg-black/35 px-4 py-3 sm:px-6 sm:py-4 short-h:px-3 short-h:py-1.5 backdrop-blur-md shadow-2xl">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onExitToLobby}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 sm:px-3 sm:py-2 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-bold text-amber-200 hover:bg-amber-500/20 cursor-pointer whitespace-nowrap"
            >
              <Home className="h-4 w-4 short-h:h-3.5 short-h:w-3.5" /> 棋牌大厅
            </button>
            <button
              type="button"
              onClick={returnToHub}
              className="flex shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 sm:px-3 sm:py-2 short-h:px-2 short-h:py-1 text-xs short-h:text-[11px] font-bold text-amber-100 hover:bg-white/10 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4 short-h:h-3.5 short-h:w-3.5" /> 斗地主专区
            </button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-1.5 truncate text-base sm:text-xl md:text-2xl short-h:text-sm font-black text-amber-50 whitespace-nowrap">
                <Puzzle className="h-5 w-5 sm:h-6 sm:w-6 short-h:h-4 short-h:w-4 shrink-0 text-emerald-300" /> 残局大师训练营
              </h1>
              <p className="short-h-hide text-xs text-emerald-200/75">
                10 道经 Alpha-Beta 算杀引擎严格验证的必胜残局（三家明牌推演）
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl short-h:rounded-xl border border-amber-300/35 bg-amber-400/15 px-3 py-1.5 sm:px-4 sm:py-2 short-h:px-2.5 short-h:py-1 text-xs short-h:text-[11px] font-black text-amber-200 whitespace-nowrap">
            通关进度：{clearedPuzzles.length} / {ENDGAME_PUZZLES.length}
          </div>
        </header>

        <div className="grid gap-3 short-h:gap-2.5 grid-cols-1 sm:grid-cols-2 forced-l:grid-cols-2 short-h:grid-cols-2 lg:grid-cols-3">
          {ENDGAME_PUZZLES.map((puzzle, idx) => {
            const cleared = clearedPuzzles.includes(puzzle.id);
            return (
              <motion.div
                key={puzzle.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex flex-col justify-between rounded-3xl short-h:rounded-2xl border p-4 sm:p-5 short-h:p-3 shadow-xl backdrop-blur ${
                  cleared
                    ? 'border-emerald-400/45 bg-emerald-950/80'
                    : 'border-amber-400/25 bg-black/35'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded-lg bg-amber-400/20 px-2 py-0.5 font-mono text-xs short-h:text-[11px] font-black text-amber-300">
                        #{String(puzzle.number).padStart(2, '0')}
                      </span>
                      <h2 className="truncate text-base short-h:text-sm font-black text-amber-50">{puzzle.title}</h2>
                    </div>

                    {cleared ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] short-h:text-[10px] font-bold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 已通关
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] short-h:text-[10px] font-bold text-amber-300">
                        <Coins className="h-3 w-3" /> +{puzzle.rewardBeans}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 short-h:mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <RoleBadge role={puzzle.landlordSeat === 0 ? 'landlord' : 'farmer'} size="sm" />
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-emerald-100">
                      {puzzle.tag}
                    </span>
                    <span className="flex items-center gap-0.5 text-amber-300">
                      {Array.from({ length: 5 }).map((_, sIdx) => (
                        <Star
                          key={sIdx}
                          className={`h-3 w-3 ${
                            sIdx < puzzle.difficultyStars ? 'fill-amber-300' : 'opacity-25'
                          }`}
                        />
                      ))}
                    </span>
                  </div>

                  <p className="mt-2.5 short-h:mt-1.5 text-xs short-h:text-[11px] short-h:line-clamp-2 leading-relaxed text-emerald-100/80">
                    {puzzle.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => startPuzzle(puzzle)}
                  className="mt-4 short-h:mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl short-h:rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 short-h:py-1.5 text-sm short-h:text-xs font-black text-emerald-950 shadow-lg transition hover:brightness-105 cursor-pointer"
                >
                  <Play className="h-4 w-4 short-h:h-3.5 short-h:w-3.5 fill-current" /> {cleared ? '再次挑战' : '进入挑战'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

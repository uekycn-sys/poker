import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpCircle, Check, Coins, FastForward, History, Play, XCircle, Zap } from 'lucide-react';
import { isTextInputFocused } from '../../../shared/hooks/keyboard';
import { getLegalActions } from '../engine/rules';
import { HandState, PlayerAction } from '../engine/types';
import { formatChipsOrBb } from '../utils/formatChips';

interface ActionControlBarProps {
  handState: HandState;
  isHeroTurn: boolean;
  displayInBb: boolean;
  shortcutsDisabled?: boolean;
  onAction: (action: PlayerAction) => void;
  onNextHand: () => void;
  onOpenReview: () => void;
  onFastForward: () => void;
  isFastForwarding: boolean;
}

export const ActionControlBar: React.FC<ActionControlBarProps> = ({
  handState,
  isHeroTurn,
  displayInBb,
  shortcutsDisabled = false,
  onAction,
  onNextHand,
  onOpenReview,
  onFastForward,
  isFastForwarding,
}) => {
  const hero = handState.players.find((p) => p.seat === 0);
  const legal = useMemo(
    () => getLegalActions(handState, 0),
    [handState],
  );

  const [raiseTo, setRaiseTo] = useState<number>(legal.minRaiseTo);

  useEffect(() => {
    setRaiseTo(legal.minRaiseTo);
  }, [legal.minRaiseTo, handState.street, handState.currentBet, handState.activeSeat]);

  useEffect(() => {
    if (!isHeroTurn || handState.isHandOver || shortcutsDisabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isTextInputFocused(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === 'f' && legal.canFold) {
        e.preventDefault();
        onAction({ type: 'fold' });
      } else if (key === 'c') {
        if (legal.canCheck) {
          e.preventDefault();
          onAction({ type: 'check' });
        } else if (legal.canCall) {
          e.preventDefault();
          onAction({ type: 'call' });
        }
      } else if (key === 'r') {
        if (legal.canRaise) {
          e.preventDefault();
          const amount = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, raiseTo));
          onAction(
            amount >= legal.maxRaiseTo
              ? { type: 'all_in' }
              : { type: 'raise', amount },
          );
        } else if (legal.canAllIn && legal.isReopened) {
          e.preventDefault();
          onAction({ type: 'all_in' });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handState.isHandOver, isHeroTurn, legal, onAction, raiseTo, shortcutsDisabled]);

  const computePotShortcut = (fraction: number): number => {
    const potBase = handState.pot + legal.callAmount;
    const raw = handState.currentBet + Math.round(potBase * fraction);
    const step = Math.max(1, handState.smallBlind);
    const snapped = Math.round(raw / step) * step;
    return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, snapped));
  };

  if (handState.isHandOver) {
    return (
      <div className="hud-glass flex flex-wrap items-center justify-center gap-2.5 rounded-2xl px-4 py-2 shadow-2xl">
        <button
          type="button"
          onClick={onOpenReview}
          className="game-btn-sky inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-black cursor-pointer"
        >
          <History className="h-4 w-4" /> 局后 EV 复盘与重打
        </button>
        <button
          type="button"
          onClick={onNextHand}
          className="game-btn-gold inline-flex items-center gap-1.5 rounded-xl px-5 sm:px-6 py-2 text-xs sm:text-sm font-black cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current" /> 发下一手牌
        </button>
      </div>
    );
  }

  if (!isHeroTurn) {
    const activePlayer = handState.players.find((p) => p.seat === handState.activeSeat);
    const heroFolded = hero?.folded ?? false;

    return (
      <div className="hud-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2">
        <div className="text-xs font-bold text-emerald-200/90">
          {heroFolded
            ? '你已弃牌观战，AI 正在进行剩余街行动...'
            : `等待 ${activePlayer?.name ?? '对手'} (${activePlayer?.position ?? ''}) 思考行动...`}
        </div>
        {heroFolded && !isFastForwarding && (
          <button
            type="button"
            onClick={onFastForward}
            className="game-btn-gold inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black cursor-pointer"
          >
            <FastForward className="h-3.5 w-3.5" /> 快进本局
          </button>
        )}
      </div>
    );
  }

  const shortcuts = [
    { label: '1/3池', value: computePotShortcut(0.33) },
    { label: '1/2池', value: computePotShortcut(0.5) },
    { label: '2/3池', value: computePotShortcut(0.67) },
    { label: '满池', value: computePotShortcut(1) },
  ];

  const isOpeningBet = handState.currentBet === 0;
  const clampedRaise = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, raiseTo));
  const bbUnits = (clampedRaise / Math.max(1, handState.bigBlind)).toFixed(1);
  const fmt = (amount: number) => formatChipsOrBb(amount, handState.bigBlind, displayInBb);

  return (
    <div className="hud-glass flex flex-col gap-1 sm:gap-2 rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xl">
      {/* Raise Sizing Shortcuts & Smooth Slider */}
      {legal.canRaise && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {shortcuts.map((sc) => (
              <button
                key={sc.label}
                type="button"
                onClick={() => setRaiseTo(sc.value)}
                className={`rounded-lg border px-2 py-0.5 text-[10px] sm:text-[11px] font-black transition cursor-pointer ${
                  clampedRaise === sc.value
                    ? 'border-amber-300 bg-amber-400 text-emerald-950'
                    : 'border-white/15 bg-white/5 text-amber-100 hover:bg-white/15'
                }`}
              >
                {sc.label}
                {displayInBb && (
                  <span className="ml-1 font-mono text-[9px] opacity-85">
                    {fmt(sc.value)}
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRaiseTo(legal.maxRaiseTo)}
              className="rounded-lg border border-rose-400/55 bg-rose-500/20 px-2 py-0.5 text-[10px] sm:text-[11px] font-black text-rose-200 hover:bg-rose-500/35 cursor-pointer"
            >
              All-in{displayInBb ? ` ${fmt(legal.maxRaiseTo)}` : ''}
            </button>
          </div>

          <div className="flex min-w-[160px] flex-1 items-center gap-2">
            <input
              type="range"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              step={Math.max(1, handState.smallBlind)}
              value={clampedRaise}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-emerald-900 accent-amber-400"
              aria-label="加注额度滑动条"
            />
            <div className="min-w-[80px] rounded-lg border border-amber-300/35 bg-black/55 px-2 py-0.5 text-right font-mono text-[11px] font-black text-amber-300">
              {displayInBb ? (
                <>
                  {bbUnits} BB
                  <span className="ml-1 text-[9px] text-emerald-200/70">
                    ({clampedRaise.toLocaleString()})
                  </span>
                </>
              ) : (
                <>
                  {clampedRaise.toLocaleString()}
                  <span className="ml-1 text-[9px] text-emerald-200/75">({bbUnits}BB)</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tactile 3D Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        {legal.canFold && (
          <button
            type="button"
            onClick={() => onAction({ type: 'fold' })}
            className="game-btn-slate inline-flex min-h-[36px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-4 sm:px-5 text-xs sm:text-sm font-black cursor-pointer"
          >
            <XCircle className="h-4 w-4" /> 弃牌 Fold
            <kbd className="hidden lg:inline short-h:hidden rounded bg-black/30 px-1 py-0.5 font-mono text-[10px] opacity-75">
              F
            </kbd>
          </button>
        )}

        {legal.canCheck && (
          <button
            type="button"
            onClick={() => onAction({ type: 'check' })}
            className="game-btn-emerald inline-flex min-h-[36px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-4 sm:px-5 text-xs sm:text-sm font-black cursor-pointer"
          >
            <Check className="h-4 w-4" /> 过牌 Check
            <kbd className="hidden lg:inline short-h:hidden rounded bg-black/25 px-1 py-0.5 font-mono text-[10px] opacity-80">
              C
            </kbd>
          </button>
        )}

        {legal.canCall && (
          <button
            type="button"
            onClick={() => onAction({ type: 'call' })}
            className="game-btn-sky inline-flex min-h-[36px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-4 sm:px-5 text-xs sm:text-sm font-black cursor-pointer"
          >
            <Coins className="h-4 w-4" /> 跟注 {fmt(legal.callAmount)}
            <kbd className="hidden lg:inline short-h:hidden rounded bg-black/25 px-1 py-0.5 font-mono text-[10px] opacity-80">
              C
            </kbd>
          </button>
        )}

        {legal.canRaise && (
          <button
            type="button"
            onClick={() =>
              onAction(
                clampedRaise >= legal.maxRaiseTo
                  ? { type: 'all_in' }
                  : { type: 'raise', amount: clampedRaise },
              )
            }
            className={`${
              clampedRaise >= legal.maxRaiseTo ? 'game-btn-crimson' : 'game-btn-gold'
            } inline-flex min-h-[36px] sm:min-h-[40px] items-center gap-1.5 rounded-xl px-4 sm:px-5 text-xs sm:text-sm font-black cursor-pointer`}
          >
            {clampedRaise >= legal.maxRaiseTo ? (
              <>
                <Zap className="h-4 w-4 fill-current" /> All-in {fmt(legal.maxRaiseTo)}
              </>
            ) : (
              <>
                <ArrowUpCircle className="h-4 w-4" />
                {isOpeningBet ? `下注 ${fmt(clampedRaise)}` : `加注至 ${fmt(clampedRaise)}`}
              </>
            )}
            <kbd className="hidden lg:inline short-h:hidden rounded bg-black/25 px-1 py-0.5 font-mono text-[10px] opacity-80">
              R
            </kbd>
          </button>
        )}

        {!legal.canRaise && legal.canAllIn && legal.isReopened && (
          <button
            type="button"
            onClick={() => onAction({ type: 'all_in' })}
            className="game-btn-crimson inline-flex min-h-[36px] sm:min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-4 sm:px-5 text-xs sm:text-sm font-black cursor-pointer"
          >
            <Zap className="h-4 w-4 fill-current" /> All-in {fmt(legal.maxRaiseTo)}
            <kbd className="hidden lg:inline short-h:hidden rounded bg-black/25 px-1 py-0.5 font-mono text-[10px] opacity-80">
              R
            </kbd>
          </button>
        )}
      </div>
    </div>
  );
};

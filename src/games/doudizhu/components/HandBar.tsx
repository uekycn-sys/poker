import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, sortCardsByPattern, sortCardsByRank } from '../engine';
import { soundEngine } from '../../../shared/audio/soundEngine';
import { PlayingCard } from '../../../shared/cards/PlayingCard';
import { useStageViewport } from '../../../shared/hooks/useStageViewport';
import { usePlayerStore } from '../../../shared/store/playerStore';
import { useDoudizhuProfileStore } from '../store/doudizhuProfileStore';
import { useDoudizhuGameStore } from '../store/doudizhuGameStore';

export const HandBar: React.FC = () => {
  const hand = useDoudizhuGameStore((s) => s.gameState.hands[0]);
  const selectedCardIds = useDoudizhuGameStore((s) => s.selectedCardIds);
  const coachAdvice = useDoudizhuGameStore((s) => s.coachAdvice);
  const smartSelectionNotice = useDoudizhuGameStore((s) => s.smartSelectionNotice);
  const applySwipeSelection = useDoudizhuGameStore((s) => s.applySwipeSelection);

  const sortMode = useDoudizhuProfileStore((s) => s.sortMode);
  const largeCardFont = usePlayerStore((s) => s.largeCardFont);
  const viewport = useStageViewport();

  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      if (el.clientWidth > 0) {
        setMeasuredWidth(el.clientWidth);
      }
    };
    update();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const sortedHand = useMemo(
    () => (sortMode === 'pattern' ? sortCardsByPattern(hand) : sortCardsByRank(hand)),
    [hand, sortMode],
  );

  const [dragState, setDragState] = useState<{ start: number; current: number } | null>(null);
  const dragRef = useRef<{ start: number; current: number } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);
  const coachSet = useMemo(
    () => new Set(coachAdvice && !coachAdvice.isPass ? coachAdvice.cards.map((c) => c.id) : []),
    [coachAdvice],
  );

  useEffect(() => {
    const commitDrag = () => {
      const currentDrag = dragRef.current;
      if (!currentDrag) return;
      dragRef.current = null;
      setDragState(null);

      const minIdx = Math.min(currentDrag.start, currentDrag.current);
      const maxIdx = Math.max(currentDrag.start, currentDrag.current);
      const swipedIds = sortedHand.slice(minIdx, maxIdx + 1).map((c) => c.id);
      applySwipeSelection(swipedIds);
    };

    window.addEventListener('pointerup', commitDrag);
    window.addEventListener('pointercancel', commitDrag);
    return () => {
      window.removeEventListener('pointerup', commitDrag);
      window.removeEventListener('pointercancel', commitDrag);
    };
  }, [sortedHand, applySwipeSelection]);

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const next = { start: index, current: index };
    dragRef.current = next;
    setDragState(next);
    soundEngine.playSelect();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cardEl = el?.closest('[data-card-index]') as HTMLElement | null;
    if (!cardEl) return;
    const idx = Number(cardEl.dataset.cardIndex);
    if (!Number.isNaN(idx) && idx !== dragRef.current.current) {
      const next = { start: dragRef.current.start, current: idx };
      dragRef.current = next;
      setDragState(next);
      soundEngine.playSelect();
    }
  };

  const previewMin = dragState ? Math.min(dragState.start, dragState.current) : -1;
  const previewMax = dragState ? Math.max(dragState.start, dragState.current) : -1;

  // Dynamic step width matched to CSS --card-lg-w & measured container width so up to 20 cards fit cleanly
  const { isShortLandscape, isUltraShort } = viewport;
  const cardWidth = isUltraShort
    ? 70
    : isShortLandscape
      ? 78
      : viewport.width >= 1440 && viewport.height >= 820
        ? 98
        : 90;
  const availableWidth = Math.max(
    180,
    (measuredWidth > 0 ? measuredWidth : viewport.width - (isShortLandscape ? 12 : 280)) - 2,
  );
  const count = Math.max(1, sortedHand.length);
  const idealVisibleStep = isShortLandscape ? 50 : 54;
  const maxStep = count > 1 ? Math.floor((availableWidth - cardWidth) / (count - 1)) : cardWidth;
  const visibleStep = Math.max(20, Math.min(idealVisibleStep, maxStep));
  const overlapPx = Math.max(10, cardWidth - visibleStep);
  const liftSelected = isShortLandscape ? -16 : -24;
  const liftPreview = isShortLandscape ? -9 : -12;

  return (
    <div ref={containerRef} className="relative flex w-full min-w-0 flex-col items-center">
      <AnimatePresence>
        {smartSelectionNotice && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="pointer-events-none absolute bottom-full mb-1 z-30 whitespace-nowrap rounded-full border border-amber-300/60 bg-amber-500/95 px-3 py-0.5 text-xs font-black text-emerald-950 shadow-lg"
          >
            ✨ {smartSelectionNotice}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        onPointerMove={handlePointerMove}
        className={`flex max-w-full touch-none select-none items-end justify-center px-0.5 ${
          isShortLandscape ? 'pt-4 pb-0.5' : 'pt-6 pb-1'
        }`}
      >
        {sortedHand.map((card: Card, index: number) => {
          const isSelected = selectedSet.has(card.id);
          const isDragPreview =
            dragState !== null &&
            index >= previewMin &&
            index <= previewMax &&
            previewMax > previewMin;
          const isCoach = coachSet.has(card.id);

          return (
            <motion.div
              key={card.id}
              layout
              data-card-index={index}
              onPointerDown={(e) => handlePointerDown(index, e)}
              initial={{ opacity: 0, y: 20, scale: 0.92 }}
              animate={{
                opacity: 1,
                y: isSelected ? liftSelected : isDragPreview ? liftPreview : 0,
                scale: 1,
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{
                zIndex: index + 1,
                marginLeft: index === 0 ? 0 : -overlapPx,
              }}
              className="shrink-0 cursor-pointer"
            >
              <PlayingCard
                card={card}
                size="lg"
                largeFont={largeCardFont}
                selected={isSelected}
                dragPreview={isDragPreview}
                coachRecommended={isCoach}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

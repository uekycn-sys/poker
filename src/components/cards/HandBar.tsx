import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, sortCardsByPattern, sortCardsByRank } from '../../engine';
import { soundEngine } from '../../audio/soundEngine';
import { useProfileStore } from '../../store/profileStore';
import { useGameStore } from '../../store/gameStore';
import { PlayingCard } from './PlayingCard';

export const HandBar: React.FC = () => {
  const hand = useGameStore((s) => s.gameState.hands[0]);
  const selectedCardIds = useGameStore((s) => s.selectedCardIds);
  const coachAdvice = useGameStore((s) => s.coachAdvice);
  const smartSelectionNotice = useGameStore((s) => s.smartSelectionNotice);
  const applySwipeSelection = useGameStore((s) => s.applySwipeSelection);

  const sortMode = useProfileStore((s) => s.sortMode);
  const largeCardFont = useProfileStore((s) => s.largeCardFont);

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

  // Dynamically tighten card overlap when hand has many cards
  const overlapClass =
    sortedHand.length > 16
      ? '-ml-9 md:-ml-10 first:ml-0'
      : sortedHand.length > 10
        ? '-ml-8 md:-ml-9 first:ml-0'
        : '-ml-6 md:-ml-7 first:ml-0';

  return (
    <div className="relative flex flex-col items-center">
      {/* Smart swipe selection toast */}
      <AnimatePresence>
        {smartSelectionNotice && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-2 rounded-full border border-amber-300/60 bg-amber-500/90 px-3.5 py-1 text-xs font-bold text-emerald-950 shadow-lg"
          >
            ✨ {smartSelectionNotice}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        onPointerMove={handlePointerMove}
        className="flex touch-none select-none items-end justify-center px-4 pb-1 pt-6"
      >
        {sortedHand.map((card: Card, index: number) => {
          const isSelected = selectedSet.has(card.id);
          const isDragPreview =
            dragState !== null && index >= previewMin && index <= previewMax && previewMax > previewMin;
          const isCoach = coachSet.has(card.id);

          return (
            <motion.div
              key={card.id}
              layout
              data-card-index={index}
              onPointerDown={(e) => handlePointerDown(index, e)}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{
                opacity: 1,
                y: isSelected ? -22 : isDragPreview ? -12 : 0,
                scale: 1,
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              style={{ zIndex: index + 1 }}
              className={`${overlapClass} cursor-pointer`}
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

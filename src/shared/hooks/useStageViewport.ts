import { useEffect, useState } from 'react';

export interface StageViewport {
  width: number;
  height: number;
  isForcedLandscape: boolean;
  isShortLandscape: boolean;
  isUltraShort: boolean;
}

export function getStageViewport(): StageViewport {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 800,
      isForcedLandscape: false,
      isShortLandscape: false,
      isUltraShort: false,
    };
  }

  const rawW = window.innerWidth;
  const rawH = window.innerHeight;
  const isCoarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const isForcedLandscape = rawH > rawW * 1.05 && (isCoarse || rawW <= 640);

  const width = isForcedLandscape ? rawH : rawW;
  const height = isForcedLandscape ? rawW : rawH;

  return {
    width,
    height,
    isForcedLandscape,
    isShortLandscape: height <= 540,
    isUltraShort: height <= 410,
  };
}

export function syncStageViewportAttributes(vp: StageViewport): void {
  if (typeof document === 'undefined') return;
  const { dataset, style } = document.documentElement;
  style.setProperty('--stage-w', `${vp.width}px`);
  style.setProperty('--stage-h', `${vp.height}px`);

  if (vp.isForcedLandscape) dataset.forcedLandscape = 'true';
  else delete dataset.forcedLandscape;

  if (vp.isShortLandscape) {
    dataset.shortLandscape = 'true';
    delete dataset.tallLandscape;
  } else {
    delete dataset.shortLandscape;
    dataset.tallLandscape = 'true';
  }

  if (vp.isUltraShort) dataset.ultraShort = 'true';
  else delete dataset.ultraShort;
}

export function useStageViewport(): StageViewport {
  const [viewport, setViewport] = useState<StageViewport>(() => {
    const initial = getStageViewport();
    syncStageViewportAttributes(initial);
    return initial;
  });

  useEffect(() => {
    const update = () => {
      const next = getStageViewport();
      syncStageViewportAttributes(next);
      setViewport((prev) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.isForcedLandscape === next.isForcedLandscape &&
        prev.isShortLandscape === next.isShortLandscape &&
        prev.isUltraShort === next.isUltraShort
          ? prev
          : next,
      );
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return viewport;
}

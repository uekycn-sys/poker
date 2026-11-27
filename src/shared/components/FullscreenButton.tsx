import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface ScreenOrientationWithLock extends ScreenOrientation {
  lock?: (orientation: 'landscape' | 'portrait' | 'any') => Promise<void>;
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as FullscreenElement;
  return Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
}

export async function enterFullscreenWithLandscape(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement as FullscreenElement;
  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen();
    } else if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
    } else {
      return false;
    }
    const isCoarsePointer =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches;
    if (isCoarsePointer && typeof screen !== 'undefined') {
      const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
      try {
        await orientation?.lock?.('landscape');
      } catch {
        // Orientation lock may be rejected by desktop or iOS Safari; ignore silently.
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreenSafe(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore errors when already exited.
  }
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));
  const supported = isFullscreenSupported();

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (getFullscreenElement()) {
      await exitFullscreenSafe();
    } else {
      await enterFullscreenWithLandscape();
    }
  }, []);

  return { isFullscreen, supported, toggleFullscreen };
}

interface FullscreenButtonProps {
  compact?: boolean;
  className?: string;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { isFullscreen, supported, toggleFullscreen } = useFullscreen();

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      title={isFullscreen ? '退出全屏' : '全屏沉浸模式'}
      aria-label={isFullscreen ? '退出全屏' : '全屏'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border transition cursor-pointer ${
        isFullscreen
          ? 'border-amber-300/70 bg-amber-400/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.22)]'
          : 'border-amber-400/35 bg-black/45 text-amber-100 hover:border-amber-300/70 hover:bg-amber-400/15'
      } ${compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-1.5 text-xs font-bold'} ${className}`}
    >
      {isFullscreen ? (
        <Minimize2 className="h-3.5 w-3.5 text-amber-300" />
      ) : (
        <Maximize2 className="h-3.5 w-3.5 text-amber-300" />
      )}
      {!compact && <span className="hidden sm:inline">{isFullscreen ? '退出全屏' : '全屏'}</span>}
    </button>
  );
};

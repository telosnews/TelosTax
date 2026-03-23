/**
 * useResizePanel — drag-to-resize hook for vertical panel dividers.
 *
 * Handles mousedown/mousemove/mouseup on a divider element to resize a panel.
 * Persists width to localStorage. Supports collapse threshold and double-click reset.
 * Only active on desktop (lg breakpoint, ≥1024px).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_PREFIX = 'telostax:panel-width:';
const LG_QUERY = '(min-width: 1024px)';

interface UseResizePanelOptions {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Width below which the panel collapses to 0. Set to 0 to disable collapse. */
  collapseThreshold?: number;
  /** 'left' = sidebar (drag right edge), 'right' = chat panel (drag left edge). */
  side: 'left' | 'right';
}

interface UseResizePanelReturn {
  width: number;
  isCollapsed: boolean;
  isDragging: boolean;
  startResize: (e: React.MouseEvent | React.TouchEvent) => void;
  resetWidth: () => void;
}

function readStored(key: string, fallback: number): number {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    if (val !== null) {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 0) return n;
    }
  } catch { /* ignore */ }
  return fallback;
}

function writeStored(key: string, value: number): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, String(Math.round(value)));
  } catch { /* ignore */ }
}

export function useResizePanel(opts: UseResizePanelOptions): UseResizePanelReturn {
  const { storageKey, defaultWidth, minWidth, maxWidth, collapseThreshold = 0, side } = opts;

  const [width, setWidth] = useState(() => readStored(storageKey, defaultWidth));
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number>(0);

  const isCollapsed = width === 0;

  const startResize = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // Only resize on desktop
      if (!window.matchMedia(LG_QUERY).matches) return;
      e.preventDefault();

      setIsDragging(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const onMove = (ev: MouseEvent | TouchEvent) => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;

          let newWidth: number;
          if (side === 'left') {
            newWidth = clientX;
          } else {
            newWidth = window.innerWidth - clientX;
          }

          if (collapseThreshold > 0 && newWidth < collapseThreshold) {
            setWidth(0);
          } else {
            setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
          }
        });
      };

      const onEnd = () => {
        cancelAnimationFrame(rafRef.current);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        setIsDragging(false);

        // Persist final width
        setWidth((w) => {
          writeStored(storageKey, w);
          return w;
        });

        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    },
    [side, minWidth, maxWidth, collapseThreshold, storageKey],
  );

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
    writeStored(storageKey, defaultWidth);
  }, [defaultWidth, storageKey]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { width, isCollapsed, isDragging, startResize, resetWidth };
}

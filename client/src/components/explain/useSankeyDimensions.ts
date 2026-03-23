import { useRef, useState, useEffect } from 'react';

/** Returns { ref, width, height } where height scales with node count. */
export function useSankeyDimensions(nodeCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.max(400, nodeCount * 40);

  return { ref, width, height };
}

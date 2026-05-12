import { useEffect, useState, type RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Tracks the offset size of the element referenced by `ref` via ResizeObserver.
 * Returns 0,0 until the first measurement.
 */
export function useResizeObserver(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

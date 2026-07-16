import { useCallback, useRef } from "react";

interface ColumnResizerProps {
  position: number;
  onResize: (delta: number) => void;
  ariaLabel: string;
  step?: number;
  largeStep?: number;
  /** Current column width for aria-valuenow (optional, improves a11y). */
  valueNow?: number;
  /** Minimum column width for aria-valuemin (optional). */
  valueMin?: number;
  /** Maximum column width for aria-valuemax (optional). */
  valueMax?: number;
}

export const ColumnResizer = ({
  onResize,
  position,
  ariaLabel,
  step = 8,
  largeStep = 32,
  valueNow,
  valueMin = 0,
  valueMax,
}: ColumnResizerProps) => {
  const resizerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = resizerRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      startXRef.current = e.clientX;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        startXRef.current = moveEvent.clientX;
        pendingDeltaRef.current += delta;

        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const d = pendingDeltaRef.current;
            pendingDeltaRef.current = 0;
            if (d !== 0) onResize(d);
          });
        }
      };

      const handlePointerUp = () => {
        el.removeEventListener("pointermove", handlePointerMove);
        el.removeEventListener("pointerup", handlePointerUp);
        el.removeEventListener("pointercancel", handlePointerUp);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (pendingDeltaRef.current !== 0) {
          onResize(pendingDeltaRef.current);
          pendingDeltaRef.current = 0;
        }
      };

      el.addEventListener("pointermove", handlePointerMove);
      el.addEventListener("pointerup", handlePointerUp);
      el.addEventListener("pointercancel", handlePointerUp);
    },
    [onResize]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const amount = e.shiftKey ? largeStep : step;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onResize(amount);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onResize(-amount);
      }
    },
    [onResize, step, largeStep]
  );

  return (
    <div
      ref={resizerRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className="column-resizer before:bg-border hover:bg-accent-cyan/20 hover:before:bg-bg-selected active:bg-accent-cyan/20 active:before:bg-bg-selected focus-ring pointer-events-auto absolute inset-y-0 z-10 -ml-1 w-2 cursor-col-resize touch-none bg-transparent transition-colors duration-150 before:absolute before:inset-y-1 before:left-0.75 before:w-0.5 before:rounded-sm before:content-['']"
      style={{ left: position }}
    />
  );
};

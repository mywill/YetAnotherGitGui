import { useCallback } from "react";
import { useRafPointerDrag } from "../../hooks/useRafPointerDrag";

interface ColumnResizerProps {
  position: number;
  onResize: (delta: number) => void;
  ariaLabel: string;
  step?: number;
  largeStep?: number;
  valueNow?: number;
  valueMin?: number;
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
  const handlePointerDown = useRafPointerDrag({
    onDragMove: (delta) => {
      onResize(delta);
    },
    onDragEnd: (delta) => {
      if (delta !== 0) onResize(delta);
    },
  });

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

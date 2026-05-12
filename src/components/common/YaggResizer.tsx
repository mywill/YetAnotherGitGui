import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import { useSettingsStore } from "../../stores/settingsStore";

interface YaggResizerProps {
  orientation: "vertical" | "horizontal";
  size: number;
  onSizeChange: (next: number) => void;
  min: number;
  max: number;
  defaultSize: number;
  step?: number;
  largeStep?: number;
  ariaLabel: string;
  storageKey?: string;
  collapsible?: boolean;
  panelId?: string;
  /** Which side of the resizer the controlled panel is on. Defaults to "left" (vertical) / "up" (horizontal). */
  panelSide?: "left" | "right" | "up" | "down";
}

export const YaggResizer = ({
  orientation,
  size,
  onSizeChange,
  min,
  max,
  defaultSize,
  step = 8,
  largeStep = 32,
  ariaLabel,
  storageKey,
  collapsible = false,
  panelId,
  panelSide,
}: YaggResizerProps) => {
  const resizerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<number | null>(null);
  const dragStartSizeRef = useRef(0);
  const isCollapsedRef = useRef(false);

  // Initialize from stored layout size
  useEffect(() => {
    if (!storageKey) return;
    const stored = useSettingsStore.getState().layoutSizes[storageKey];
    if (stored !== undefined) {
      onSizeChange(Math.max(0, Math.min(max, stored)));
    }
  }, [storageKey, max, onSizeChange]);

  const clampSize = useCallback(
    (val: number) => {
      if (collapsible && val < min * 0.5) return 0;
      return Math.max(min, Math.min(max, val));
    },
    [min, max, collapsible]
  );

  const commitSize = useCallback(
    (next: number) => {
      onSizeChange(next);
      isCollapsedRef.current = next === 0;
      if (storageKey) {
        useSettingsStore.getState().setLayoutSize(storageKey, next);
      }
    },
    [onSizeChange, storageKey]
  );

  // Whether dragging right/down should shrink instead of grow
  const inverted = panelSide === "right" || panelSide === "down";

  // Pointer drag with capture
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = resizerRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);

      const startPos = orientation === "vertical" ? e.clientX : e.clientY;
      dragStartSizeRef.current = size;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentPos = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
        const rawDelta = currentPos - startPos;
        const delta = inverted ? -rawDelta : rawDelta;

        const next = clampSize(dragStartSizeRef.current + delta);
        pendingSizeRef.current = next;

        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (pendingSizeRef.current !== null) {
              onSizeChange(pendingSizeRef.current);
              isCollapsedRef.current = pendingSizeRef.current === 0;
            }
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

        // Commit final size to storage
        const finalSize = pendingSizeRef.current ?? size;
        commitSize(finalSize);
        pendingSizeRef.current = null;
      };

      el.addEventListener("pointermove", handlePointerMove);
      el.addEventListener("pointerup", handlePointerUp);
      el.addEventListener("pointercancel", handlePointerUp);
    },
    [orientation, size, inverted, clampSize, onSizeChange, commitSize]
  );

  // Double-click to reset
  const handleDoubleClick = useCallback(() => {
    commitSize(defaultSize);
  }, [defaultSize, commitSize]);

  // Keyboard support
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isVertical = orientation === "vertical";
      const naturalGrow = isVertical ? "ArrowRight" : "ArrowDown";
      const naturalShrink = isVertical ? "ArrowLeft" : "ArrowUp";
      const growKey = inverted ? naturalShrink : naturalGrow;
      const shrinkKey = inverted ? naturalGrow : naturalShrink;

      let next: number | null = null;

      if (e.key === growKey) {
        e.preventDefault();
        const amount = e.shiftKey ? largeStep : step;
        next = clampSize(size + amount);
      } else if (e.key === shrinkKey) {
        e.preventDefault();
        const amount = e.shiftKey ? largeStep : step;
        next = clampSize(size - amount);
      } else if (e.key === "Home") {
        e.preventDefault();
        next = defaultSize;
      } else if (e.key === "End") {
        e.preventDefault();
        next = max;
      } else if ((e.key === "Enter" || e.key === " ") && collapsible) {
        e.preventDefault();
        next = isCollapsedRef.current ? defaultSize : 0;
      }

      if (next !== null) {
        commitSize(next);
      }
    },
    [
      orientation,
      size,
      step,
      largeStep,
      defaultSize,
      max,
      collapsible,
      inverted,
      clampSize,
      commitSize,
    ]
  );

  const isVertical = orientation === "vertical";

  return (
    <div
      ref={resizerRef}
      role="separator"
      aria-orientation={orientation}
      aria-valuenow={size}
      aria-valuemin={collapsible ? 0 : min}
      aria-valuemax={max}
      aria-label={ariaLabel}
      aria-controls={panelId}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        "yagg-resizer shrink-0 touch-none transition-colors duration-100 select-none",
        "before:absolute before:rounded-sm before:transition-colors before:duration-100 before:content-['']",
        "hover:before:bg-bg-selected active:before:bg-accent-cyan/40",
        "focus-ring",
        "motion-reduce:transition-none motion-reduce:before:transition-none",
        isVertical
          ? "before:bg-border relative w-2 cursor-col-resize before:inset-y-0 before:left-[3px] before:w-px"
          : "before:bg-border relative h-2 cursor-row-resize before:inset-x-0 before:top-[3px] before:h-px"
      )}
    />
  );
};

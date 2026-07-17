import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import { useSettingsStore } from "../../stores/settingsStore";
import { useRafPointerDrag } from "../../hooks/useRafPointerDrag";

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
  panelSide?: "left" | "right" | "up" | "down";
}

interface KeyboardResizeConfig {
  growKey: string;
  shrinkKey: string;
  step: number;
  largeStep: number;
  defaultSize: number;
  max: number;
  collapsible: boolean;
  isCollapsed: boolean;
}

// fallow-ignore-next-line complexity
function getKeyboardResize(
  key: string,
  shiftKey: boolean,
  size: number,
  config: KeyboardResizeConfig,
  clamp: (val: number) => number
): number | null {
  const amount = shiftKey ? config.largeStep : config.step;
  if (key === config.growKey) return clamp(size + amount);
  if (key === config.shrinkKey) return clamp(size - amount);
  if (key === "Home") return config.defaultSize;
  if (key === "End") return config.max;
  if (config.collapsible && (key === "Enter" || key === " ")) {
    return config.isCollapsed ? config.defaultSize : 0;
  }
  return null;
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
  const dragStartSizeRef = useRef(0);
  const currentDragSizeRef = useRef(0);
  const isCollapsedRef = useRef(false);

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

  const inverted = panelSide === "right" || panelSide === "down";

  const handlePointerDown = useRafPointerDrag({
    getPosition: (e) => {
      const raw = orientation === "vertical" ? e.clientX : e.clientY;
      return inverted ? -raw : raw;
    },
    onDragMove: (totalDelta) => {
      const next = clampSize(dragStartSizeRef.current + totalDelta);
      currentDragSizeRef.current = next;
      onSizeChange(next);
      isCollapsedRef.current = next === 0;
    },
    onDragEnd: (_totalDelta) => {
      commitSize(currentDragSizeRef.current);
    },
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragStartSizeRef.current = size;
      currentDragSizeRef.current = size;
      handlePointerDown(e);
    },
    [size, handlePointerDown]
  );

  const handleDoubleClick = useCallback(() => {
    commitSize(defaultSize);
  }, [defaultSize, commitSize]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isVertical = orientation === "vertical";
      const naturalGrow = isVertical ? "ArrowRight" : "ArrowDown";
      const naturalShrink = isVertical ? "ArrowLeft" : "ArrowUp";
      const growKey = inverted ? naturalShrink : naturalGrow;
      const shrinkKey = inverted ? naturalGrow : naturalShrink;

      const next = getKeyboardResize(
        e.key,
        e.shiftKey,
        size,
        {
          growKey,
          shrinkKey,
          step,
          largeStep,
          defaultSize,
          max,
          collapsible,
          isCollapsed: isCollapsedRef.current,
        },
        clampSize
      );
      if (next !== null) {
        e.preventDefault();
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
      role="separator"
      aria-orientation={orientation}
      aria-valuenow={size}
      aria-valuemin={collapsible ? 0 : min}
      aria-valuemax={max}
      aria-label={ariaLabel}
      aria-controls={panelId}
      tabIndex={0}
      onPointerDown={onPointerDown}
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

import { useRef, useCallback } from "react";

interface RafPointerDragCallbacks {
  getPosition?: (e: PointerEvent) => number;
  onDragMove?: (delta: number, e: PointerEvent) => void;
  onDragEnd?: (delta: number, e: PointerEvent) => void;
}

export function useRafPointerDrag({
  getPosition = (e) => e.clientX,
  onDragMove,
  onDragEnd,
}: RafPointerDragCallbacks) {
  const rafRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef(0);
  const lastPosRef = useRef(0);
  const callbacksRef = useRef({ getPosition, onDragMove, onDragEnd });
  callbacksRef.current = { getPosition, onDragMove, onDragEnd };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    lastPosRef.current = callbacksRef.current.getPosition(e.nativeEvent);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const pos = callbacksRef.current.getPosition(moveEvent);
      pendingDeltaRef.current += pos - lastPosRef.current;
      lastPosRef.current = pos;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const d = pendingDeltaRef.current;
          pendingDeltaRef.current = 0;
          if (d !== 0) {
            callbacksRef.current.onDragMove?.(d, moveEvent);
          }
        });
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handlePointerUp);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const d = pendingDeltaRef.current;
      pendingDeltaRef.current = 0;
      callbacksRef.current.onDragEnd?.(d, upEvent);
    };

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("pointercancel", handlePointerUp);
  }, []);

  return handlePointerDown;
}

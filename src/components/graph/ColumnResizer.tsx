import { useCallback, useRef } from "react";

interface ColumnResizerProps {
  position: number;
  onResize: (delta: number) => void;
}

export function ColumnResizer({ onResize, position }: ColumnResizerProps) {
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        startXRef.current = moveEvent.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      className="column-resizer before:bg-border hover:bg-primary/20 hover:before:bg-bg-selected active:bg-primary/20 active:before:bg-bg-selected pointer-events-auto absolute inset-y-0 z-10 -ml-1 w-2 cursor-col-resize bg-transparent transition-colors duration-150 before:absolute before:inset-y-1 before:left-0.75 before:w-0.5 before:rounded-sm before:content-['']"
      style={{ left: position }}
      onMouseDown={handleMouseDown}
    />
  );
}

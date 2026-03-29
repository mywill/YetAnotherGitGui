import { useCallback } from "react";

interface TerminalResizerProps {
  onResize: (delta: number) => void;
}

export function TerminalResizer({ onResize }: TerminalResizerProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;

      const handleMouseMove = (e: MouseEvent) => {
        onResize(startY - e.clientY);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      className="terminal-resizer bg-border hover:bg-bg-selected h-1 shrink-0 cursor-row-resize transition-colors duration-150"
      onMouseDown={handleMouseDown}
    />
  );
}

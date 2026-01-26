import React, { useState, useCallback } from "react";
import "./MainLayout.css";

interface MainLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  bottomLeftPanel?: React.ReactNode;
}

export function MainLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  bottomLeftPanel,
}: MainLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(450);
  const [bottomHeight, setBottomHeight] = useState(150);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(200, Math.min(500, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(300, Math.min(800, w - delta)));
  }, []);

  const handleBottomResize = useCallback((delta: number) => {
    setBottomHeight((h) => Math.max(100, Math.min(300, h - delta)));
  }, []);

  return (
    <div className="main-layout">
      <div className="left-column" style={{ width: leftWidth }}>
        <div className="left-panel">{leftPanel}</div>
        {bottomLeftPanel && (
          <>
            <Resizer direction="horizontal" onResize={handleBottomResize} />
            <div className="bottom-left-panel" style={{ height: bottomHeight }}>
              {bottomLeftPanel}
            </div>
          </>
        )}
      </div>
      <Resizer direction="vertical" onResize={handleLeftResize} />
      <div className="center-panel">{centerPanel}</div>
      <Resizer direction="vertical" onResize={handleRightResize} />
      <div className="right-panel" style={{ width: rightWidth }}>
        {rightPanel}
      </div>
    </div>
  );
}

interface ResizerProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
}

function Resizer({ direction, onResize }: ResizerProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startPos = direction === "vertical" ? e.clientX : e.clientY;

      const handleMouseMove = (e: MouseEvent) => {
        const currentPos = direction === "vertical" ? e.clientX : e.clientY;
        onResize(currentPos - startPos);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = direction === "vertical" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction, onResize]
  );

  return <div className={`resizer resizer-${direction}`} onMouseDown={handleMouseDown} />;
}

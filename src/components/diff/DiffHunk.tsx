import { useState, useCallback, useRef } from "react";
import type { DiffHunk as DiffHunkType } from "../../types";
import "./DiffHunk.css";

interface DiffHunkProps {
  hunk: DiffHunkType;
  onAction: () => void;
  onStageLines?: (lineIndices: number[]) => void;
  actionLabel: string;
  canSelectLines: boolean;
}

export function DiffHunk({
  hunk,
  onAction,
  onStageLines,
  actionLabel,
  canSelectLines,
}: DiffHunkProps) {
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const lastClickedRef = useRef<number | null>(null);
  const selectionStartRef = useRef<number | null>(null);

  // Filter out header lines - only show context, addition, deletion
  const visibleLines = hunk.lines
    .map((line, idx) => ({ ...line, originalIndex: idx }))
    .filter((line) => line.line_type !== "header");

  const handleMouseDown = useCallback(
    (originalIndex: number, lineType: string, e: React.MouseEvent) => {
      if (!canSelectLines) return;
      if (lineType === "context") return;

      // Shift-click for range selection (consecutive lines only)
      if (e.shiftKey && lastClickedRef.current !== null) {
        const start = Math.min(lastClickedRef.current, originalIndex);
        const end = Math.max(lastClickedRef.current, originalIndex);

        const newSelection = new Set<number>();
        for (let i = start; i <= end; i++) {
          const line = hunk.lines[i];
          if (line && line.line_type !== "context" && line.line_type !== "header") {
            newSelection.add(i);
          }
        }
        setSelectedLines(newSelection);
        return;
      }

      // If clicking on already-selected single line, unselect it
      if (selectedLines.size === 1 && selectedLines.has(originalIndex)) {
        setSelectedLines(new Set());
        lastClickedRef.current = null;
        return;
      }

      // Normal click: start fresh selection
      setIsSelecting(true);
      selectionStartRef.current = originalIndex;
      lastClickedRef.current = originalIndex;

      // Start fresh selection with just this line
      setSelectedLines(new Set([originalIndex]));
    },
    [canSelectLines, hunk.lines, selectedLines]
  );

  const handleMouseEnter = useCallback(
    (originalIndex: number, lineType: string) => {
      if (!isSelecting || !canSelectLines) return;
      if (lineType === "context") return;
      if (selectionStartRef.current === null) return;

      // Select range from start to current
      const start = Math.min(selectionStartRef.current, originalIndex);
      const end = Math.max(selectionStartRef.current, originalIndex);

      const newSelection = new Set<number>();
      for (let i = start; i <= end; i++) {
        const line = hunk.lines[i];
        if (line && line.line_type !== "context" && line.line_type !== "header") {
          newSelection.add(i);
        }
      }
      setSelectedLines(newSelection);
    },
    [isSelecting, canSelectLines, hunk.lines]
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    selectionStartRef.current = null;
  }, []);

  const handleStageSelected = useCallback(() => {
    if (onStageLines && selectedLines.size > 0) {
      onStageLines(Array.from(selectedLines));
      setSelectedLines(new Set());
      lastClickedRef.current = null;
    }
  }, [onStageLines, selectedLines]);

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
    lastClickedRef.current = null;
  }, []);

  const hasSelection = selectedLines.size > 0;

  // Extract a cleaner version of the hunk header (e.g., "@@ -1,3 +1,4 @@")
  const hunkInfo = hunk.header.split("@@").slice(0, 2).join("@@") + "@@";

  return (
    <div
      className={`diff-hunk ${hasSelection ? "has-selection" : ""}`}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="hunk-header">
        <span className="hunk-info">{hunkInfo.trim()}</span>
        <div className="hunk-actions">
          {selectedLines.size > 0 && canSelectLines && (
            <>
              <button className="hunk-action" onClick={handleStageSelected}>
                Stage {selectedLines.size} line{selectedLines.size > 1 ? "s" : ""}
              </button>
              <button className="hunk-action secondary" onClick={clearSelection}>
                Clear
              </button>
            </>
          )}
          <button className="hunk-action" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      </div>
      <div className="hunk-lines">
        {visibleLines.map((line) => {
          const isSelectable =
            canSelectLines && (line.line_type === "addition" || line.line_type === "deletion");
          const isSelected = selectedLines.has(line.originalIndex);

          return (
            <div
              key={line.originalIndex}
              className={`diff-line line-${line.line_type} ${isSelectable ? "selectable" : ""} ${isSelected ? "selected" : ""}`}
              onMouseDown={(e) => handleMouseDown(line.originalIndex, line.line_type, e)}
              onMouseEnter={() => handleMouseEnter(line.originalIndex, line.line_type)}
            >
              <span className="line-number old">{line.old_lineno ?? ""}</span>
              <span className="line-number new">{line.new_lineno ?? ""}</span>
              <span className="line-prefix">
                {line.line_type === "addition" ? "+" : line.line_type === "deletion" ? "-" : " "}
              </span>
              <span className="line-content">{line.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useCallback, useRef } from "react";
import clsx from "clsx";
import type { DiffHunk as DiffHunkType } from "../../types";

interface DiffHunkProps {
  hunk: DiffHunkType;
  onAction: () => void;
  onStageLines?: (lineIndices: number[]) => void;
  actionLabel: string;
  canSelectLines: boolean;
  onDiscardHunk?: () => void;
  onDiscardLines?: (lineIndices: number[]) => void;
}

export function DiffHunk({
  hunk,
  onAction,
  onStageLines,
  actionLabel,
  canSelectLines,
  onDiscardHunk,
  onDiscardLines,
}: DiffHunkProps) {
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const lastClickedRef = useRef<number | null>(null);
  const selectionStartRef = useRef<number | null>(null);

  const visibleLines = hunk.lines
    .map((line, idx) => ({ ...line, originalIndex: idx }))
    .filter((line) => line.line_type !== "header");

  const handleMouseDown = useCallback(
    (originalIndex: number, lineType: string, e: React.MouseEvent) => {
      if (!canSelectLines) return;
      if (lineType === "context") return;

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

      if (selectedLines.size === 1 && selectedLines.has(originalIndex)) {
        setSelectedLines(new Set());
        lastClickedRef.current = null;
        return;
      }

      setIsSelecting(true);
      selectionStartRef.current = originalIndex;
      lastClickedRef.current = originalIndex;
      setSelectedLines(new Set([originalIndex]));
    },
    [canSelectLines, hunk.lines, selectedLines]
  );

  const handleMouseEnter = useCallback(
    (originalIndex: number, lineType: string) => {
      if (!isSelecting || !canSelectLines) return;
      if (lineType === "context") return;
      if (selectionStartRef.current === null) return;

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

  const handleDiscardSelected = useCallback(() => {
    if (onDiscardLines && selectedLines.size > 0) {
      onDiscardLines(Array.from(selectedLines));
      setSelectedLines(new Set());
      lastClickedRef.current = null;
    }
  }, [onDiscardLines, selectedLines]);

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
    lastClickedRef.current = null;
  }, []);

  const hasSelection = selectedLines.size > 0;

  const hunkInfo = hunk.header.split("@@").slice(0, 2).join("@@") + "@@";

  return (
    <div
      className={clsx("diff-hunk relative", hasSelection && "has-selection")}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="hunk-header border-border bg-bg-tertiary flex items-center justify-between border-b px-2 py-1 text-xs">
        <span className="hunk-info text-text-muted font-mono">{hunkInfo.trim()}</span>
        <div className="hunk-actions flex gap-1">
          {selectedLines.size > 0 && canSelectLines && (
            <button
              className="hunk-action bg-bg-secondary hover:bg-bg-hover rounded px-2 py-px text-xs"
              onClick={handleStageSelected}
            >
              Stage {selectedLines.size} line{selectedLines.size > 1 ? "s" : ""}
            </button>
          )}
          <button
            className="hunk-action bg-bg-secondary hover:bg-bg-hover rounded px-2 py-px text-xs"
            onClick={onAction}
          >
            {actionLabel}
          </button>
          {selectedLines.size > 0 && canSelectLines && onDiscardLines && (
            <button
              className="hunk-action bg-bg-secondary hover:bg-bg-hover rounded px-2 py-px text-xs"
              onClick={handleDiscardSelected}
            >
              Discard {selectedLines.size} line{selectedLines.size > 1 ? "s" : ""}
            </button>
          )}
          {onDiscardHunk && (
            <button
              className="hunk-action bg-bg-secondary hover:bg-bg-hover rounded px-2 py-px text-xs"
              onClick={onDiscardHunk}
            >
              Discard hunk
            </button>
          )}
          {selectedLines.size > 0 && canSelectLines && (
            <button
              className="hunk-action secondary hover:bg-bg-hover rounded bg-transparent px-2 py-px text-xs"
              onClick={clearSelection}
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="hunk-lines bg-bg-primary table w-full min-w-max">
        {visibleLines.map((line) => {
          const isSelectable =
            canSelectLines && (line.line_type === "addition" || line.line_type === "deletion");
          const isSelected = selectedLines.has(line.originalIndex);

          return (
            <div
              key={line.originalIndex}
              className={clsx(
                "diff-line table-row min-h-4.5",
                `line-${line.line_type}`,
                line.line_type === "addition" && "bg-addition/15",
                line.line_type === "deletion" && "bg-deletion/15",
                line.line_type === "context" && "bg-transparent",
                isSelectable && "selectable cursor-pointer hover:brightness-110",
                isSelected && "selected outline-primary outline outline-2 -outline-offset-2",
                isSelected && line.line_type === "addition" && "bg-addition/25",
                isSelected && line.line_type === "deletion" && "bg-deletion/25"
              )}
              onMouseDown={(e) => handleMouseDown(line.originalIndex, line.line_type, e)}
              onMouseEnter={() => handleMouseEnter(line.originalIndex, line.line_type)}
            >
              <span className="line-number old border-border text-text-muted table-cell w-10 min-w-10 border-r bg-black/10 px-1 text-right select-none">
                {line.old_lineno ?? ""}
              </span>
              <span className="line-number new border-border text-text-muted table-cell w-10 min-w-10 border-r bg-black/5 px-1 text-right select-none">
                {line.new_lineno ?? ""}
              </span>
              <span
                className={clsx(
                  "line-prefix table-cell w-5 min-w-5 text-center select-none",
                  line.line_type === "addition" && "text-addition",
                  line.line_type === "deletion" && "text-deletion"
                )}
              >
                {line.line_type === "addition" ? "+" : line.line_type === "deletion" ? "-" : " "}
              </span>
              <span className="line-content table-cell pr-2 whitespace-pre">{line.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

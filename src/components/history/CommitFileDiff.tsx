import { useState, useCallback, useRef } from "react";
import clsx from "clsx";
import type { FileDiff } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";

interface CommitFileDiffProps {
  diff: FileDiff;
  commitHash?: string;
  filePath?: string;
}

export function CommitFileDiff({ diff, commitHash, filePath }: CommitFileDiffProps) {
  if (diff.is_binary) {
    return (
      <div className="commit-file-diff binary text-text-muted p-3 text-center">
        Binary file - cannot display diff
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="commit-file-diff empty text-text-muted p-3 text-center">
        No changes to display
      </div>
    );
  }

  const canRevert = !!commitHash && !!filePath;

  return (
    <div className="commit-file-diff font-mono text-xs leading-normal">
      {diff.hunks.map((hunk, hunkIndex) => (
        <CommitDiffHunk
          key={hunkIndex}
          hunk={hunk}
          hunkIndex={hunkIndex}
          commitHash={commitHash}
          filePath={filePath}
          canRevert={canRevert}
        />
      ))}
    </div>
  );
}

interface CommitDiffHunkProps {
  hunk: FileDiff["hunks"][0];
  hunkIndex: number;
  commitHash?: string;
  filePath?: string;
  canRevert: boolean;
}

function CommitDiffHunk({ hunk, hunkIndex, commitHash, filePath, canRevert }: CommitDiffHunkProps) {
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const lastClickedRef = useRef<number | null>(null);
  const selectionStartRef = useRef<number | null>(null);
  const revertCommitFileLines = useRepositoryStore((s) => s.revertCommitFileLines);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const visibleLines = hunk.lines
    .map((line, idx) => ({ ...line, originalIndex: idx }))
    .filter((line) => line.line_type !== "header");

  const handleMouseDown = useCallback(
    (originalIndex: number, lineType: string, e: React.MouseEvent) => {
      if (!canRevert) return;
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
    [canRevert, hunk.lines, selectedLines]
  );

  const handleMouseEnter = useCallback(
    (originalIndex: number, lineType: string) => {
      if (!isSelecting || !canRevert) return;
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
    [isSelecting, canRevert, hunk.lines]
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    selectionStartRef.current = null;
  }, []);

  const handleRevertSelected = useCallback(async () => {
    if (!commitHash || !filePath || selectedLines.size === 0) return;
    const count = selectedLines.size;
    const confirmed = await showConfirm({
      title: `Revert ${count} line${count > 1 ? "s" : ""}?`,
      message: "This will undo the selected changes and stage the result.",
      confirmLabel: "Revert",
    });
    if (!confirmed) return;
    await revertCommitFileLines(commitHash, filePath, hunkIndex, Array.from(selectedLines));
    setSelectedLines(new Set());
    lastClickedRef.current = null;
  }, [commitHash, filePath, hunkIndex, selectedLines, revertCommitFileLines, showConfirm]);

  const handleRevertHunk = useCallback(async () => {
    if (!commitHash || !filePath) return;
    const confirmed = await showConfirm({
      title: "Revert hunk?",
      message: "This will undo the changes in this hunk and stage the result.",
      confirmLabel: "Revert",
    });
    if (!confirmed) return;
    // Select all addition/deletion lines in this hunk
    const allIndices: number[] = [];
    hunk.lines.forEach((line, idx) => {
      if (line.line_type === "addition" || line.line_type === "deletion") {
        allIndices.push(idx);
      }
    });
    if (allIndices.length > 0) {
      await revertCommitFileLines(commitHash, filePath, hunkIndex, allIndices);
    }
  }, [commitHash, filePath, hunkIndex, hunk.lines, revertCommitFileLines, showConfirm]);

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
    lastClickedRef.current = null;
  }, []);

  const hasSelection = selectedLines.size > 0;
  const hunkInfo = hunk.header.split("@@").slice(0, 2).join("@@") + "@@";

  return (
    <div
      className={clsx("diff-hunk relative mb-px", hasSelection && "has-selection")}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="hunk-header bg-bg-selected/30 text-text-muted flex flex-wrap items-center justify-between gap-1 px-2 py-1 text-xs">
        <span className="hunk-info min-w-0 truncate font-mono">{hunkInfo.trim()}</span>
        {canRevert && (
          <div className="hunk-actions ml-auto flex shrink-0 gap-1">
            {hasSelection && (
              <button
                className="hunk-action border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded border px-2 py-px text-xs"
                onClick={handleRevertSelected}
              >
                Revert {selectedLines.size} line{selectedLines.size > 1 ? "s" : ""}
              </button>
            )}
            <button
              className="hunk-action border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded border px-2 py-px text-xs"
              onClick={handleRevertHunk}
            >
              Revert hunk
            </button>
            {hasSelection && (
              <button
                className="hunk-action secondary text-text-muted hover:bg-bg-hover rounded bg-transparent px-2 py-px text-xs"
                onClick={clearSelection}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
      <div className="hunk-lines bg-bg-primary table w-full min-w-max">
        {visibleLines.map((line) => {
          const isSelectable =
            canRevert && (line.line_type === "addition" || line.line_type === "deletion");
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
                isSelected && "selected outline-bg-selected outline outline-1 -outline-offset-1",
                hasSelection && isSelectable && !isSelected && "opacity-60"
              )}
              onMouseDown={(e) => handleMouseDown(line.originalIndex, line.line_type, e)}
              onMouseEnter={() => handleMouseEnter(line.originalIndex, line.line_type)}
            >
              <span className="line-number old bg-bg-secondary text-text-muted table-cell w-10 min-w-10 px-1 text-right select-none">
                {line.old_lineno ?? ""}
              </span>
              <span className="line-number new border-border bg-bg-secondary text-text-muted table-cell w-10 min-w-10 border-r px-1 text-right select-none">
                {line.new_lineno ?? ""}
              </span>
              <span
                className={clsx(
                  "line-prefix table-cell w-4 min-w-4 pl-1 select-none",
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

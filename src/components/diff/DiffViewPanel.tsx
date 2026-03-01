import { useCallback, useMemo } from "react";
import type { FileDiff } from "../../types";
import { DiffHunk } from "./DiffHunk";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";

interface DiffViewPanelProps {
  diff: FileDiff | null;
  loading: boolean;
  staged: boolean;
}

export function DiffViewPanel({ diff, loading, staged }: DiffViewPanelProps) {
  const stageHunk = useRepositoryStore((s) => s.stageHunk);
  const unstageHunk = useRepositoryStore((s) => s.unstageHunk);
  const stageLines = useRepositoryStore((s) => s.stageLines);
  const discardHunk = useRepositoryStore((s) => s.discardHunk);
  const discardLines = useRepositoryStore((s) => s.discardLines);
  const currentDiffPath = useRepositoryStore((s) => s.currentDiffPath);
  const currentDiffIsUntracked = useRepositoryStore((s) => s.currentDiffIsUntracked);
  const loadDiffHunk = useRepositoryStore((s) => s.loadDiffHunk);
  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const selectedCount = selectedFilePaths.size;

  const collapsedHunks = useMemo(
    () =>
      diff
        ? diff.hunks.reduce((acc, h, i) => {
            if (!h.is_loaded) acc.push(i);
            return acc;
          }, [] as number[])
        : [],
    [diff]
  );
  const hasCollapsedHunks = collapsedHunks.length > 0;

  const handleLoadHunk = useCallback(
    async (hunkIndex: number) => {
      if (!currentDiffPath) return;
      await loadDiffHunk(currentDiffPath, staged, hunkIndex, currentDiffIsUntracked || undefined);
    },
    [currentDiffPath, staged, currentDiffIsUntracked, loadDiffHunk]
  );

  const handleLoadAll = useCallback(async () => {
    if (!currentDiffPath || !diff) return;
    for (const idx of collapsedHunks) {
      await loadDiffHunk(currentDiffPath, staged, idx, currentDiffIsUntracked || undefined);
    }
  }, [currentDiffPath, diff, collapsedHunks, staged, currentDiffIsUntracked, loadDiffHunk]);

  if (loading) {
    return (
      <div className="diff-view-panel loading text-text-secondary flex h-full flex-col items-center justify-center">
        Loading diff...
      </div>
    );
  }

  if (selectedCount > 1) {
    return (
      <div className="diff-view-panel multi-select text-text-secondary flex h-full flex-col items-center justify-center">
        <div className="multi-select-message text-text-primary mb-2 text-lg font-medium">
          <span className="multi-select-count text-primary font-semibold">{selectedCount}</span>{" "}
          files selected
        </div>
        <div className="multi-select-hint text-text-muted text-xs">
          Select a single file to view its diff
        </div>
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="diff-view-panel empty text-text-secondary flex h-full flex-col items-center justify-center">
        Select a file to view its diff
      </div>
    );
  }

  if (diff.is_binary) {
    return (
      <div className="diff-view-panel binary flex h-full flex-col">
        <div className="diff-header border-border bg-bg-tertiary flex shrink-0 items-center border-b px-3 py-2">
          <span className="diff-path text-xs font-medium">{diff.path}</span>
        </div>
        <div className="binary-message text-text-secondary flex flex-1 items-center justify-center">
          Binary file - cannot display diff
        </div>
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="diff-view-panel empty flex h-full flex-col">
        <div className="diff-header border-border bg-bg-tertiary flex shrink-0 items-center border-b px-3 py-2">
          <span className="diff-path text-xs font-medium">{diff.path}</span>
        </div>
        <div className="no-changes text-text-secondary flex flex-1 items-center justify-center">
          No changes to display
        </div>
      </div>
    );
  }

  const handleHunkAction = async (hunkIndex: number) => {
    if (!currentDiffPath) return;

    if (staged) {
      await unstageHunk(currentDiffPath, hunkIndex);
    } else {
      await stageHunk(currentDiffPath, hunkIndex);
    }
  };

  const handleStageLines = async (hunkIndex: number, lineIndices: number[]) => {
    if (!currentDiffPath) return;
    await stageLines(currentDiffPath, hunkIndex, lineIndices);
  };

  const handleDiscardHunk = async (hunkIndex: number) => {
    if (!currentDiffPath) return;
    const confirmed = await showConfirm({
      title: "Discard hunk?",
      message: "This will permanently revert the changes in this hunk. This cannot be undone.",
      confirmLabel: "Discard",
    });
    if (confirmed) {
      await discardHunk(currentDiffPath, hunkIndex);
    }
  };

  const handleDiscardLines = async (hunkIndex: number, lineIndices: number[]) => {
    if (!currentDiffPath) return;
    const count = lineIndices.length;
    const confirmed = await showConfirm({
      title: `Discard ${count} line${count > 1 ? "s" : ""}?`,
      message: "This will permanently revert the selected changes. This cannot be undone.",
      confirmLabel: "Discard",
    });
    if (confirmed) {
      await discardLines(currentDiffPath, hunkIndex, lineIndices);
    }
  };

  const loadedLines = diff.hunks.reduce((sum, h) => sum + h.lines.length, 0);

  return (
    <div className="diff-view-panel flex h-full flex-col overflow-hidden">
      <div className="diff-header border-border bg-bg-tertiary flex shrink-0 items-center border-b px-3 py-2">
        <span className="diff-path text-xs font-medium">{diff.path}</span>
        <span className="diff-status text-text-secondary ml-2 text-xs">
          {staged ? "(staged)" : "(unstaged)"}
        </span>
      </div>
      {hasCollapsedHunks && (
        <div className="truncation-bar bg-bg-selected/30 text-text-secondary flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs">
          <span>
            Large file — showing {loadedLines} of {diff.total_lines} lines ({collapsedHunks.length}{" "}
            {collapsedHunks.length === 1 ? "hunk" : "hunks"} collapsed)
          </span>
          <button
            className="load-all-btn text-primary hover:text-primary/80 ml-auto font-medium"
            onClick={handleLoadAll}
          >
            Load All
          </button>
        </div>
      )}
      <div className="diff-content flex-1 overflow-y-auto font-mono text-xs leading-normal">
        {diff.hunks.map((hunk, index) =>
          hunk.is_loaded ? (
            <DiffHunk
              key={index}
              hunk={hunk}
              onAction={() => handleHunkAction(index)}
              onStageLines={(lineIndices) => handleStageLines(index, lineIndices)}
              actionLabel={staged ? "Unstage hunk" : "Stage hunk"}
              canSelectLines={!staged}
              onDiscardHunk={!staged ? () => handleDiscardHunk(index) : undefined}
              onDiscardLines={
                !staged ? (lineIndices) => handleDiscardLines(index, lineIndices) : undefined
              }
            />
          ) : (
            <div
              key={index}
              className="collapsed-hunk border-border bg-bg-tertiary/50 flex items-center gap-3 border-b px-3 py-2"
            >
              <span className="hunk-info text-text-muted truncate font-mono text-xs">
                {hunk.header.split("@@").slice(0, 2).join("@@") + "@@"}
              </span>
              <span className="text-text-muted text-xs">
                ~{hunk.old_lines + hunk.new_lines} lines
              </span>
              <button
                className="load-hunk-btn text-primary hover:text-primary/80 ml-auto text-xs font-medium"
                onClick={() => handleLoadHunk(index)}
              >
                Load hunk
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

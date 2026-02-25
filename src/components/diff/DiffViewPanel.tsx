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
  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const selectedCount = selectedFilePaths.size;

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

  return (
    <div className="diff-view-panel flex h-full flex-col overflow-hidden">
      <div className="diff-header border-border bg-bg-tertiary flex shrink-0 items-center border-b px-3 py-2">
        <span className="diff-path text-xs font-medium">{diff.path}</span>
        <span className="diff-status text-text-secondary ml-2 text-xs">
          {staged ? "(staged)" : "(unstaged)"}
        </span>
      </div>
      <div className="diff-content flex-1 overflow-y-auto font-mono text-xs leading-normal">
        {diff.hunks.map((hunk, index) => (
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
        ))}
      </div>
    </div>
  );
}

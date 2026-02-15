import type { FileDiff } from "../../types";
import { DiffHunk } from "./DiffHunk";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import "./DiffViewPanel.css";

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

  // Count selected files
  const selectedCount = selectedFilePaths.size;

  if (loading) {
    return <div className="diff-view-panel loading">Loading diff...</div>;
  }

  // Show multi-selection message when more than one file is selected
  if (selectedCount > 1) {
    return (
      <div className="diff-view-panel multi-select">
        <div className="multi-select-message">
          <span className="multi-select-count">{selectedCount}</span> files selected
        </div>
        <div className="multi-select-hint">Select a single file to view its diff</div>
      </div>
    );
  }

  if (!diff) {
    return <div className="diff-view-panel empty">Select a file to view its diff</div>;
  }

  if (diff.is_binary) {
    return (
      <div className="diff-view-panel binary">
        <div className="diff-header">
          <span className="diff-path">{diff.path}</span>
        </div>
        <div className="binary-message">Binary file - cannot display diff</div>
      </div>
    );
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="diff-view-panel empty">
        <div className="diff-header">
          <span className="diff-path">{diff.path}</span>
        </div>
        <div className="no-changes">No changes to display</div>
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
    <div className="diff-view-panel">
      <div className="diff-header">
        <span className="diff-path">{diff.path}</span>
        <span className="diff-status">{staged ? "(staged)" : "(unstaged)"}</span>
      </div>
      <div className="diff-content">
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

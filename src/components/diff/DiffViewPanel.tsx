import type { FileDiff } from "../../types";
import { DiffHunk } from "./DiffHunk";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
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
  const currentDiffPath = useRepositoryStore((s) => s.currentDiffPath);
  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);

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
          />
        ))}
      </div>
    </div>
  );
}

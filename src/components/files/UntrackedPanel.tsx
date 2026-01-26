import { useMemo, useCallback } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";
import "./UntrackedPanel.css";

interface UntrackedPanelProps {
  statuses: FileStatuses | null;
  loading: boolean;
}

export function UntrackedPanel({ statuses, loading }: UntrackedPanelProps) {
  const stageFile = useRepositoryStore((s) => s.stageFile);
  const stageFiles = useRepositoryStore((s) => s.stageFiles);
  const loadFileDiff = useRepositoryStore((s) => s.loadFileDiff);
  const deleteFile = useRepositoryStore((s) => s.deleteFile);

  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useSelectionStore((s) => s.toggleFileSelection);
  const clearFileSelection = useSelectionStore((s) => s.clearFileSelection);

  // Extract untracked safely for hooks - memoized to avoid new array on every render
  const untracked = useMemo(() => statuses?.untracked ?? [], [statuses?.untracked]);

  // All file paths for range selection
  const allUntrackedPaths = useMemo(() => untracked.map((f) => f.path), [untracked]);

  // Check selected files in this section
  const selectedUntrackedPaths = useMemo(
    () => allUntrackedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, false))),
    [allUntrackedPaths, selectedFilePaths]
  );

  // Handle file selection with modifiers
  const handleSelectWithModifiers = useCallback(
    (path: string, isCtrl: boolean, isShift: boolean) => {
      toggleFileSelection(path, false, isCtrl, isShift, allUntrackedPaths);
      loadFileDiff(path, false, true);
    },
    [allUntrackedPaths, toggleFileSelection, loadFileDiff]
  );

  // Early returns AFTER hooks
  if (loading && !statuses) {
    return null;
  }

  if (!statuses) {
    return null;
  }

  const handleStageAllUntracked = async () => {
    await stageFiles(allUntrackedPaths);
    clearFileSelection();
  };

  const handleStageSelected = async () => {
    if (selectedUntrackedPaths.length > 0) {
      await stageFiles(selectedUntrackedPaths);
      clearFileSelection();
    }
  };

  const handleClearSelection = () => {
    clearFileSelection();
  };

  const hasSelectedUntracked = selectedUntrackedPaths.length > 0;

  return (
    <div className="untracked-panel">
      <div className="section-header">
        <div className="section-header-title">
          <span className="section-title">Untracked</span>
          <span className="section-count">{untracked.length}</span>
        </div>
        <div className="section-actions">
          {hasSelectedUntracked && (
            <>
              <button
                className="section-action-btn"
                onClick={handleStageSelected}
                title="Stage selected files"
              >
                Stage Selected
              </button>
              <button
                className="section-action-btn secondary"
                onClick={handleClearSelection}
                title="Clear selection"
              >
                Clear
              </button>
            </>
          )}
          {untracked.length > 0 && (
            <button
              className="section-action-btn"
              onClick={handleStageAllUntracked}
              title="Stage all untracked files"
            >
              Stage All
            </button>
          )}
        </div>
      </div>
      <div className="section-content">
        {untracked.length === 0 ? (
          <div className="empty-section">No untracked files</div>
        ) : (
          untracked.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              isStaged={false}
              isUntracked
              isSelected={selectedFilePaths.has(makeSelectionKey(file.path, false))}
              onToggleStage={() => stageFile(file.path)}
              onSelect={() => loadFileDiff(file.path, false, true)}
              onSelectWithModifiers={handleSelectWithModifiers}
              onDoubleClick={() => stageFile(file.path)}
              onDelete={() => deleteFile(file.path)}
            />
          ))
        )}
      </div>
    </div>
  );
}

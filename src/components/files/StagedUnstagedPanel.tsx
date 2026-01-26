import { useMemo, useCallback } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";
import "./StagedUnstagedPanel.css";

interface StagedUnstagedPanelProps {
  statuses: FileStatuses | null;
  loading: boolean;
}

export function StagedUnstagedPanel({ statuses, loading }: StagedUnstagedPanelProps) {
  const stageFile = useRepositoryStore((s) => s.stageFile);
  const unstageFile = useRepositoryStore((s) => s.unstageFile);
  const stageFiles = useRepositoryStore((s) => s.stageFiles);
  const unstageFiles = useRepositoryStore((s) => s.unstageFiles);
  const loadFileDiff = useRepositoryStore((s) => s.loadFileDiff);
  const revertFile = useRepositoryStore((s) => s.revertFile);
  const deleteFile = useRepositoryStore((s) => s.deleteFile);

  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useSelectionStore((s) => s.toggleFileSelection);
  const clearFileSelection = useSelectionStore((s) => s.clearFileSelection);

  // Extract arrays safely for hooks - memoized to avoid new array on every render
  const staged = useMemo(() => statuses?.staged ?? [], [statuses?.staged]);
  const unstaged = useMemo(() => statuses?.unstaged ?? [], [statuses?.unstaged]);

  // All file paths for range selection
  const allStagedPaths = useMemo(() => staged.map((f) => f.path), [staged]);
  const allUnstagedPaths = useMemo(() => unstaged.map((f) => f.path), [unstaged]);

  // Check which sections have selected files
  const selectedStagedPaths = useMemo(
    () => allStagedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, true))),
    [allStagedPaths, selectedFilePaths]
  );
  const selectedUnstagedPaths = useMemo(
    () => allUnstagedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, false))),
    [allUnstagedPaths, selectedFilePaths]
  );

  // Handle file selection with modifiers
  const handleSelectWithModifiers = useCallback(
    (sectionPaths: string[], isStaged: boolean) =>
      (path: string, isCtrl: boolean, isShift: boolean) => {
        toggleFileSelection(path, isStaged, isCtrl, isShift, sectionPaths);
        // Also load the diff for the clicked file
        loadFileDiff(path, isStaged);
      },
    [toggleFileSelection, loadFileDiff]
  );

  // Early returns AFTER all hooks
  if (loading && !statuses) {
    return <div className="staged-unstaged-panel loading">Loading...</div>;
  }

  if (!statuses) {
    return <div className="staged-unstaged-panel empty">No repository open</div>;
  }

  const handleStageAll = async () => {
    await stageFiles(allUnstagedPaths);
    clearFileSelection();
  };

  const handleUnstageAll = async () => {
    await unstageFiles(allStagedPaths);
    clearFileSelection();
  };

  // Stage/unstage selected files
  const handleStageSelected = async () => {
    if (selectedUnstagedPaths.length > 0) {
      await stageFiles(selectedUnstagedPaths);
      clearFileSelection();
    }
  };

  const handleUnstageSelected = async () => {
    if (selectedStagedPaths.length > 0) {
      await unstageFiles(selectedStagedPaths);
      clearFileSelection();
    }
  };

  const handleClearStagedSelection = () => {
    // Clear only staged file selections
    selectedStagedPaths.forEach(() => {
      // We need to clear only selections in the staged section
    });
    clearFileSelection();
  };

  const handleClearUnstagedSelection = () => {
    clearFileSelection();
  };

  const hasSelectedUnstaged = selectedUnstagedPaths.length > 0;
  const hasSelectedStaged = selectedStagedPaths.length > 0;

  return (
    <div className="staged-unstaged-panel">
      {/* Staged changes section */}
      <div className="file-section">
        <div className="section-header">
          <div className="section-header-title">
            <span className="section-title">Staged</span>
            <span className="section-count">{staged.length}</span>
          </div>
          <div className="section-actions">
            {hasSelectedStaged && (
              <>
                <button
                  className="section-action-btn"
                  onClick={handleUnstageSelected}
                  title="Unstage selected files"
                >
                  Unstage Selected
                </button>
                <button
                  className="section-action-btn secondary"
                  onClick={handleClearStagedSelection}
                  title="Clear selection"
                >
                  Clear
                </button>
              </>
            )}
            {staged.length > 0 && (
              <button
                className="section-action-btn"
                onClick={handleUnstageAll}
                title="Unstage all changes"
              >
                Unstage All
              </button>
            )}
          </div>
        </div>
        <div className="section-content">
          {staged.length === 0 ? (
            <div className="empty-section">No staged changes</div>
          ) : (
            staged.map((file) => (
              <FileItem
                key={file.path}
                file={file}
                isStaged={true}
                isSelected={selectedFilePaths.has(makeSelectionKey(file.path, true))}
                onToggleStage={() => unstageFile(file.path)}
                onSelect={() => loadFileDiff(file.path, true)}
                onSelectWithModifiers={handleSelectWithModifiers(allStagedPaths, true)}
                onDoubleClick={() => unstageFile(file.path)}
                onRevert={() => unstageFile(file.path)}
              />
            ))
          )}
        </div>
      </div>

      {/* Unstaged changes section */}
      <div className="file-section">
        <div className="section-header">
          <div className="section-header-title">
            <span className="section-title">Unstaged</span>
            <span className="section-count">{unstaged.length}</span>
          </div>
          <div className="section-actions">
            {hasSelectedUnstaged && (
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
                  onClick={handleClearUnstagedSelection}
                  title="Clear selection"
                >
                  Clear
                </button>
              </>
            )}
            {unstaged.length > 0 && (
              <button
                className="section-action-btn"
                onClick={handleStageAll}
                title="Stage all changes"
              >
                Stage All
              </button>
            )}
          </div>
        </div>
        <div className="section-content">
          {unstaged.length === 0 ? (
            <div className="empty-section">No unstaged changes</div>
          ) : (
            unstaged.map((file) => (
              <FileItem
                key={file.path}
                file={file}
                isStaged={false}
                isSelected={selectedFilePaths.has(makeSelectionKey(file.path, false))}
                onToggleStage={() => stageFile(file.path)}
                onSelect={() => loadFileDiff(file.path, false)}
                onSelectWithModifiers={handleSelectWithModifiers(allUnstagedPaths, false)}
                onDoubleClick={() => stageFile(file.path)}
                onRevert={() => revertFile(file.path)}
                onDelete={() => deleteFile(file.path)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

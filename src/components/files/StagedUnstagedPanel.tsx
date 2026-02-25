import { useMemo, useCallback } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";

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

  const staged = useMemo(() => statuses?.staged ?? [], [statuses?.staged]);
  const unstaged = useMemo(() => statuses?.unstaged ?? [], [statuses?.unstaged]);

  const allStagedPaths = useMemo(() => staged.map((f) => f.path), [staged]);
  const allUnstagedPaths = useMemo(() => unstaged.map((f) => f.path), [unstaged]);

  const selectedStagedPaths = useMemo(
    () => allStagedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, true))),
    [allStagedPaths, selectedFilePaths]
  );
  const selectedUnstagedPaths = useMemo(
    () => allUnstagedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, false))),
    [allUnstagedPaths, selectedFilePaths]
  );

  const handleSelectWithModifiers = useCallback(
    (sectionPaths: string[], isStaged: boolean) =>
      (path: string, isCtrl: boolean, isShift: boolean) => {
        toggleFileSelection(path, isStaged, isCtrl, isShift, sectionPaths);
        loadFileDiff(path, isStaged);
      },
    [toggleFileSelection, loadFileDiff]
  );

  if (loading && !statuses) {
    return (
      <div className="staged-unstaged-panel loading text-text-muted flex h-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!statuses) {
    return (
      <div className="staged-unstaged-panel empty text-text-muted flex h-full items-center justify-center">
        No repository open
      </div>
    );
  }

  const handleStageAll = async () => {
    await stageFiles(allUnstagedPaths);
    clearFileSelection();
  };

  const handleUnstageAll = async () => {
    await unstageFiles(allStagedPaths);
    clearFileSelection();
  };

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
    clearFileSelection();
  };

  const handleClearUnstagedSelection = () => {
    clearFileSelection();
  };

  const hasSelectedUnstaged = selectedUnstagedPaths.length > 0;
  const hasSelectedStaged = selectedStagedPaths.length > 0;

  return (
    <div className="staged-unstaged-panel flex h-full flex-col overflow-hidden">
      {/* Staged changes section */}
      <div className="file-section flex min-h-15 flex-1 flex-col overflow-hidden">
        <div className="section-header border-border bg-bg-tertiary text-text-secondary flex shrink-0 flex-col items-start border-b px-3 py-1 text-xs">
          <div className="section-header-title flex w-full items-center gap-2">
            <span className="section-title font-medium">Staged</span>
            <span className="section-count bg-bg-hover ml-auto rounded-full px-1.5 py-px text-xs">
              {staged.length}
            </span>
          </div>
          <div className="section-actions mt-1 flex min-h-6 items-center gap-1">
            {hasSelectedStaged && (
              <>
                <button
                  className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
                  onClick={handleUnstageSelected}
                  title="Unstage selected files"
                >
                  Unstage Selected
                </button>
                <button
                  className="section-action-btn secondary border-border text-text-secondary hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
                  onClick={handleClearStagedSelection}
                  title="Clear selection"
                >
                  Clear
                </button>
              </>
            )}
            {staged.length > 0 && (
              <button
                className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
                onClick={handleUnstageAll}
                title="Unstage all changes"
              >
                Unstage All
              </button>
            )}
          </div>
        </div>
        <div className="section-content min-h-0 flex-1 overflow-y-auto">
          {staged.length === 0 ? (
            <div className="empty-section text-text-muted p-4 text-center text-xs">
              No staged changes
            </div>
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
                extraMenuItems={[{ label: "Unstage", onClick: () => unstageFile(file.path) }]}
              />
            ))
          )}
        </div>
      </div>

      {/* Unstaged changes section */}
      <div className="file-section flex min-h-15 flex-1 flex-col overflow-hidden">
        <div className="section-header border-border bg-bg-tertiary text-text-secondary flex shrink-0 flex-col items-start border-b px-3 py-1 text-xs">
          <div className="section-header-title flex w-full items-center gap-2">
            <span className="section-title font-medium">Unstaged</span>
            <span className="section-count bg-bg-hover ml-auto rounded-full px-1.5 py-px text-xs">
              {unstaged.length}
            </span>
          </div>
          <div className="section-actions mt-1 flex min-h-6 items-center gap-1">
            {hasSelectedUnstaged && (
              <>
                <button
                  className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
                  onClick={handleStageSelected}
                  title="Stage selected files"
                >
                  Stage Selected
                </button>
                <button
                  className="section-action-btn secondary border-border text-text-secondary hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
                  onClick={handleClearUnstagedSelection}
                  title="Clear selection"
                >
                  Clear
                </button>
              </>
            )}
            {unstaged.length > 0 && (
              <button
                className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
                onClick={handleStageAll}
                title="Stage all changes"
              >
                Stage All
              </button>
            )}
          </div>
        </div>
        <div className="section-content min-h-0 flex-1 overflow-y-auto">
          {unstaged.length === 0 ? (
            <div className="empty-section text-text-muted p-4 text-center text-xs">
              No unstaged changes
            </div>
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
                extraMenuItems={[
                  { label: "Discard changes", onClick: () => revertFile(file.path) },
                  { label: "Delete file", onClick: () => deleteFile(file.path) },
                ]}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useCallback } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";

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

  const untracked = useMemo(() => statuses?.untracked ?? [], [statuses?.untracked]);
  const allUntrackedPaths = useMemo(() => untracked.map((f) => f.path), [untracked]);

  const selectedUntrackedPaths = useMemo(
    () => allUntrackedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, false))),
    [allUntrackedPaths, selectedFilePaths]
  );

  const handleSelectWithModifiers = useCallback(
    (path: string, isCtrl: boolean, isShift: boolean) => {
      toggleFileSelection(path, false, isCtrl, isShift, allUntrackedPaths);
      loadFileDiff(path, false, true);
    },
    [allUntrackedPaths, toggleFileSelection, loadFileDiff]
  );

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
    <div className="untracked-panel border-border flex h-full flex-col overflow-hidden border-t">
      <div className="section-header border-border bg-bg-tertiary text-text-secondary flex shrink-0 flex-col items-start border-b px-3 py-1 text-xs">
        <div className="section-header-title flex w-full items-center gap-2">
          <span className="section-title font-medium">Untracked</span>
          <span className="section-count bg-bg-hover ml-auto rounded-full px-1.5 py-px text-xs">
            {untracked.length}
          </span>
        </div>
        <div className="section-actions mt-1 flex min-h-6 items-center gap-1">
          {hasSelectedUntracked && (
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
                onClick={handleClearSelection}
                title="Clear selection"
              >
                Clear
              </button>
            </>
          )}
          {untracked.length > 0 && (
            <button
              className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover rounded border bg-transparent px-2 py-px text-xs transition-all duration-150"
              onClick={handleStageAllUntracked}
              title="Stage all untracked files"
            >
              Stage All
            </button>
          )}
        </div>
      </div>
      <div className="section-content min-h-0 flex-1 overflow-y-auto">
        {untracked.length === 0 ? (
          <div className="empty-section text-text-muted p-4 text-center text-xs">
            No untracked files
          </div>
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
              extraMenuItems={[{ label: "Delete file", onClick: () => deleteFile(file.path) }]}
            />
          ))
        )}
      </div>
    </div>
  );
}

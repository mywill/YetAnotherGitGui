import { useMemo, useCallback } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";
import { YaggButton } from "../common/YaggButton";
import { KeyboardList } from "../common/KeyboardList";

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
  const selectSingleFile = useSelectionStore((s) => s.selectSingleFile);
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
                <YaggButton
                  className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover bg-transparent px-2 py-px text-xs"
                  onClick={handleUnstageSelected}
                  title="Unstage selected files"
                >
                  Unstage Selected
                </YaggButton>
                <YaggButton
                  variant="outline"
                  className="section-action-btn secondary px-2 py-px text-xs"
                  onClick={handleClearStagedSelection}
                  title="Clear selection"
                >
                  Clear
                </YaggButton>
              </>
            )}
            {staged.length > 0 && (
              <YaggButton
                className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover bg-transparent px-2 py-px text-xs"
                onClick={handleUnstageAll}
                title="Unstage all changes"
              >
                Unstage All
              </YaggButton>
            )}
          </div>
        </div>
        <div className="section-content min-h-0 flex-1 overflow-y-auto">
          {staged.length === 0 ? (
            <div className="empty-section text-text-muted p-4 text-center text-xs">
              No staged changes
            </div>
          ) : (
            <KeyboardList
              aria-label="Staged files"
              onActiveChange={(i, isShift) => {
                if (isShift) {
                  toggleFileSelection(staged[i].path, true, false, true, allStagedPaths);
                } else {
                  selectSingleFile(staged[i].path, true);
                }
                loadFileDiff(staged[i].path, true);
              }}
              onActivate={(i) => unstageFile(staged[i].path)}
              onSecondaryActivate={(i) => unstageFile(staged[i].path)}
            >
              {staged.map((file, i) => (
                <KeyboardList.Item key={file.path} index={i}>
                  <FileItem
                    file={file}
                    isStaged={true}
                    isSelected={selectedFilePaths.has(makeSelectionKey(file.path, true))}
                    onToggleStage={() => unstageFile(file.path)}
                    onSelect={() => loadFileDiff(file.path, true)}
                    onSelectWithModifiers={handleSelectWithModifiers(allStagedPaths, true)}
                    onDoubleClick={() => unstageFile(file.path)}
                    extraMenuItems={[{ label: "Unstage", onClick: () => unstageFile(file.path) }]}
                  />
                </KeyboardList.Item>
              ))}
            </KeyboardList>
          )}
        </div>
      </div>

      {/* Unstaged changes section */}
      <div className="file-section flex min-h-15 flex-1 flex-col overflow-hidden">
        <div className="section-header border-border bg-bg-tertiary text-text-secondary flex shrink-0 flex-col items-start border-b px-3 py-1 text-xs">
          <div className="section-header-title flex w-full items-center gap-2">
            <span className="section-title font-medium">Unstaged</span>
            <span className="text-text-secondary ml-1 text-xs">(Del to discard)</span>
            <span className="section-count bg-bg-hover ml-auto rounded-full px-1.5 py-px text-xs">
              {unstaged.length}
            </span>
          </div>
          <div className="section-actions mt-1 flex min-h-6 items-center gap-1">
            {hasSelectedUnstaged && (
              <>
                <YaggButton
                  className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover bg-transparent px-2 py-px text-xs"
                  onClick={handleStageSelected}
                  title="Stage selected files"
                >
                  Stage Selected
                </YaggButton>
                <YaggButton
                  variant="outline"
                  className="section-action-btn secondary px-2 py-px text-xs"
                  onClick={handleClearUnstagedSelection}
                  title="Clear selection"
                >
                  Clear
                </YaggButton>
              </>
            )}
            {unstaged.length > 0 && (
              <YaggButton
                className="section-action-btn border-border text-text-secondary hover:border-text-muted hover:bg-bg-hover bg-transparent px-2 py-px text-xs"
                onClick={handleStageAll}
                title="Stage all changes"
              >
                Stage All
              </YaggButton>
            )}
          </div>
        </div>
        <div className="section-content min-h-0 flex-1 overflow-y-auto">
          {unstaged.length === 0 ? (
            <div className="empty-section text-text-muted p-4 text-center text-xs">
              No unstaged changes
            </div>
          ) : (
            <KeyboardList
              aria-label="Unstaged files"
              onActiveChange={(i, isShift) => {
                if (isShift) {
                  toggleFileSelection(unstaged[i].path, false, false, true, allUnstagedPaths);
                } else {
                  selectSingleFile(unstaged[i].path, false);
                }
                loadFileDiff(unstaged[i].path, false);
              }}
              onActivate={(i) => stageFile(unstaged[i].path)}
              onSecondaryActivate={(i) => stageFile(unstaged[i].path)}
              onDelete={(i) => revertFile(unstaged[i].path)}
            >
              {unstaged.map((file, i) => (
                <KeyboardList.Item key={file.path} index={i}>
                  <FileItem
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
                </KeyboardList.Item>
              ))}
            </KeyboardList>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useCallback } from "react";
import { IconPlus, IconTrash, IconDeselect } from "@tabler/icons-react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";
import { KeyboardList } from "../common/KeyboardList";
import { SectionHeader, SectionActionButton } from "./SectionHeader";
import { getConflictMenuItems, getUnstagedFileMenuItems } from "./unstagedMenuItems";

interface UnstagedPanelProps {
  statuses: FileStatuses | null;
  loading: boolean;
}

export function UnstagedPanel({ statuses, loading }: UnstagedPanelProps) {
  const stageFile = useRepositoryStore((s) => s.stageFile);
  const stageFiles = useRepositoryStore((s) => s.stageFiles);
  const loadFileDiff = useRepositoryStore((s) => s.loadFileDiff);
  const revertFile = useRepositoryStore((s) => s.revertFile);
  const deleteFile = useRepositoryStore((s) => s.deleteFile);
  const deleteFiles = useRepositoryStore((s) => s.deleteFiles);
  const resolveConflict = useRepositoryStore((s) => s.resolveConflict);

  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useSelectionStore((s) => s.toggleFileSelection);
  const selectSingleFile = useSelectionStore((s) => s.selectSingleFile);
  const clearFileSelection = useSelectionStore((s) => s.clearFileSelection);

  const unstaged = useMemo(() => statuses?.unstaged ?? [], [statuses?.unstaged]);
  const allUnstagedPaths = useMemo(() => unstaged.map((f) => f.path), [unstaged]);

  const selectedUnstagedPaths = useMemo(
    () => allUnstagedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, false))),
    [allUnstagedPaths, selectedFilePaths]
  );

  const handleUnstagedSelectWithModifiers = useCallback(
    (path: string, isCtrl: boolean, isShift: boolean) => {
      toggleFileSelection(path, false, isCtrl, isShift, allUnstagedPaths);
      const file = unstaged.find((f) => f.path === path);
      const isConflicted = file?.status === "conflicted";
      loadFileDiff(path, false, undefined, isConflicted || undefined);
    },
    [toggleFileSelection, loadFileDiff, allUnstagedPaths, unstaged]
  );

  if (loading && !statuses) {
    return (
      <div className="unstaged-panel text-text-muted flex h-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!statuses) {
    return (
      <div className="unstaged-panel text-text-muted flex h-full items-center justify-center">
        No repository open
      </div>
    );
  }

  const handleStageAll = async () => {
    await stageFiles(allUnstagedPaths);
    clearFileSelection();
  };

  const handleStageSelected = async () => {
    if (selectedUnstagedPaths.length > 0) {
      await stageFiles(selectedUnstagedPaths);
      clearFileSelection();
    }
  };

  const handleDeleteSelectedUnstaged = async () => {
    if (selectedUnstagedPaths.length > 0) {
      await deleteFiles(selectedUnstagedPaths);
      clearFileSelection();
    }
  };

  const hasSelectedUnstaged = selectedUnstagedPaths.length > 0;
  const selectedCount = selectedUnstagedPaths.length;

  return (
    <div className="unstaged-panel file-section flex h-full flex-col overflow-hidden">
      <SectionHeader
        title="Unstaged"
        hint="(Del to discard)"
        count={unstaged.length}
        actions={
          <>
            {hasSelectedUnstaged && (
              <>
                <SectionActionButton
                  onClick={handleStageSelected}
                  title={`Stage ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                  ariaLabel={`Stage ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                >
                  <IconPlus size={12} stroke={2} aria-hidden />
                  <span>{selectedCount}</span>
                </SectionActionButton>
                <SectionActionButton
                  onClick={handleDeleteSelectedUnstaged}
                  title={`Delete ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                  ariaLabel={`Delete ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                >
                  <IconTrash size={12} stroke={2} aria-hidden />
                  <span>{selectedCount}</span>
                </SectionActionButton>
                <SectionActionButton
                  onClick={clearFileSelection}
                  title="Clear selection"
                  ariaLabel="Clear selection"
                >
                  <IconDeselect size={12} stroke={2} aria-hidden />
                  <span>{selectedCount}</span>
                </SectionActionButton>
              </>
            )}
            {unstaged.length > 0 && (
              <SectionActionButton
                onClick={handleStageAll}
                title="Stage all changes"
                ariaLabel="Stage all unstaged files"
              >
                <IconPlus size={12} stroke={2} aria-hidden />
                <span>All</span>
              </SectionActionButton>
            )}
          </>
        }
      />
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
              const isConflicted = unstaged[i].status === "conflicted";
              loadFileDiff(unstaged[i].path, false, undefined, isConflicted || undefined);
            }}
            onActivate={(i) => stageFile(unstaged[i].path)}
            onSecondaryActivate={(i) => stageFile(unstaged[i].path)}
            onDelete={(i) => revertFile(unstaged[i].path)}
          >
            {unstaged.map((file, i) => {
              const isConflicted = file.status === "conflicted";
              const extraMenuItems = isConflicted
                ? getConflictMenuItems(file.path, { stageFile, resolveConflict })
                : getUnstagedFileMenuItems(file.path, selectedUnstagedPaths, {
                    revertFile,
                    deleteFile,
                    deleteFiles,
                  });
              return (
                <KeyboardList.Item key={file.path} index={i}>
                  <FileItem
                    file={file}
                    isStaged={false}
                    isSelected={selectedFilePaths.has(makeSelectionKey(file.path, false))}
                    onToggleStage={() => stageFile(file.path)}
                    onSelect={() =>
                      loadFileDiff(file.path, false, undefined, isConflicted || undefined)
                    }
                    onSelectWithModifiers={handleUnstagedSelectWithModifiers}
                    onDoubleClick={() => stageFile(file.path)}
                    extraMenuItems={extraMenuItems}
                  />
                </KeyboardList.Item>
              );
            })}
          </KeyboardList>
        )}
      </div>
    </div>
  );
}

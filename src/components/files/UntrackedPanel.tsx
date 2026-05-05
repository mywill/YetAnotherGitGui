import { useMemo, useCallback } from "react";
import { IconPlus, IconTrash, IconDeselect } from "@tabler/icons-react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";
import { KeyboardList } from "../common/KeyboardList";
import { SectionHeader, SectionActionButton } from "./SectionHeader";

interface UntrackedPanelProps {
  statuses: FileStatuses | null;
  loading: boolean;
}

export function UntrackedPanel({ statuses, loading }: UntrackedPanelProps) {
  const stageFile = useRepositoryStore((s) => s.stageFile);
  const stageFiles = useRepositoryStore((s) => s.stageFiles);
  const loadFileDiff = useRepositoryStore((s) => s.loadFileDiff);
  const deleteFile = useRepositoryStore((s) => s.deleteFile);
  const deleteFiles = useRepositoryStore((s) => s.deleteFiles);

  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useSelectionStore((s) => s.toggleFileSelection);
  const selectSingleFile = useSelectionStore((s) => s.selectSingleFile);
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

  const handleDeleteSelected = async () => {
    if (selectedUntrackedPaths.length > 0) {
      await deleteFiles(selectedUntrackedPaths);
      clearFileSelection();
    }
  };

  const handleClearSelection = () => {
    clearFileSelection();
  };

  const hasSelectedUntracked = selectedUntrackedPaths.length > 0;
  const selectedCount = selectedUntrackedPaths.length;

  return (
    <div className="untracked-panel flex h-full flex-col overflow-hidden">
      <SectionHeader
        title="Untracked"
        count={untracked.length}
        actions={
          <>
            {hasSelectedUntracked && (
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
                  onClick={handleDeleteSelected}
                  title={`Delete ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                  ariaLabel={`Delete ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                >
                  <IconTrash size={12} stroke={2} aria-hidden />
                  <span>{selectedCount}</span>
                </SectionActionButton>
                <SectionActionButton
                  onClick={handleClearSelection}
                  title="Clear selection"
                  ariaLabel="Clear selection"
                >
                  <IconDeselect size={12} stroke={2} aria-hidden />
                  <span>{selectedCount}</span>
                </SectionActionButton>
              </>
            )}
            {untracked.length > 0 && (
              <SectionActionButton
                onClick={handleStageAllUntracked}
                title="Stage all untracked files"
                ariaLabel="Stage all untracked files"
              >
                <IconPlus size={12} stroke={2} aria-hidden />
                <span>All</span>
              </SectionActionButton>
            )}
          </>
        }
      />
      <div className="section-content min-h-0 flex-1 overflow-y-auto">
        {untracked.length === 0 ? (
          <div className="empty-section text-text-muted p-4 text-center text-xs">
            No untracked files
          </div>
        ) : (
          <KeyboardList
            aria-label="Untracked files"
            onActiveChange={(i, isShift) => {
              if (isShift) {
                toggleFileSelection(untracked[i].path, false, false, true, allUntrackedPaths);
              } else {
                selectSingleFile(untracked[i].path, false);
              }
              loadFileDiff(untracked[i].path, false, true);
            }}
            onActivate={(i) => stageFile(untracked[i].path)}
            onSecondaryActivate={(i) => stageFile(untracked[i].path)}
            onDelete={(i) => {
              const focused = untracked[i].path;
              const inSelection =
                selectedUntrackedPaths.length > 1 && selectedUntrackedPaths.includes(focused);
              return inSelection ? deleteFiles(selectedUntrackedPaths) : deleteFile(focused);
            }}
          >
            {untracked.map((file, i) => {
              const inMultiSelection =
                selectedUntrackedPaths.length > 1 && selectedUntrackedPaths.includes(file.path);
              return (
                <KeyboardList.Item key={file.path} index={i}>
                  <FileItem
                    file={file}
                    isStaged={false}
                    isUntracked
                    isSelected={selectedFilePaths.has(makeSelectionKey(file.path, false))}
                    onToggleStage={() => stageFile(file.path)}
                    onSelect={() => loadFileDiff(file.path, false, true)}
                    onSelectWithModifiers={handleSelectWithModifiers}
                    onDoubleClick={() => stageFile(file.path)}
                    extraMenuItems={
                      inMultiSelection
                        ? [
                            {
                              label: `Delete ${selectedUntrackedPaths.length} files`,
                              onClick: () => deleteFiles(selectedUntrackedPaths),
                            },
                          ]
                        : [{ label: "Delete file", onClick: () => deleteFile(file.path) }]
                    }
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

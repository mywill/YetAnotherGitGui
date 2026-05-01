import { useMemo, useCallback } from "react";
import { IconMinus, IconDeselect } from "@tabler/icons-react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore, makeSelectionKey } from "../../stores/selectionStore";
import { YaggButton } from "../common/YaggButton";
import { KeyboardList } from "../common/KeyboardList";

const SECTION_ACTION_BTN =
  "section-action-btn border-border text-text-muted hover:border-text-muted hover:bg-bg-hover inline-flex h-6 items-center gap-1 bg-transparent px-2 text-xs";

interface StagedPanelProps {
  statuses: FileStatuses | null;
  loading: boolean;
}

export function StagedPanel({ statuses, loading }: StagedPanelProps) {
  const unstageFile = useRepositoryStore((s) => s.unstageFile);
  const unstageFiles = useRepositoryStore((s) => s.unstageFiles);
  const loadFileDiff = useRepositoryStore((s) => s.loadFileDiff);

  const selectedFilePaths = useSelectionStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useSelectionStore((s) => s.toggleFileSelection);
  const selectSingleFile = useSelectionStore((s) => s.selectSingleFile);
  const clearFileSelection = useSelectionStore((s) => s.clearFileSelection);

  const staged = useMemo(() => statuses?.staged ?? [], [statuses?.staged]);
  const allStagedPaths = useMemo(() => staged.map((f) => f.path), [staged]);

  const selectedStagedPaths = useMemo(
    () => allStagedPaths.filter((p) => selectedFilePaths.has(makeSelectionKey(p, true))),
    [allStagedPaths, selectedFilePaths]
  );

  const handleStagedSelectWithModifiers = useCallback(
    (path: string, isCtrl: boolean, isShift: boolean) => {
      toggleFileSelection(path, true, isCtrl, isShift, allStagedPaths);
      loadFileDiff(path, true);
    },
    [toggleFileSelection, loadFileDiff, allStagedPaths]
  );

  if (loading && !statuses) {
    return (
      <div className="staged-panel text-text-muted flex h-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!statuses) {
    return (
      <div className="staged-panel text-text-muted flex h-full items-center justify-center">
        No repository open
      </div>
    );
  }

  const handleUnstageAll = async () => {
    await unstageFiles(allStagedPaths);
    clearFileSelection();
  };

  const handleUnstageSelected = async () => {
    if (selectedStagedPaths.length > 0) {
      await unstageFiles(selectedStagedPaths);
      clearFileSelection();
    }
  };

  const hasSelectedStaged = selectedStagedPaths.length > 0;
  const selectedCount = selectedStagedPaths.length;

  return (
    <div className="staged-panel file-section flex h-full flex-col overflow-hidden">
      <div className="section-header border-border bg-bg-well text-text-muted flex shrink-0 flex-col items-start border-b px-3 py-1 text-xs">
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
                className={SECTION_ACTION_BTN}
                onClick={handleUnstageSelected}
                title={`Unstage ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
                aria-label={`Unstage ${selectedCount} selected file${selectedCount === 1 ? "" : "s"}`}
              >
                <IconMinus size={12} stroke={2} aria-hidden />
                <span>{selectedCount}</span>
              </YaggButton>
              <YaggButton
                className={SECTION_ACTION_BTN}
                onClick={clearFileSelection}
                title="Clear selection"
                aria-label="Clear selection"
              >
                <IconDeselect size={12} stroke={2} aria-hidden />
                <span>{selectedCount}</span>
              </YaggButton>
            </>
          )}
          {staged.length > 0 && (
            <YaggButton
              className={SECTION_ACTION_BTN}
              onClick={handleUnstageAll}
              title="Unstage all changes"
              aria-label="Unstage all staged files"
            >
              <IconMinus size={12} stroke={2} aria-hidden />
              <span>All</span>
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
                  onSelectWithModifiers={handleStagedSelectWithModifiers}
                  onDoubleClick={() => unstageFile(file.path)}
                  extraMenuItems={[{ label: "Unstage", onClick: () => unstageFile(file.path) }]}
                />
              </KeyboardList.Item>
            ))}
          </KeyboardList>
        )}
      </div>
    </div>
  );
}

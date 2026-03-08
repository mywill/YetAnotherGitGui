import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { YaggButton } from "../common/YaggButton";
import { KeyboardList } from "../common/KeyboardList";

interface FileChangesPanelProps {
  statuses: FileStatuses | null;
  loading: boolean;
}

const MIN_SECTION_HEIGHT = 60;
const UNTRACKED_HEIGHT = 80;

export function FileChangesPanel({ statuses, loading }: FileChangesPanelProps) {
  const [showStaged, setShowStaged] = useState(true);
  const [showUnstaged, setShowUnstaged] = useState(true);
  const [showUntracked, setShowUntracked] = useState(true);

  const [stagedHeight, setStagedHeight] = useState(120);
  const [unstagedHeight, setUnstagedHeight] = useState(200);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef<{
    section: "staged" | "unstaged";
    startY: number;
    startHeight: number;
  } | null>(null);

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;

    const delta = e.clientY - resizingRef.current.startY;
    const newHeight = Math.max(MIN_SECTION_HEIGHT, resizingRef.current.startHeight + delta);

    if (resizingRef.current.section === "staged") {
      setStagedHeight(newHeight);
    } else {
      setUnstagedHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startResize = (section: "staged" | "unstaged", e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      section,
      startY: e.clientY,
      startHeight: section === "staged" ? stagedHeight : unstagedHeight,
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const staged = useMemo(() => statuses?.staged ?? [], [statuses?.staged]);
  const unstaged = useMemo(() => statuses?.unstaged ?? [], [statuses?.unstaged]);
  const untracked = useMemo(() => statuses?.untracked ?? [], [statuses?.untracked]);

  const allStagedPaths = useMemo(() => staged.map((f) => f.path), [staged]);
  const allUnstagedPaths = useMemo(() => unstaged.map((f) => f.path), [unstaged]);
  const allUntrackedPaths = useMemo(() => untracked.map((f) => f.path), [untracked]);

  const selectedStagedPaths = useMemo(
    () => allStagedPaths.filter((p) => selectedFilePaths.has(p)),
    [allStagedPaths, selectedFilePaths]
  );
  const selectedUnstagedPaths = useMemo(
    () => allUnstagedPaths.filter((p) => selectedFilePaths.has(p)),
    [allUnstagedPaths, selectedFilePaths]
  );
  const selectedUntrackedPaths = useMemo(
    () => allUntrackedPaths.filter((p) => selectedFilePaths.has(p)),
    [allUntrackedPaths, selectedFilePaths]
  );

  const handleSelectWithModifiers = useCallback(
    (sectionPaths: string[], isStaged: boolean) =>
      (path: string, isCtrl: boolean, isShift: boolean) => {
        toggleFileSelection(path, isStaged, isCtrl, isShift, sectionPaths);
        const file = [...staged, ...unstaged, ...untracked].find((f) => f.path === path);
        if (file) {
          const isFileStaged = staged.some((f) => f.path === path);
          loadFileDiff(path, isFileStaged);
        }
      },
    [staged, unstaged, untracked, toggleFileSelection, loadFileDiff]
  );

  if (loading && !statuses) {
    return (
      <div className="file-changes-panel loading text-text-secondary flex h-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!statuses) {
    return (
      <div className="file-changes-panel empty text-text-secondary flex h-full items-center justify-center">
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

  const handleStageAllUntracked = async () => {
    await stageFiles(allUntrackedPaths);
    clearFileSelection();
  };

  const handleStageSelected = async () => {
    const pathsToStage = [...selectedUnstagedPaths, ...selectedUntrackedPaths];
    if (pathsToStage.length > 0) {
      await stageFiles(pathsToStage);
      clearFileSelection();
    }
  };

  const handleUnstageSelected = async () => {
    if (selectedStagedPaths.length > 0) {
      await unstageFiles(selectedStagedPaths);
      clearFileSelection();
    }
  };

  const hasSelectedUnstagedOrUntracked =
    selectedUnstagedPaths.length > 0 || selectedUntrackedPaths.length > 0;
  const hasSelectedStaged = selectedStagedPaths.length > 0;

  return (
    <div className="file-changes-panel flex h-full flex-col overflow-y-auto" ref={containerRef}>
      {/* Selection action bar */}
      {(hasSelectedUnstagedOrUntracked || hasSelectedStaged) && (
        <div className="selection-actions border-primary bg-bg-selected flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <span className="selection-count text-text-primary mr-auto text-xs font-medium">
            {selectedFilePaths.size} file{selectedFilePaths.size !== 1 ? "s" : ""} selected
          </span>
          {hasSelectedUnstagedOrUntracked && (
            <YaggButton
              variant="selection"
              className="selection-action-btn px-2.5 py-1 text-xs"
              onClick={handleStageSelected}
            >
              Stage Selected
            </YaggButton>
          )}
          {hasSelectedStaged && (
            <YaggButton
              variant="selection"
              className="selection-action-btn px-2.5 py-1 text-xs"
              onClick={handleUnstageSelected}
            >
              Unstage Selected
            </YaggButton>
          )}
          <YaggButton
            variant="outline"
            className="selection-action-btn secondary px-2.5 py-1 text-xs"
            onClick={clearFileSelection}
          >
            Clear Selection
          </YaggButton>
        </div>
      )}

      {/* Staged changes section */}
      <div
        className="file-section flex shrink-0 flex-col overflow-hidden"
        style={{ height: showStaged ? stagedHeight : "auto" }}
      >
        <button
          type="button"
          className="section-header clickable bg-bg-tertiary hover:bg-bg-hover flex w-full cursor-pointer items-center px-3 py-2 transition-colors duration-100 select-none"
          onClick={() => setShowStaged(!showStaged)}
          aria-expanded={showStaged}
        >
          <span className="toggle-icon text-text-secondary text-2xs w-4">
            {showStaged ? "▼" : "▶"}
          </span>
          <span className="section-title flex-1 text-left text-xs font-medium">Staged</span>
          <span className="section-count bg-bg-primary text-text-secondary mr-auto rounded-full px-1.5 py-px text-xs">
            {staged.length}
          </span>
          {staged.length > 0 && (
            <YaggButton
              variant="ghost"
              className="section-action-btn ml-2 px-2 py-px text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleUnstageAll();
              }}
              title="Unstage all changes"
            >
              Unstage All
            </YaggButton>
          )}
        </button>
        {showStaged && (
          <div className="section-content flex flex-1 flex-col overflow-y-auto">
            {staged.length === 0 ? (
              <div className="empty-section text-text-muted flex flex-1 items-center justify-center text-xs">
                No staged changes
              </div>
            ) : (
              <KeyboardList
                aria-label="Staged files"
                onActivate={(i) => loadFileDiff(staged[i].path, true)}
                onSecondaryActivate={(i) => unstageFile(staged[i].path)}
              >
                {staged.map((file, i) => (
                  <KeyboardList.Item key={file.path} index={i}>
                    <FileItem
                      file={file}
                      isStaged={true}
                      isSelected={selectedFilePaths.has(file.path)}
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
        )}
      </div>

      {showStaged && (
        <div
          className="section-resizer bg-border hover:bg-primary h-1 shrink-0 cursor-row-resize transition-colors duration-100"
          onMouseDown={(e) => startResize("staged", e)}
        />
      )}

      {/* Unstaged changes section */}
      <div
        className="file-section flex shrink-0 flex-col overflow-hidden"
        style={{ height: showUnstaged ? unstagedHeight : "auto" }}
      >
        <button
          type="button"
          className="section-header clickable bg-bg-tertiary hover:bg-bg-hover flex w-full cursor-pointer items-center px-3 py-2 transition-colors duration-100 select-none"
          onClick={() => setShowUnstaged(!showUnstaged)}
          aria-expanded={showUnstaged}
        >
          <span className="toggle-icon text-text-secondary text-2xs w-4">
            {showUnstaged ? "▼" : "▶"}
          </span>
          <span className="section-title flex-1 text-left text-xs font-medium">Unstaged</span>
          <span className="text-text-secondary text-xs">(Del to discard)</span>
          <span className="section-count bg-bg-primary text-text-secondary mr-auto rounded-full px-1.5 py-px text-xs">
            {unstaged.length}
          </span>
          {unstaged.length > 0 && (
            <YaggButton
              variant="ghost"
              className="section-action-btn ml-2 px-2 py-px text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleStageAll();
              }}
              title="Stage all changes"
            >
              Stage All
            </YaggButton>
          )}
        </button>
        {showUnstaged && (
          <div className="section-content flex flex-1 flex-col overflow-y-auto">
            {unstaged.length === 0 ? (
              <div className="empty-section text-text-muted flex flex-1 items-center justify-center text-xs">
                No unstaged changes
              </div>
            ) : (
              <KeyboardList
                aria-label="Unstaged files"
                onActivate={(i) => loadFileDiff(unstaged[i].path, false)}
                onSecondaryActivate={(i) => stageFile(unstaged[i].path)}
                onDelete={(i) => revertFile(unstaged[i].path)}
              >
                {unstaged.map((file, i) => (
                  <KeyboardList.Item key={file.path} index={i}>
                    <FileItem
                      file={file}
                      isStaged={false}
                      isSelected={selectedFilePaths.has(file.path)}
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
        )}
      </div>

      {showUnstaged && (
        <div
          className="section-resizer bg-border hover:bg-primary h-1 shrink-0 cursor-row-resize transition-colors duration-100"
          onMouseDown={(e) => startResize("unstaged", e)}
        />
      )}

      {/* Untracked files section */}
      <div
        className="file-section flex shrink-0 flex-col overflow-hidden"
        style={{
          height: showUntracked ? UNTRACKED_HEIGHT : "auto",
          flex: showUntracked ? "none" : undefined,
        }}
      >
        <button
          type="button"
          className="section-header clickable bg-bg-tertiary hover:bg-bg-hover flex w-full cursor-pointer items-center px-3 py-2 transition-colors duration-100 select-none"
          onClick={() => setShowUntracked(!showUntracked)}
          aria-expanded={showUntracked}
        >
          <span className="toggle-icon text-text-secondary text-2xs w-4">
            {showUntracked ? "▼" : "▶"}
          </span>
          <span className="section-title flex-1 text-left text-xs font-medium">Untracked</span>
          <span className="text-text-secondary text-xs">(Del to delete)</span>
          <span className="section-count bg-bg-primary text-text-secondary mr-auto rounded-full px-1.5 py-px text-xs">
            {untracked.length}
          </span>
          {untracked.length > 0 && (
            <YaggButton
              variant="ghost"
              className="section-action-btn ml-2 px-2 py-px text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleStageAllUntracked();
              }}
              title="Stage all untracked files"
            >
              Stage All
            </YaggButton>
          )}
        </button>
        {showUntracked && (
          <div className="section-content flex flex-1 flex-col overflow-y-auto">
            {untracked.length === 0 ? (
              <div className="empty-section text-text-muted flex flex-1 items-center justify-center text-xs">
                No untracked files
              </div>
            ) : (
              <KeyboardList
                aria-label="Untracked files"
                onActivate={(i) => loadFileDiff(untracked[i].path, false)}
                onSecondaryActivate={(i) => stageFile(untracked[i].path)}
                onDelete={(i) => deleteFile(untracked[i].path)}
              >
                {untracked.map((file, i) => (
                  <KeyboardList.Item key={file.path} index={i}>
                    <FileItem
                      file={file}
                      isStaged={false}
                      isUntracked
                      isSelected={selectedFilePaths.has(file.path)}
                      onToggleStage={() => stageFile(file.path)}
                      onSelect={() => loadFileDiff(file.path, false)}
                      onSelectWithModifiers={handleSelectWithModifiers(allUntrackedPaths, false)}
                      onDoubleClick={() => stageFile(file.path)}
                      extraMenuItems={[
                        { label: "Delete file", onClick: () => deleteFile(file.path) },
                      ]}
                    />
                  </KeyboardList.Item>
                ))}
              </KeyboardList>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

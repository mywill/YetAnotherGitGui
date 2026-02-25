import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";

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
            <button
              className="selection-action-btn bg-primary hover:bg-primary-hover rounded border-none px-2.5 py-1 text-xs text-white transition-colors duration-100"
              onClick={handleStageSelected}
            >
              Stage Selected
            </button>
          )}
          {hasSelectedStaged && (
            <button
              className="selection-action-btn bg-primary hover:bg-primary-hover rounded border-none px-2.5 py-1 text-xs text-white transition-colors duration-100"
              onClick={handleUnstageSelected}
            >
              Unstage Selected
            </button>
          )}
          <button
            className="selection-action-btn secondary border-border text-text-secondary hover:bg-bg-hover rounded border bg-transparent px-2.5 py-1 text-xs transition-colors duration-100"
            onClick={clearFileSelection}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Staged changes section */}
      <div
        className="file-section flex shrink-0 flex-col overflow-hidden"
        style={{ height: showStaged ? stagedHeight : "auto" }}
      >
        <div
          className="section-header clickable bg-bg-tertiary hover:bg-bg-hover flex cursor-pointer items-center px-3 py-2 transition-colors duration-100 select-none"
          onClick={() => setShowStaged(!showStaged)}
        >
          <span className="toggle-icon text-text-secondary text-2xs w-4">
            {showStaged ? "▼" : "▶"}
          </span>
          <span className="section-title flex-1 text-xs font-medium">Staged</span>
          <span className="section-count bg-bg-primary text-text-secondary mr-auto rounded-full px-1.5 py-px text-xs">
            {staged.length}
          </span>
          {staged.length > 0 && (
            <button
              className="section-action-btn bg-bg-secondary hover:bg-bg-hover ml-2 rounded px-2 py-px text-xs transition-colors duration-100"
              onClick={(e) => {
                e.stopPropagation();
                handleUnstageAll();
              }}
              title="Unstage all changes"
            >
              Unstage All
            </button>
          )}
        </div>
        {showStaged && (
          <div className="section-content flex flex-1 flex-col overflow-y-auto">
            {staged.length === 0 ? (
              <div className="empty-section text-text-muted flex flex-1 items-center justify-center text-xs">
                No staged changes
              </div>
            ) : (
              staged.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  isStaged={true}
                  isSelected={selectedFilePaths.has(file.path)}
                  onToggleStage={() => unstageFile(file.path)}
                  onSelect={() => loadFileDiff(file.path, true)}
                  onSelectWithModifiers={handleSelectWithModifiers(allStagedPaths, true)}
                  onDoubleClick={() => unstageFile(file.path)}
                  extraMenuItems={[{ label: "Unstage", onClick: () => unstageFile(file.path) }]}
                />
              ))
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
        <div
          className="section-header clickable bg-bg-tertiary hover:bg-bg-hover flex cursor-pointer items-center px-3 py-2 transition-colors duration-100 select-none"
          onClick={() => setShowUnstaged(!showUnstaged)}
        >
          <span className="toggle-icon text-text-secondary text-2xs w-4">
            {showUnstaged ? "▼" : "▶"}
          </span>
          <span className="section-title flex-1 text-xs font-medium">Unstaged</span>
          <span className="section-count bg-bg-primary text-text-secondary mr-auto rounded-full px-1.5 py-px text-xs">
            {unstaged.length}
          </span>
          {unstaged.length > 0 && (
            <button
              className="section-action-btn bg-bg-secondary hover:bg-bg-hover ml-2 rounded px-2 py-px text-xs transition-colors duration-100"
              onClick={(e) => {
                e.stopPropagation();
                handleStageAll();
              }}
              title="Stage all changes"
            >
              Stage All
            </button>
          )}
        </div>
        {showUnstaged && (
          <div className="section-content flex flex-1 flex-col overflow-y-auto">
            {unstaged.length === 0 ? (
              <div className="empty-section text-text-muted flex flex-1 items-center justify-center text-xs">
                No unstaged changes
              </div>
            ) : (
              unstaged.map((file) => (
                <FileItem
                  key={file.path}
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
              ))
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
        <div
          className="section-header clickable bg-bg-tertiary hover:bg-bg-hover flex cursor-pointer items-center px-3 py-2 transition-colors duration-100 select-none"
          onClick={() => setShowUntracked(!showUntracked)}
        >
          <span className="toggle-icon text-text-secondary text-2xs w-4">
            {showUntracked ? "▼" : "▶"}
          </span>
          <span className="section-title flex-1 text-xs font-medium">Untracked</span>
          <span className="section-count bg-bg-primary text-text-secondary mr-auto rounded-full px-1.5 py-px text-xs">
            {untracked.length}
          </span>
          {untracked.length > 0 && (
            <button
              className="section-action-btn bg-bg-secondary hover:bg-bg-hover ml-2 rounded px-2 py-px text-xs transition-colors duration-100"
              onClick={(e) => {
                e.stopPropagation();
                handleStageAllUntracked();
              }}
              title="Stage all untracked files"
            >
              Stage All
            </button>
          )}
        </div>
        {showUntracked && (
          <div className="section-content flex flex-1 flex-col overflow-y-auto">
            {untracked.length === 0 ? (
              <div className="empty-section text-text-muted flex flex-1 items-center justify-center text-xs">
                No untracked files
              </div>
            ) : (
              untracked.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  isStaged={false}
                  isUntracked
                  isSelected={selectedFilePaths.has(file.path)}
                  onToggleStage={() => stageFile(file.path)}
                  onSelect={() => loadFileDiff(file.path, false)}
                  onSelectWithModifiers={handleSelectWithModifiers(allUntrackedPaths, false)}
                  onDoubleClick={() => stageFile(file.path)}
                  extraMenuItems={[{ label: "Delete file", onClick: () => deleteFile(file.path) }]}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

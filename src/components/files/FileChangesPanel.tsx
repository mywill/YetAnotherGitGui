import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { FileStatuses } from "../../types";
import { FileItem } from "./FileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import "./FileChangesPanel.css";

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

  // Adjusted defaults: Unstaged largest (200), Staged medium (120)
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

  // Extract arrays safely - memoized to avoid new array on every render
  const staged = useMemo(() => statuses?.staged ?? [], [statuses?.staged]);
  const unstaged = useMemo(() => statuses?.unstaged ?? [], [statuses?.unstaged]);
  const untracked = useMemo(() => statuses?.untracked ?? [], [statuses?.untracked]);

  // All file paths for range selection (in display order)
  const allStagedPaths = useMemo(() => staged.map((f) => f.path), [staged]);
  const allUnstagedPaths = useMemo(() => unstaged.map((f) => f.path), [unstaged]);
  const allUntrackedPaths = useMemo(() => untracked.map((f) => f.path), [untracked]);

  // Check which sections have selected files
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

  // Handle file selection with modifiers
  const handleSelectWithModifiers = useCallback(
    (sectionPaths: string[], isStaged: boolean) =>
      (path: string, isCtrl: boolean, isShift: boolean) => {
        toggleFileSelection(path, isStaged, isCtrl, isShift, sectionPaths);
        // Also load the diff for the clicked file
        const file = [...staged, ...unstaged, ...untracked].find((f) => f.path === path);
        if (file) {
          const isFileStaged = staged.some((f) => f.path === path);
          loadFileDiff(path, isFileStaged);
        }
      },
    [staged, unstaged, untracked, toggleFileSelection, loadFileDiff]
  );

  // Early returns for loading/empty states - AFTER all hooks
  if (loading && !statuses) {
    return <div className="file-changes-panel loading">Loading...</div>;
  }

  if (!statuses) {
    return <div className="file-changes-panel empty">No repository open</div>;
  }

  // Stage all unstaged files using batch method
  const handleStageAll = async () => {
    await stageFiles(allUnstagedPaths);
    clearFileSelection();
  };

  // Unstage all staged files using batch method
  const handleUnstageAll = async () => {
    await unstageFiles(allStagedPaths);
    clearFileSelection();
  };

  // Stage all untracked files using batch method
  const handleStageAllUntracked = async () => {
    await stageFiles(allUntrackedPaths);
    clearFileSelection();
  };

  // Stage/unstage selected files
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
    <div className="file-changes-panel" ref={containerRef}>
      {/* Selection action bar */}
      {(hasSelectedUnstagedOrUntracked || hasSelectedStaged) && (
        <div className="selection-actions">
          <span className="selection-count">
            {selectedFilePaths.size} file{selectedFilePaths.size !== 1 ? "s" : ""} selected
          </span>
          {hasSelectedUnstagedOrUntracked && (
            <button className="selection-action-btn" onClick={handleStageSelected}>
              Stage Selected
            </button>
          )}
          {hasSelectedStaged && (
            <button className="selection-action-btn" onClick={handleUnstageSelected}>
              Unstage Selected
            </button>
          )}
          <button className="selection-action-btn secondary" onClick={clearFileSelection}>
            Clear Selection
          </button>
        </div>
      )}

      {/* Staged changes section */}
      <div
        className="file-section"
        style={{ height: showStaged ? stagedHeight : "auto", flexShrink: 0 }}
      >
        <div className="section-header clickable" onClick={() => setShowStaged(!showStaged)}>
          <span className="toggle-icon">{showStaged ? "▼" : "▶"}</span>
          <span className="section-title">Staged</span>
          <span className="section-count">{staged.length}</span>
          {staged.length > 0 && (
            <button
              className="section-action-btn"
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
          <div className="section-content">
            {staged.length === 0 ? (
              <div className="empty-section">No staged changes</div>
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
                  onRevert={() => unstageFile(file.path)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Resizer between Staged and Unstaged */}
      {showStaged && (
        <div className="section-resizer" onMouseDown={(e) => startResize("staged", e)} />
      )}

      {/* Unstaged changes section */}
      <div
        className="file-section"
        style={{ height: showUnstaged ? unstagedHeight : "auto", flexShrink: 0 }}
      >
        <div className="section-header clickable" onClick={() => setShowUnstaged(!showUnstaged)}>
          <span className="toggle-icon">{showUnstaged ? "▼" : "▶"}</span>
          <span className="section-title">Unstaged</span>
          <span className="section-count">{unstaged.length}</span>
          {unstaged.length > 0 && (
            <button
              className="section-action-btn"
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
          <div className="section-content">
            {unstaged.length === 0 ? (
              <div className="empty-section">No unstaged changes</div>
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
                  onRevert={() => revertFile(file.path)}
                  onDelete={() => deleteFile(file.path)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Resizer between Unstaged and Untracked */}
      {showUnstaged && (
        <div className="section-resizer" onMouseDown={(e) => startResize("unstaged", e)} />
      )}

      {/* Untracked files section - fixed smaller height */}
      <div
        className="file-section"
        style={{
          height: showUntracked ? UNTRACKED_HEIGHT : "auto",
          flexShrink: 0,
          flex: showUntracked ? "none" : undefined,
        }}
      >
        <div className="section-header clickable" onClick={() => setShowUntracked(!showUntracked)}>
          <span className="toggle-icon">{showUntracked ? "▼" : "▶"}</span>
          <span className="section-title">Untracked</span>
          <span className="section-count">{untracked.length}</span>
          {untracked.length > 0 && (
            <button
              className="section-action-btn"
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
                  isSelected={selectedFilePaths.has(file.path)}
                  onToggleStage={() => stageFile(file.path)}
                  onSelect={() => loadFileDiff(file.path, false)}
                  onSelectWithModifiers={handleSelectWithModifiers(allUntrackedPaths, false)}
                  onDoubleClick={() => stageFile(file.path)}
                  onDelete={() => deleteFile(file.path)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

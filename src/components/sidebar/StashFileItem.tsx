import { useCallback } from "react";
import clsx from "clsx";
import type { CommitFileChange } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { CommitFileDiff } from "../history/CommitFileDiff";
import { STATUS_COLORS, getStatusLetter } from "../../utils/statusColors";

interface StashFileItemProps {
  file: CommitFileChange;
  stashIndex: number;
}

export function StashFileItem({ file, stashIndex }: StashFileItemProps) {
  const expandedStashFiles = useRepositoryStore((s) => s.expandedStashFiles);
  const stashFileDiffs = useRepositoryStore((s) => s.stashFileDiffs);
  const toggleStashFileExpanded = useRepositoryStore((s) => s.toggleStashFileExpanded);
  const loadStashFileDiff = useRepositoryStore((s) => s.loadStashFileDiff);

  const isExpanded = expandedStashFiles.has(file.path);
  const diff = stashFileDiffs.get(file.path);

  const handleClick = useCallback(() => {
    toggleStashFileExpanded(file.path);
    if (!isExpanded && !diff) {
      loadStashFileDiff(stashIndex, file.path);
    }
  }, [file.path, isExpanded, diff, toggleStashFileExpanded, loadStashFileDiff, stashIndex]);

  const statusIcon = getStatusLetter(file.status);
  const colors = STATUS_COLORS[file.status];

  // For renamed files, show the old path
  const displayPath = file.old_path ? `${file.old_path} → ${file.path}` : file.path;

  return (
    <div
      className={clsx(
        "stash-file-item border-border min-w-0 border-b last:border-b-0",
        isExpanded && "expanded"
      )}
    >
      <div
        className={clsx(
          "file-header hover:bg-bg-hover flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors duration-150",
          isExpanded && "bg-bg-well"
        )}
        onClick={handleClick}
      >
        <span className="expand-icon text-text-muted text-2xs w-3 shrink-0">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span
          className="status-icon flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold"
          style={
            colors
              ? { background: colors.bg, color: colors.color }
              : { background: "var(--color-bg-well)", color: "var(--color-text-muted)" }
          }
        >
          {statusIcon}
        </span>
        <span className="file-path text-text-primary flex-1 truncate font-mono" title={displayPath}>
          {displayPath}
        </span>
      </div>
      {isExpanded && (
        <div className="file-diff-container bg-bg-canvas max-h-96 overflow-auto">
          {diff ? (
            <CommitFileDiff diff={diff} />
          ) : (
            <div className="loading-diff text-text-muted p-3 text-center text-xs">
              Loading diff...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useCallback } from "react";
import clsx from "clsx";
import type { CommitFileChange } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { CommitFileDiff } from "../history/CommitFileDiff";

interface StashFileItemProps {
  file: CommitFileChange;
  stashIndex: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  added: { bg: "bg-status-added/20", text: "text-status-added" },
  deleted: { bg: "bg-status-deleted/20", text: "text-status-deleted" },
  modified: { bg: "bg-status-modified/20", text: "text-status-modified" },
  renamed: { bg: "bg-badge-branch/20", text: "text-badge-branch" },
  copied: { bg: "bg-badge-remote/20", text: "text-badge-remote" },
};

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

  const statusIcon = getStatusIcon(file.status);
  const colors = STATUS_COLORS[file.status] || { bg: "bg-bg-tertiary", text: "text-text-muted" };

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
          isExpanded && "bg-bg-tertiary"
        )}
        onClick={handleClick}
      >
        <span className="expand-icon text-text-muted text-2xs w-3 shrink-0">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span
          className={clsx(
            "status-icon flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold",
            colors.bg,
            colors.text
          )}
        >
          {statusIcon}
        </span>
        <span className="file-path text-text-primary flex-1 truncate" title={displayPath}>
          {displayPath}
        </span>
      </div>
      {isExpanded && (
        <div className="file-diff-container border-border bg-bg-primary max-h-96 overflow-auto border-t">
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

function getStatusIcon(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "modified":
      return "M";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    default:
      return "?";
  }
}

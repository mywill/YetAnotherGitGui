import { useCallback } from "react";
import clsx from "clsx";
import type { CommitFileChange } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { CommitFileDiff } from "./CommitFileDiff";

interface CommitFileItemProps {
  file: CommitFileChange;
  commitHash: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  added: {
    bg: "color-mix(in srgb, var(--color-status-added) 20%, transparent)",
    color: "var(--color-status-added)",
  },
  deleted: {
    bg: "color-mix(in srgb, var(--color-status-deleted) 20%, transparent)",
    color: "var(--color-status-deleted)",
  },
  modified: {
    bg: "color-mix(in srgb, var(--color-status-modified) 20%, transparent)",
    color: "var(--color-status-modified)",
  },
  renamed: {
    bg: "color-mix(in srgb, var(--color-badge-branch) 20%, transparent)",
    color: "var(--color-badge-branch)",
  },
  copied: {
    bg: "color-mix(in srgb, var(--color-badge-remote) 20%, transparent)",
    color: "var(--color-badge-remote)",
  },
};

export function CommitFileItem({ file, commitHash }: CommitFileItemProps) {
  const expandedCommitFiles = useRepositoryStore((s) => s.expandedCommitFiles);
  const commitFileDiffs = useRepositoryStore((s) => s.commitFileDiffs);
  const toggleCommitFileExpanded = useRepositoryStore((s) => s.toggleCommitFileExpanded);
  const loadCommitFileDiff = useRepositoryStore((s) => s.loadCommitFileDiff);
  const revertCommitFile = useRepositoryStore((s) => s.revertCommitFile);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const isExpanded = expandedCommitFiles.has(file.path);
  const diff = commitFileDiffs.get(file.path);

  const handleClick = useCallback(() => {
    toggleCommitFileExpanded(file.path);
    if (!isExpanded && !diff) {
      loadCommitFileDiff(commitHash, file.path);
    }
  }, [file.path, isExpanded, diff, toggleCommitFileExpanded, loadCommitFileDiff, commitHash]);

  const handleRevertFile = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const shortHash = commitHash.slice(0, 7);
      const confirmed = await showConfirm({
        title: "Revert file",
        message: `This will undo changes to "${file.path}" from commit ${shortHash} and stage the result.`,
        confirmLabel: "Revert",
      });
      if (confirmed) {
        await revertCommitFile(commitHash, file.path);
      }
    },
    [commitHash, file.path, revertCommitFile, showConfirm]
  );

  const statusIcon = getStatusIcon(file.status);
  const statusClass = `status-${file.status}`;
  const statusStyle = STATUS_COLORS[file.status];

  // For renamed files, show the old path
  const displayPath = file.old_path ? `${file.old_path} → ${file.path}` : file.path;

  return (
    <div
      className={clsx(
        "commit-file-item border-border min-w-0 border-b last:border-b-0",
        isExpanded && "expanded"
      )}
    >
      <div
        className={clsx(
          "file-header group hover:bg-bg-hover flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors duration-150",
          isExpanded && "bg-bg-tertiary"
        )}
        onClick={handleClick}
      >
        <span className="expand-icon text-text-muted text-2xs w-3 shrink-0">
          {isExpanded ? "\u25BC" : "\u25B6"}
        </span>
        <span
          className={clsx(
            "status-icon flex size-4 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold",
            statusClass
          )}
          style={statusStyle ? { background: statusStyle.bg, color: statusStyle.color } : undefined}
        >
          {statusIcon}
        </span>
        <span className="file-path text-text-primary flex-1 truncate" title={displayPath}>
          {displayPath}
        </span>
        <button
          className="revert-file-btn border-border text-text-muted hover:bg-bg-hover hover:text-text-primary shrink-0 rounded border bg-transparent px-1.5 py-px text-xs opacity-0 transition-all duration-150 group-hover:opacity-100"
          onClick={handleRevertFile}
          title="Revert this file"
        >
          Revert
        </button>
      </div>
      {isExpanded && (
        <div className="file-diff-container border-border bg-bg-primary overflow-hidden border-t">
          {diff ? (
            <CommitFileDiff diff={diff} commitHash={commitHash} filePath={file.path} />
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

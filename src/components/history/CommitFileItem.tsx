import { useCallback } from "react";
import type { CommitFileChange } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { CommitFileDiff } from "./CommitFileDiff";
import "./CommitFileItem.css";

interface CommitFileItemProps {
  file: CommitFileChange;
  commitHash: string;
}

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

  // For renamed files, show the old path
  const displayPath = file.old_path ? `${file.old_path} → ${file.path}` : file.path;

  return (
    <div className={`commit-file-item ${isExpanded ? "expanded" : ""}`}>
      <div className="file-header" onClick={handleClick}>
        <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className={`status-icon ${statusClass}`}>{statusIcon}</span>
        <span className="file-path" title={displayPath}>
          {displayPath}
        </span>
        <button className="revert-file-btn" onClick={handleRevertFile} title="Revert this file">
          Revert
        </button>
      </div>
      {isExpanded && (
        <div className="file-diff-container">
          {diff ? (
            <CommitFileDiff diff={diff} commitHash={commitHash} filePath={file.path} />
          ) : (
            <div className="loading-diff">Loading diff...</div>
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

import { useCallback } from "react";
import type { CommitFileChange } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { CommitFileDiff } from "../history/CommitFileDiff";
import "./StashFileItem.css";

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

  const statusIcon = getStatusIcon(file.status);
  const statusClass = `status-${file.status}`;

  // For renamed files, show the old path
  const displayPath = file.old_path ? `${file.old_path} → ${file.path}` : file.path;

  return (
    <div className={`stash-file-item ${isExpanded ? "expanded" : ""}`}>
      <div className="file-header" onClick={handleClick}>
        <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
        <span className={`status-icon ${statusClass}`}>{statusIcon}</span>
        <span className="file-path" title={displayPath}>
          {displayPath}
        </span>
      </div>
      {isExpanded && (
        <div className="file-diff-container">
          {diff ? (
            <CommitFileDiff diff={diff} />
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

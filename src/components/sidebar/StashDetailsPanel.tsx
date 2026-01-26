import { formatDistanceToNow } from "date-fns";
import type { StashDetails } from "../../types";
import { StashFileItem } from "./StashFileItem";
import "./StashDetailsPanel.css";

interface StashDetailsPanelProps {
  details: StashDetails | null;
  loading: boolean;
}

export function StashDetailsPanel({ details, loading }: StashDetailsPanelProps) {
  if (loading) {
    return (
      <div className="stash-details-panel loading">
        <div className="loading-spinner" />
        <span>Loading stash details...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="stash-details-panel empty">
        <p>Select a stash to view details</p>
      </div>
    );
  }

  const date = new Date(details.timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });
  const stashName = `stash@{${details.index}}`;

  // Parse a cleaner message
  const getCleanMessage = () => {
    const msg = details.message;
    // Remove "WIP on branch: hash " prefix
    if (msg.startsWith("WIP on ")) {
      const colonIndex = msg.indexOf(": ");
      if (colonIndex !== -1) {
        const afterColon = msg.substring(colonIndex + 2);
        const spaceIndex = afterColon.indexOf(" ");
        if (spaceIndex !== -1) {
          return afterColon.substring(spaceIndex + 1);
        }
        return afterColon;
      }
    }
    // Remove "On branch: " prefix
    if (msg.startsWith("On ")) {
      const colonIndex = msg.indexOf(": ");
      if (colonIndex !== -1) {
        return msg.substring(colonIndex + 2);
      }
    }
    return msg;
  };

  return (
    <div className="stash-details-panel">
      <div className="stash-info">
        <div className="stash-name">
          <span className="label">Stash</span>
          <code className="name">{stashName}</code>
        </div>

        <div className="stash-message-full">{getCleanMessage()}</div>

        <div className="stash-meta">
          {details.branch_name && (
            <div className="meta-row">
              <span className="label">Branch</span>
              <span className="value">{details.branch_name}</span>
            </div>
          )}
          <div className="meta-row">
            <span className="label">Created</span>
            <span className="value" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          <div className="meta-row">
            <span className="label">Commit</span>
            <code className="value commit-hash">{details.commit_hash.slice(0, 12)}</code>
          </div>
        </div>
      </div>

      <div className="files-section">
        <div className="files-header">
          <span>Files changed</span>
          <span className="file-count">{details.files_changed.length}</span>
        </div>
        <div className="files-list">
          {details.files_changed.map((file) => (
            <StashFileItem key={file.path} file={file} stashIndex={details.index} />
          ))}
        </div>
      </div>
    </div>
  );
}

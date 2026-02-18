import { useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import type { CommitDetails } from "../../types";
import { CommitFileItem } from "./CommitFileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import "./CommitDetailsPanel.css";

interface CommitDetailsPanelProps {
  details: CommitDetails | null;
  loading: boolean;
}

export function CommitDetailsPanel({ details, loading }: CommitDetailsPanelProps) {
  const revertCommit = useRepositoryStore((s) => s.revertCommit);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const handleRevertCommit = useCallback(async () => {
    if (!details) return;
    const shortHash = details.hash.slice(0, 7);
    const confirmed = await showConfirm({
      title: "Revert commit",
      message: `Revert commit ${shortHash}?\n\nThis will create new changes that undo this commit and stage them.`,
      confirmLabel: "Revert",
    });
    if (confirmed) {
      await revertCommit(details.hash);
      setActiveView("status");
    }
  }, [details, revertCommit, setActiveView, showConfirm]);

  if (loading) {
    return (
      <div className="commit-details-panel loading">
        <div className="loading-spinner" />
        <span>Loading commit details...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="commit-details-panel empty">
        <p>Select a commit to view details</p>
      </div>
    );
  }

  const date = new Date(details.timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  return (
    <div className="commit-details-panel">
      <div className="commit-info">
        <div className="commit-hash">
          <span className="label">Commit</span>
          <code className="hash">{details.hash.slice(0, 12)}</code>
        </div>

        <div className="commit-message-full">{details.message}</div>

        <div className="commit-meta">
          <div className="meta-row">
            <span className="label">Author</span>
            <span className="value">
              {details.author_name} &lt;{details.author_email}&gt;
            </span>
          </div>
          <div className="meta-row">
            <span className="label">Date</span>
            <span className="value" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          {details.parent_hashes.length > 0 && (
            <div className="meta-row">
              <span className="label">Parent{details.parent_hashes.length > 1 ? "s" : ""}</span>
              <span className="value parents">
                {details.parent_hashes.map((hash) => (
                  <code key={hash} className="parent-hash">
                    {hash.slice(0, 7)}
                  </code>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="files-section">
        <div className="files-header">
          <span>Files changed</span>
          <span className="file-count">{details.files_changed.length}</span>
          <button className="revert-commit-btn" onClick={handleRevertCommit}>
            Revert commit
          </button>
        </div>
        <div className="files-list">
          {details.files_changed.map((file) => (
            <CommitFileItem key={file.path} file={file} commitHash={details.hash} />
          ))}
        </div>
      </div>
    </div>
  );
}

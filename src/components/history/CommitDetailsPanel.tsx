import { useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import type { CommitDetails } from "../../types";
import { CommitFileItem } from "./CommitFileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";

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
      <div className="commit-details-panel loading text-text-muted flex h-full flex-col items-center justify-center gap-3">
        <div className="loading-spinner" />
        <span>Loading commit details...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="commit-details-panel empty text-text-muted flex h-full flex-col items-center justify-center">
        <p>Select a commit to view details</p>
      </div>
    );
  }

  const date = new Date(details.timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  return (
    <div className="commit-details-panel flex h-full flex-col overflow-hidden">
      <div className="commit-info border-border shrink-0 border-b p-3">
        <div className="commit-hash mb-2 flex items-center gap-2">
          <span className="label text-text-muted text-xs">Commit</span>
          <code className="hash bg-bg-tertiary text-text-primary rounded px-1.5 py-0.5 font-mono text-xs">
            {details.hash.slice(0, 12)}
          </code>
        </div>

        <div className="commit-message-full text-text-primary mb-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {details.message}
        </div>

        <div className="commit-meta flex flex-col gap-1">
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Author</span>
            <span className="value text-text-secondary">
              {details.author_name} &lt;{details.author_email}&gt;
            </span>
          </div>
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Date</span>
            <span className="value text-text-secondary" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          {details.parent_hashes.length > 0 && (
            <div className="meta-row flex gap-2 text-xs">
              <span className="label text-text-muted min-w-15 shrink-0">
                Parent{details.parent_hashes.length > 1 ? "s" : ""}
              </span>
              <span className="value parents text-text-secondary flex flex-wrap gap-1">
                {details.parent_hashes.map((hash) => (
                  <code
                    key={hash}
                    className="parent-hash bg-bg-tertiary rounded-sm px-1 py-px font-mono text-xs"
                  >
                    {hash.slice(0, 7)}
                  </code>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="files-section flex flex-1 flex-col overflow-hidden">
        <div className="files-header border-border bg-bg-tertiary text-text-secondary flex items-center justify-between border-b px-3 py-2 text-xs font-semibold">
          <span>Files changed</span>
          <span className="file-count bg-bg-hover rounded-full px-2 py-px text-xs font-normal">
            {details.files_changed.length}
          </span>
          <button
            className="revert-commit-btn border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary ml-auto rounded border bg-transparent px-2 py-0.5 text-xs font-normal"
            onClick={handleRevertCommit}
          >
            Revert commit
          </button>
        </div>
        <div className="files-list min-w-0 flex-1 overflow-y-auto">
          {details.files_changed.map((file) => (
            <CommitFileItem key={file.path} file={file} commitHash={details.hash} />
          ))}
        </div>
      </div>
    </div>
  );
}

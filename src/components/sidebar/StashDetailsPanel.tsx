import { formatDistanceToNow } from "date-fns";
import type { StashDetails } from "../../types";
import { StashFileItem } from "./StashFileItem";

interface StashDetailsPanelProps {
  details: StashDetails | null;
  loading: boolean;
}

export function StashDetailsPanel({ details, loading }: StashDetailsPanelProps) {
  if (loading) {
    return (
      <div className="stash-details-panel loading text-text-muted flex h-full flex-col items-center justify-center gap-3">
        <div className="loading-spinner" />
        <span>Loading stash details...</span>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="stash-details-panel empty text-text-muted flex h-full flex-col items-center justify-center">
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
    if (msg.startsWith("On ")) {
      const colonIndex = msg.indexOf(": ");
      if (colonIndex !== -1) {
        return msg.substring(colonIndex + 2);
      }
    }
    return msg;
  };

  return (
    <div className="stash-details-panel flex h-full flex-col overflow-hidden">
      <div className="stash-info border-border shrink-0 border-b p-3">
        <div className="stash-name mb-2 flex items-center gap-2">
          <span className="label text-text-muted text-xs">Stash</span>
          <code className="name bg-bg-tertiary text-text-primary rounded px-1.5 py-px font-mono text-xs">
            {stashName}
          </code>
        </div>

        <div className="stash-message-full text-text-primary mb-3 leading-normal break-words whitespace-pre-wrap">
          {getCleanMessage()}
        </div>

        <div className="stash-meta flex flex-col gap-1">
          {details.branch_name && (
            <div className="meta-row flex gap-2 text-xs">
              <span className="label text-text-muted min-w-15 shrink-0">Branch</span>
              <span className="value text-text-secondary">{details.branch_name}</span>
            </div>
          )}
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Created</span>
            <span className="value text-text-secondary" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Commit</span>
            <code className="value commit-hash bg-bg-tertiary text-text-secondary rounded-sm px-1 py-px font-mono text-xs">
              {details.commit_hash.slice(0, 12)}
            </code>
          </div>
        </div>
      </div>

      <div className="files-section flex flex-1 flex-col overflow-hidden">
        <div className="files-header border-border bg-bg-tertiary text-text-secondary flex shrink-0 items-center justify-between border-b px-3 py-2 text-xs font-semibold">
          <span>Files changed</span>
          <span className="file-count bg-bg-hover rounded-full px-2 py-px text-xs font-normal">
            {details.files_changed.length}
          </span>
        </div>
        <div className="files-list min-w-0 flex-1 overflow-y-auto">
          {details.files_changed.map((file) => (
            <StashFileItem key={file.path} file={file} stashIndex={details.index} />
          ))}
        </div>
      </div>
    </div>
  );
}

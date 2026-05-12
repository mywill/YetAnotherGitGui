import React, { useState, useCallback } from "react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { usePlatform } from "../../hooks/usePlatform";
import { YaggButton } from "../common/YaggButton";

export function CommitPanel() {
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const { modKey } = usePlatform();

  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const createCommit = useRepositoryStore((s) => s.createCommit);

  const hasStagedChanges = fileStatuses && fileStatuses.staged.length > 0;

  const handleCommit = useCallback(async () => {
    if (!message.trim() || !hasStagedChanges) return;

    setIsCommitting(true);
    try {
      await createCommit(message.trim());
      setMessage("");
    } finally {
      setIsCommitting(false);
    }
  }, [message, hasStagedChanges, createCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleCommit();
      }
    },
    [handleCommit]
  );

  return (
    <div className="commit-panel gap-section p-card-y flex h-full flex-col">
      <div className="commit-header text-text-muted text-2xs font-mono font-medium tracking-widest uppercase">
        Commit
      </div>
      <textarea
        className="commit-message-input font-inherit text-body bg-bg-well text-text-primary border-border focus-ring px-card-x py-card-y min-h-15 flex-1 resize-none rounded border"
        placeholder="Commit message..."
        aria-label="Commit message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isCommitting}
        spellCheck={true}
      />
      <div className="commit-actions flex items-center gap-2">
        <YaggButton
          variant="primary"
          className="commit-button shrink-0"
          onClick={handleCommit}
          disabled={!message.trim() || !hasStagedChanges || isCommitting}
          tabIndex={!message.trim() || !hasStagedChanges || isCommitting ? -1 : 0}
        >
          {isCommitting ? "Committing..." : "Commit"}
        </YaggButton>
        <span className="commit-hint text-text-muted text-xs">{modKey}+Enter to commit</span>
      </div>
    </div>
  );
}

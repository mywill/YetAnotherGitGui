import React, { useState, useCallback } from "react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import "./CommitPanel.css";

export function CommitPanel() {
  const [message, setMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

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
    <div className="commit-panel">
      <div className="commit-header">Commit</div>
      <textarea
        className="commit-message-input"
        placeholder="Commit message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isCommitting}
        spellCheck={true}
      />
      <div className="commit-actions">
        <button
          className="commit-button primary"
          onClick={handleCommit}
          disabled={!message.trim() || !hasStagedChanges || isCommitting}
        >
          {isCommitting ? "Committing..." : "Commit"}
        </button>
        <span className="commit-hint">Ctrl+Enter to commit</span>
      </div>
    </div>
  );
}

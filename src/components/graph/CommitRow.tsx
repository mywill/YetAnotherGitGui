import { useCallback, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import type { GraphCommit } from "../../types";
import { BranchLines } from "./BranchLines";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import "./CommitRow.css";

interface CommitRowProps {
  style: CSSProperties;
  commit: GraphCommit;
  isSelected: boolean;
  isHead: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

export function CommitRow({
  style,
  commit,
  isSelected,
  isHead,
  onSelect,
  onDoubleClick,
}: CommitRowProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const revertCommit = useRepositoryStore((s) => s.revertCommit);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopyHash = useCallback(async () => {
    await copyToClipboard(commit.hash);
    setContextMenu(null);
  }, [commit.hash]);

  const handleCheckout = useCallback(() => {
    setContextMenu(null);
    onDoubleClick();
  }, [onDoubleClick]);

  const handleRevert = useCallback(async () => {
    setContextMenu(null);
    const shortHash = commit.hash.slice(0, 7);
    const shortMessage =
      commit.message.length > 60 ? commit.message.slice(0, 60) + "..." : commit.message;
    const confirmed = await showConfirm({
      title: "Revert commit",
      message: `Revert ${shortHash}: "${shortMessage}"?\n\nThis will create new changes that undo this commit and stage them.`,
      confirmLabel: "Revert",
    });
    if (confirmed) {
      await revertCommit(commit.hash);
      setActiveView("status");
    }
  }, [commit.hash, commit.message, revertCommit, setActiveView, showConfirm]);

  const date = new Date(commit.timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  return (
    <>
      <div
        className={`commit-row ${isSelected ? "selected" : ""} ${isHead ? "is-head" : ""}`}
        style={style}
        onClick={onSelect}
        onMouseDown={(e) => {
          if (e.detail === 2) {
            e.preventDefault();
            onDoubleClick();
          }
        }}
        onContextMenu={handleContextMenu}
      >
        <div className="graph-col">
          <BranchLines commit={commit} />
        </div>
        <div className="message-col">
          {isHead && <span className="head-badge">HEAD</span>}
          {commit.refs.map((ref) => (
            <span
              key={ref.name}
              className={`ref-badge ref-${ref.ref_type} ${ref.is_head ? "is-head" : ""}`}
            >
              {ref.name}
            </span>
          ))}
          <span className="commit-message">{commit.message}</span>
        </div>
        <div className="author-col">{commit.author_name}</div>
        <div className="date-col" title={date.toLocaleString()}>
          {timeAgo}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Copy commit hash", onClick: handleCopyHash },
            { label: "Checkout commit", onClick: handleCheckout },
            { label: "Revert commit", onClick: handleRevert },
          ]}
        />
      )}
    </>
  );
}

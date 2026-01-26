import { useCallback, useState } from "react";
import type { BranchInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import "./BranchItem.css";

interface BranchItemProps {
  branch: BranchInfo;
}

export function BranchItem({ branch }: BranchItemProps) {
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const deleteBranch = useRepositoryStore((s) => s.deleteBranch);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleClick = useCallback(() => {
    if (branch.target_hash) {
      selectAndScrollToCommit(branch.target_hash);
    }
  }, [branch.target_hash, selectAndScrollToCommit]);

  const handleDoubleClick = useCallback(async () => {
    if (branch.is_remote) {
      // For remote branches, show info message
      await showConfirm({
        title: "Remote Branch",
        message: `To checkout remote branch "${branch.name}", create a local tracking branch first.`,
        confirmLabel: "OK",
        cancelLabel: "Cancel",
      });
      return;
    }

    if (branch.is_head) {
      // Already on this branch
      return;
    }

    const confirmed = await showConfirm({
      title: "Switch Branch",
      message: `Switch to branch "${branch.name}"?`,
      confirmLabel: "Switch",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      checkoutBranch(branch.name);
    }
  }, [branch, checkoutBranch, showConfirm]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCheckout = useCallback(async () => {
    setContextMenu(null);
    if (branch.is_remote) {
      await showConfirm({
        title: "Remote Branch",
        message: `To checkout remote branch "${branch.name}", create a local tracking branch first.`,
        confirmLabel: "OK",
        cancelLabel: "Cancel",
      });
      return;
    }

    if (branch.is_head) return;

    const confirmed = await showConfirm({
      title: "Switch Branch",
      message: `Switch to branch "${branch.name}"?`,
      confirmLabel: "Switch",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      checkoutBranch(branch.name);
    }
  }, [branch, checkoutBranch, showConfirm]);

  const handleDelete = useCallback(async () => {
    setContextMenu(null);
    const message = branch.is_remote
      ? `Delete branch "${branch.name}" from origin?`
      : `Delete branch "${branch.name}"?`;

    const confirmed = await showConfirm({
      title: "Delete Branch",
      message,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      deleteBranch(branch.name, branch.is_remote);
    }
  }, [branch, deleteBranch, showConfirm]);

  const handleCopyName = useCallback(() => {
    setContextMenu(null);
    copyToClipboard(branch.name);
  }, [branch.name]);

  // Display name: for remote branches, show only the part after origin/
  const displayName = branch.is_remote ? branch.name.replace(/^[^/]+\//, "") : branch.name;

  const contextMenuItems = [
    {
      label: "Copy Name",
      onClick: handleCopyName,
    },
    {
      label: "Checkout",
      onClick: handleCheckout,
      disabled: branch.is_head,
    },
    {
      label: "Delete",
      onClick: handleDelete,
      disabled: branch.is_head,
    },
  ];

  return (
    <>
      <div
        className={`branch-item ${branch.is_head ? "is-current" : ""} ${branch.is_remote ? "is-remote" : ""}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={branch.name}
      >
        <BranchIcon isRemote={branch.is_remote} />
        <span className="branch-item-name">{displayName}</span>
        {branch.is_head && <span className="current-badge">current</span>}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

function BranchIcon({ isRemote }: { isRemote: boolean }) {
  if (isRemote) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="branch-icon">
        <path d="M1 4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm2.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        <path d="M10 11.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm2.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        <path d="M3.5 7v4.5a.5.5 0 0 0 .5.5h6v-1H4.5V7h-1z" />
        <path d="M12.5 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="branch-icon">
      <path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm7 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM5 8v2.5a.5.5 0 0 0 .5.5h5.5V13h-5a1.5 1.5 0 0 1-1.5-1.5V8h.5z" />
      <path d="M11 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm1 2.5V10h-1V7.5h1z" />
    </svg>
  );
}

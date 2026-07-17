import { useCallback, useMemo } from "react";
import clsx from "clsx";
import { IconGitBranch, IconCloud } from "@tabler/icons-react";
import type { BranchInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useWorktreeStore } from "../../stores/worktreeStore";
import { copyToClipboard } from "../../services/clipboard";
import { useContextMenu } from "../../hooks/useContextMenu";
import { SidebarRefItem } from "./SidebarRefItem";
import { formatTimeAgo } from "../../utils/date";

interface BranchItemProps {
  branch: BranchInfo;
}

async function confirmCheckoutBranch(
  branch: BranchInfo,
  checkoutBranch: (name: string) => void,
  showConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>
): Promise<void> {
  if (branch.is_remote) {
    await showConfirm({
      title: "Remote Branch",
      message: `To checkout remote branch "${branch.name}", create a local tracking branch first.`,
      confirmLabel: "OK",
      cancelLabel: "Cancel",
    });
    return;
  }

  if (branch.is_head) {
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
}

export function BranchItem({ branch }: BranchItemProps) {
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const deleteBranch = useRepositoryStore((s) => s.deleteBranch);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const openWorktreeAddDialog = useWorktreeStore((s) => s.openAddDialog);
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const handleClick = useCallback(() => {
    if (branch.target_hash) {
      selectAndScrollToCommit(branch.target_hash);
    }
  }, [branch.target_hash, selectAndScrollToCommit]);

  const handleDoubleClick = useCallback(async () => {
    await confirmCheckoutBranch(branch, checkoutBranch, showConfirm);
  }, [branch, checkoutBranch, showConfirm]);

  const handleCheckout = useCallback(async () => {
    closeContextMenu();
    await confirmCheckoutBranch(branch, checkoutBranch, showConfirm);
  }, [branch, checkoutBranch, closeContextMenu, showConfirm]);

  const handleDelete = useCallback(async () => {
    closeContextMenu();
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
  }, [branch, closeContextMenu, deleteBranch, showConfirm]);

  const handleCopyName = useCallback(() => {
    closeContextMenu();
    copyToClipboard(branch.name);
  }, [branch.name, closeContextMenu]);

  const handleNewWorktree = useCallback(() => {
    closeContextMenu();
    openWorktreeAddDialog({ branch: branch.name });
  }, [closeContextMenu, openWorktreeAddDialog, branch.name]);

  // Display name: for remote branches, show only the part after origin/
  const displayName = branch.is_remote ? branch.name.replace(/^[^/]+\//, "") : branch.name;

  const contextMenuItems = useMemo(
    () => [
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
        label: "New worktree from this branch…",
        onClick: handleNewWorktree,
      },
      {
        label: "Delete",
        onClick: handleDelete,
        disabled: branch.is_head,
      },
    ],
    [handleCopyName, handleCheckout, handleNewWorktree, handleDelete, branch.is_head]
  );

  // Branches with an upstream show that. Branches without one fall back to a
  // relative date so the row still has secondary context. Remote branches
  // always show the date.
  const dateText = branch.last_commit_time != null ? formatTimeAgo(branch.last_commit_time) : null;
  const showUpstream = !branch.is_remote && !!branch.upstream;
  const showDate = !showUpstream && !!dateText;
  const secondaryColorClass = branch.is_head ? "text-text-primary/75" : "text-text-muted";

  return (
    <SidebarRefItem
      itemClass="branch-item"
      modifiers={clsx(
        branch.is_head && "is-current",
        branch.is_remote && "is-remote text-text-muted"
      )}
      ariaCurrent={branch.is_head ? "true" : undefined}
      title={branch.name}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      contextMenuItems={contextMenuItems}
      contextMenuAnchor={contextMenu}
      onCloseContextMenu={closeContextMenu}
    >
      <BranchIcon isRemote={branch.is_remote} />
      <span className="branch-item-name min-w-0 shrink truncate font-mono">{displayName}</span>
      {showUpstream && (
        <span
          className={clsx(
            "branch-item-upstream text-2xs shrink-0 truncate font-mono",
            secondaryColorClass
          )}
        >
          → {branch.upstream}
        </span>
      )}
      <BranchAheadBehind branch={branch} />
      {branch.is_head && (
        <span className="current-badge text-badge-branch text-2xs shrink-0 rounded border px-1.5 py-px font-semibold">
          current
        </span>
      )}
      {showDate && (
        <span
          className={clsx(
            "branch-item-date text-2xs shrink-0 font-mono whitespace-nowrap",
            secondaryColorClass
          )}
        >
          {dateText}
        </span>
      )}
    </SidebarRefItem>
  );
}

function BranchIcon({ isRemote }: { isRemote: boolean }) {
  if (isRemote) {
    return (
      <IconCloud
        size={14}
        stroke={1.75}
        className="branch-icon text-badge-remote shrink-0"
        aria-hidden
      />
    );
  }
  return (
    <IconGitBranch
      size={14}
      stroke={1.75}
      className="branch-icon text-badge-branch shrink-0"
      aria-hidden
    />
  );
}

function BranchAheadBehind({ branch }: { branch: BranchInfo }) {
  if (branch.is_remote || (!branch.ahead && !branch.behind)) return null;
  return (
    <span
      className="ahead-behind text-2xs inline-flex shrink-0 items-center gap-1 font-mono"
      aria-label={`${branch.ahead ?? 0} ahead, ${branch.behind ?? 0} behind`}
    >
      {branch.ahead ? <span className="text-addition">+{branch.ahead}</span> : null}
      {branch.behind ? <span className="text-deletion">-{branch.behind}</span> : null}
    </span>
  );
}

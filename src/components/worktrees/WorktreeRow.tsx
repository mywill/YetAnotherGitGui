import { useCallback } from "react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import {
  IconGitBranch,
  IconLock,
  IconAlertTriangle,
  IconTerminal,
  IconFolder,
  IconExternalLink,
} from "@tabler/icons-react";
import type { WorktreeInfo } from "../../types";
import { useWorktreeStore } from "../../stores/worktreeStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useTerminalStore } from "../../stores/terminalStore";
import { useContextMenu } from "../../hooks/useContextMenu";
import { ContextMenu } from "../common/ContextMenu";

const COLUMN_GAP = 16;

interface WorktreeRowProps {
  worktree: WorktreeInfo;
}

export function WorktreeRow({ worktree }: WorktreeRowProps) {
  const removeWorktree = useWorktreeStore((s) => s.removeWorktree);
  const moveWorktree = useWorktreeStore((s) => s.moveWorktree);
  const lockWorktree = useWorktreeStore((s) => s.lockWorktree);
  const unlockWorktree = useWorktreeStore((s) => s.unlockWorktree);
  const openRepository = useRepositoryStore((s) => s.openRepository);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const openInCwd = useTerminalStore((s) => s.openInCwd);
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const handleOpen = useCallback(async () => {
    closeContextMenu();
    try {
      await openRepository(worktree.path);
      setActiveView("status");
    } catch {
      // openRepository surfaces its own error notification.
    }
  }, [closeContextMenu, openRepository, setActiveView, worktree.path]);

  const handleOpenTerminal = useCallback(() => {
    closeContextMenu();
    openInCwd(worktree.path);
  }, [closeContextMenu, openInCwd, worktree.path]);

  const handleRemove = useCallback(() => {
    closeContextMenu();
    void removeWorktree(worktree.name, false);
  }, [closeContextMenu, removeWorktree, worktree.name]);

  const handleMove = useCallback(async () => {
    closeContextMenu();
    const selected = await openDialog({
      directory: true,
      title: `Move worktree "${worktree.name}" to…`,
    });
    if (selected) {
      const newPath = `${selected}/${worktree.name}`;
      await moveWorktree(worktree.name, newPath);
    }
  }, [closeContextMenu, moveWorktree, worktree.name]);

  const handleLock = useCallback(() => {
    closeContextMenu();
    void lockWorktree(worktree.name, "locked via yagg");
  }, [closeContextMenu, lockWorktree, worktree.name]);

  const handleUnlock = useCallback(() => {
    closeContextMenu();
    void unlockWorktree(worktree.name);
  }, [closeContextMenu, unlockWorktree, worktree.name]);

  const handleReveal = useCallback(() => {
    closeContextMenu();
    void revealItemInDir(worktree.path);
  }, [closeContextMenu, worktree.path]);

  const handleOpenFolder = useCallback(() => {
    closeContextMenu();
    void openPath(worktree.path);
  }, [closeContextMenu, worktree.path]);

  const dateText = safeFormatDistance(worktree.last_commit_time);

  const contextMenuItems = [
    { label: "Open in app", onClick: handleOpen },
    { label: "Open in Terminal", onClick: handleOpenTerminal },
    { label: "Reveal in File Manager", onClick: handleReveal },
    { label: "Open Folder", onClick: handleOpenFolder },
    ...(worktree.is_main
      ? []
      : [
          { label: "Move…", onClick: handleMove },
          worktree.is_locked
            ? { label: "Unlock", onClick: handleUnlock }
            : { label: "Lock", onClick: handleLock },
          { label: "Remove…", onClick: handleRemove },
        ]),
  ];

  return (
    <>
      <div
        className={clsx(
          "worktree-grid hover:bg-bg-hover border-border min-h-row grid items-center border-b px-2 text-xs transition-colors",
          worktree.is_main && "bg-bg-well/40"
        )}
        style={{ columnGap: `${COLUMN_GAP}px`, scrollbarGutter: "stable" }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleOpen}
        title={worktree.path}
      >
        {/* Name */}
        <div className="flex min-w-0 items-center gap-1.5">
          <IconGitBranch
            size={12}
            stroke={1.75}
            className="text-badge-branch shrink-0"
            aria-hidden
          />
          <span className="text-text-primary truncate font-mono">{worktree.name}</span>
          {worktree.is_main && (
            <span className="text-badge-branch text-2xs shrink-0 rounded border px-1 py-px font-semibold">
              main
            </span>
          )}
        </div>
        {/* Branch */}
        <div className="text-text-muted flex min-w-0 items-center truncate font-mono">
          <span className="truncate">{worktree.branch ?? "(detached)"}</span>
          {worktree.branch && (worktree.ahead != null || worktree.behind != null) && (
            <span className="text-2xs ml-1 inline-flex shrink-0 items-center gap-1">
              {worktree.ahead ? <span className="text-addition">↑{worktree.ahead}</span> : null}
              {worktree.behind ? <span className="text-deletion">↓{worktree.behind}</span> : null}
            </span>
          )}
        </div>
        {/* Path */}
        <div className="text-text-muted truncate font-mono" title={worktree.path}>
          {worktree.path}
        </div>
        {/* Dirty */}
        <div className="text-right font-mono tabular-nums">
          {worktree.dirty_count > 0 ? (
            <span
              className="text-status-modified"
              title={`${worktree.dirty_count} changed file(s)`}
            >
              {worktree.dirty_count}
            </span>
          ) : (
            <span className="text-text-muted">0</span>
          )}
        </div>
        {/* State */}
        <div className="flex items-center gap-1.5">
          {!worktree.is_valid && (
            <span
              className="text-status-modified inline-flex items-center gap-0.5"
              title="Worktree directory missing — prunable"
            >
              <IconAlertTriangle size={12} stroke={2} aria-hidden />
            </span>
          )}
          {worktree.is_locked && (
            <span
              className="text-text-muted inline-flex items-center gap-0.5"
              title={worktree.lock_reason ? `Locked: ${worktree.lock_reason}` : "Locked"}
            >
              <IconLock size={12} stroke={2} aria-hidden />
            </span>
          )}
          {dateText && (
            <span className="text-text-muted text-2xs truncate font-mono">{dateText}</span>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={handleOpenTerminal}
            className="text-text-muted hover:text-text-primary shrink-0 cursor-pointer bg-transparent p-0.5"
            title="Open in Terminal"
            aria-label={`Open ${worktree.name} in terminal`}
          >
            <IconTerminal size={13} stroke={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleReveal}
            className="text-text-muted hover:text-text-primary shrink-0 cursor-pointer bg-transparent p-0.5"
            title="Reveal in File Manager"
            aria-label={`Reveal ${worktree.name} in file manager`}
          >
            <IconFolder size={13} stroke={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleOpen}
            className="text-text-muted hover:text-text-primary shrink-0 cursor-pointer bg-transparent p-0.5"
            title="Open in app"
            aria-label={`Open ${worktree.name} in app`}
          >
            <IconExternalLink size={13} stroke={1.75} aria-hidden />
          </button>
        </div>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
}

function safeFormatDistance(secondsSinceEpoch: number | null): string | null {
  if (secondsSinceEpoch == null) return null;
  try {
    return formatDistanceToNow(new Date(secondsSinceEpoch * 1000), { addSuffix: true });
  } catch {
    return null;
  }
}

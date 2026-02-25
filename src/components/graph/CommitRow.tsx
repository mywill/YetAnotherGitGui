import { useCallback, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import type { GraphCommit } from "../../types";
import { BranchLines } from "./BranchLines";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";

interface CommitRowProps {
  style: CSSProperties;
  commit: GraphCommit;
  isSelected: boolean;
  isHead: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

const REF_BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  branch: {
    bg: "color-mix(in srgb, var(--color-badge-branch) 20%, transparent)",
    color: "var(--color-badge-branch)",
    border: "var(--color-badge-branch)",
  },
  remotebranch: {
    bg: "color-mix(in srgb, var(--color-badge-remote) 20%, transparent)",
    color: "var(--color-badge-remote)",
    border: "var(--color-badge-remote)",
  },
  tag: {
    bg: "color-mix(in srgb, var(--color-badge-tag) 20%, transparent)",
    color: "var(--color-badge-tag)",
    border: "var(--color-badge-tag)",
  },
};

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
        className={clsx(
          "commit-row commit-graph-grid hover:bg-bg-hover cursor-pointer items-center px-2 text-xs transition-colors duration-100 select-none",
          isSelected && "selected",
          isHead && "is-head"
        )}
        style={{
          ...style,
          display: "grid",
          columnGap: "24px",
          ...(isHead && !isSelected
            ? {
                background: "color-mix(in srgb, var(--color-badge-head) 10%, transparent)",
                boxShadow: "inset 3px 0 0 var(--color-badge-head)",
              }
            : {}),
          ...(isSelected && !isHead
            ? {
                background: "color-mix(in srgb, var(--color-selection-border) 15%, transparent)",
                boxShadow: "inset 3px 0 0 var(--color-selection-border)",
              }
            : {}),
          ...(isSelected && isHead
            ? {
                background: "color-mix(in srgb, var(--color-badge-head) 10%, transparent)",
                boxShadow:
                  "inset 3px 0 0 var(--color-badge-head), inset -3px 0 0 var(--color-selection-border)",
              }
            : {}),
        }}
        onClick={onSelect}
        onMouseDown={(e) => {
          if (e.detail === 2) {
            e.preventDefault();
            onDoubleClick();
          }
        }}
        onContextMenu={handleContextMenu}
      >
        <div className="graph-col overflow-hidden">
          <BranchLines commit={commit} />
        </div>
        <div className="message-col flex min-w-0 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {isHead && (
            <span className="head-badge bg-badge-head text-2xs mr-1 shrink-0 rounded px-1.5 py-px font-bold text-white">
              HEAD
            </span>
          )}
          {commit.refs.map((ref) => {
            const refStyle = REF_BADGE_STYLES[ref.ref_type];
            return (
              <span
                key={ref.name}
                className={clsx(
                  "ref-badge shrink-0 rounded px-1.5 py-px text-xs font-medium whitespace-nowrap",
                  `ref-${ref.ref_type}`,
                  ref.is_head && "is-head"
                )}
                data-ref-type={ref.ref_type}
                style={
                  refStyle
                    ? {
                        background: ref.is_head
                          ? "color-mix(in srgb, var(--color-badge-head) 30%, transparent)"
                          : refStyle.bg,
                        color: refStyle.color,
                        border: `1px solid ${ref.is_head ? "var(--color-badge-head)" : refStyle.border}`,
                      }
                    : undefined
                }
              >
                {ref.name}
              </span>
            );
          })}
          <span className="commit-message truncate">{commit.message}</span>
        </div>
        <div className="author-col text-text-secondary truncate">{commit.author_name}</div>
        <div className="date-col text-text-secondary text-right" title={date.toLocaleString()}>
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

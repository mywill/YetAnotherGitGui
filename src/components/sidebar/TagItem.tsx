import { useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { IconTag } from "@tabler/icons-react";
import type { TagInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useContextMenu } from "../../hooks/useContextMenu";

interface TagItemProps {
  tag: TagInfo;
}

export function TagItem({ tag }: TagItemProps) {
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const deleteTag = useRepositoryStore((s) => s.deleteTag);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const handleClick = useCallback(() => {
    if (tag.target_hash) {
      selectAndScrollToCommit(tag.target_hash);
    }
  }, [tag.target_hash, selectAndScrollToCommit]);

  const handleDoubleClick = useCallback(async () => {
    const confirmed = await showConfirm({
      title: "Checkout Tag",
      message: `Checkout tag "${tag.name}"? This will put you in detached HEAD state.`,
      confirmLabel: "Checkout",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      checkoutCommit(tag.target_hash);
    }
  }, [tag, checkoutCommit, showConfirm]);

  const handleCheckout = useCallback(async () => {
    closeContextMenu();
    const confirmed = await showConfirm({
      title: "Checkout Tag",
      message: `Checkout tag "${tag.name}"? This will put you in detached HEAD state.`,
      confirmLabel: "Checkout",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      checkoutCommit(tag.target_hash);
    }
  }, [tag, checkoutCommit, closeContextMenu, showConfirm]);

  const handleDelete = useCallback(async () => {
    closeContextMenu();
    const confirmed = await showConfirm({
      title: "Delete Tag",
      message: `Delete tag "${tag.name}"?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      deleteTag(tag.name);
    }
  }, [tag, closeContextMenu, deleteTag, showConfirm]);

  const handleCopyName = useCallback(() => {
    closeContextMenu();
    copyToClipboard(tag.name);
  }, [tag.name, closeContextMenu]);

  const contextMenuItems = [
    {
      label: "Copy Name",
      onClick: handleCopyName,
    },
    {
      label: "Checkout",
      onClick: handleCheckout,
    },
    {
      label: "Delete",
      onClick: handleDelete,
    },
  ];

  const taggerText = tag.is_annotated ? tag.tagger_name : null;
  const dateText =
    tag.is_annotated && tag.tagger_time != null ? safeFormatDistance(tag.tagger_time) : null;

  return (
    <>
      <div
        className="tag-item text-text-primary hover:bg-bg-hover min-h-row flex cursor-pointer items-center gap-2 py-1 pr-3 pl-7 text-xs transition-colors duration-150"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={tag.message || tag.name}
      >
        <TagIcon />
        <span className="tag-item-name min-w-0 shrink truncate font-mono">{tag.name}</span>
        {tag.is_annotated && (
          <span className="annotated-badge bg-badge-tag text-3xs shrink-0 rounded px-1 py-px font-semibold text-white">
            A
          </span>
        )}
        {taggerText && (
          <span className="tag-item-tagger text-text-muted text-2xs shrink-0 truncate font-mono">
            {taggerText}
          </span>
        )}
        {dateText && (
          <span className="tag-item-date text-text-muted text-2xs shrink-0 font-mono whitespace-nowrap">
            {dateText}
          </span>
        )}
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

function safeFormatDistance(secondsSinceEpoch: number): string | null {
  try {
    return formatDistanceToNow(new Date(secondsSinceEpoch * 1000), { addSuffix: true });
  } catch {
    return null;
  }
}

function TagIcon() {
  return (
    <IconTag size={14} stroke={1.75} className="tag-icon text-badge-tag shrink-0" aria-hidden />
  );
}

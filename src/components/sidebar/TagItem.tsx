import { useCallback, useState } from "react";
import type { TagInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import "./TagItem.css";

interface TagItemProps {
  tag: TagInfo;
}

export function TagItem({ tag }: TagItemProps) {
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const deleteTag = useRepositoryStore((s) => s.deleteTag);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCheckout = useCallback(async () => {
    setContextMenu(null);
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

  const handleDelete = useCallback(async () => {
    setContextMenu(null);
    const confirmed = await showConfirm({
      title: "Delete Tag",
      message: `Delete tag "${tag.name}"?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      deleteTag(tag.name);
    }
  }, [tag, deleteTag, showConfirm]);

  const handleCopyName = useCallback(() => {
    setContextMenu(null);
    copyToClipboard(tag.name);
  }, [tag.name]);

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

  return (
    <>
      <div
        className="tag-item"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={tag.message || tag.name}
      >
        <TagIcon />
        <span className="tag-item-name">{tag.name}</span>
        {tag.is_annotated && <span className="annotated-badge">A</span>}
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

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="tag-icon">
      <path d="M2 2h5.5l6 6-5.5 5.5-6-6V2zm1 1v4.086l5 5L12.086 8l-5-5H3zm3.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
    </svg>
  );
}

import { useCallback, useState } from "react";
import type { StashInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import "./StashItem.css";

interface StashItemProps {
  stash: StashInfo;
}

export function StashItem({ stash }: StashItemProps) {
  const loadStashDetails = useRepositoryStore((s) => s.loadStashDetails);
  const applyStash = useRepositoryStore((s) => s.applyStash);
  const dropStash = useRepositoryStore((s) => s.dropStash);
  const selectedStashDetails = useRepositoryStore((s) => s.selectedStashDetails);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const showConfirm = useDialogStore((s) => s.showConfirm);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isSelected = selectedStashDetails?.index === stash.index;

  const stashName = `stash@{${stash.index}}`;

  // Get shortened message (first line, without "WIP on branch:" prefix)
  const getShortMessage = () => {
    let msg = stash.message;
    // Remove common prefixes
    if (msg.startsWith("WIP on ")) {
      const colonIndex = msg.indexOf(": ");
      if (colonIndex !== -1) {
        // Skip past the commit hash (next space after colon)
        const afterColon = msg.substring(colonIndex + 2);
        const spaceIndex = afterColon.indexOf(" ");
        if (spaceIndex !== -1) {
          msg = afterColon.substring(spaceIndex + 1);
        } else {
          msg = afterColon;
        }
      }
    } else if (msg.startsWith("On ")) {
      const colonIndex = msg.indexOf(": ");
      if (colonIndex !== -1) {
        msg = msg.substring(colonIndex + 2);
      }
    }
    // Get first line only
    const firstLine = msg.split("\n")[0];
    return firstLine.length > 40 ? firstLine.substring(0, 40) + "..." : firstLine;
  };

  const handleClick = useCallback(() => {
    loadStashDetails(stash.index);
    setActiveView("status");
  }, [stash.index, loadStashDetails, setActiveView]);

  const handleDoubleClick = useCallback(async () => {
    const confirmed = await showConfirm({
      title: "Apply Stash",
      message: `Apply "${stashName}"? This will restore the stashed changes to your working directory.`,
      confirmLabel: "Apply",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      applyStash(stash.index);
    }
  }, [stash.index, stashName, applyStash, showConfirm]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCopyName = useCallback(() => {
    setContextMenu(null);
    copyToClipboard(stashName);
  }, [stashName]);

  const handleApply = useCallback(async () => {
    setContextMenu(null);
    const confirmed = await showConfirm({
      title: "Apply Stash",
      message: `Apply "${stashName}"? This will restore the stashed changes to your working directory.`,
      confirmLabel: "Apply",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      applyStash(stash.index);
    }
  }, [stash.index, stashName, applyStash, showConfirm]);

  const handleDelete = useCallback(async () => {
    setContextMenu(null);
    const confirmed = await showConfirm({
      title: "Delete Stash",
      message: `Delete "${stashName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      dropStash(stash.index);
    }
  }, [stash.index, stashName, dropStash, showConfirm]);

  const contextMenuItems = [
    {
      label: "Copy Name",
      onClick: handleCopyName,
    },
    {
      label: "Apply",
      onClick: handleApply,
    },
    {
      label: "Delete",
      onClick: handleDelete,
    },
  ];

  return (
    <>
      <div
        className={`stash-item ${isSelected ? "is-selected" : ""}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={stash.message}
      >
        <StashIcon />
        <span className="stash-item-name">{stashName}</span>
        <span className="stash-item-message">{getShortMessage()}</span>
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

function StashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="stash-icon">
      <path d="M2 3h12v2H2V3zm1 3h10v2H3V6zm1 3h8v2H4V9zm1 3h6v2H5v-2z" />
    </svg>
  );
}

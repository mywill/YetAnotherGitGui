import { useCallback } from "react";
import clsx from "clsx";
import type { StashInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useContextMenu } from "../../hooks/useContextMenu";
import { cleanStashMessage } from "../../utils/stashMessage";

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
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const isSelected = selectedStashDetails?.index === stash.index;

  const stashName = `stash@{${stash.index}}`;

  const getShortMessage = () => {
    const msg = cleanStashMessage(stash.message);
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

  const handleCopyName = useCallback(() => {
    closeContextMenu();
    copyToClipboard(stashName);
  }, [stashName, closeContextMenu]);

  const handleApply = useCallback(async () => {
    closeContextMenu();
    const confirmed = await showConfirm({
      title: "Apply Stash",
      message: `Apply "${stashName}"? This will restore the stashed changes to your working directory.`,
      confirmLabel: "Apply",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      applyStash(stash.index);
    }
  }, [stash.index, stashName, applyStash, closeContextMenu, showConfirm]);

  const handleDelete = useCallback(async () => {
    closeContextMenu();
    const confirmed = await showConfirm({
      title: "Delete Stash",
      message: `Delete "${stashName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      dropStash(stash.index);
    }
  }, [stash.index, stashName, closeContextMenu, dropStash, showConfirm]);

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
        className={clsx(
          "stash-item group text-text-primary hover:bg-bg-hover flex cursor-pointer items-center gap-2 py-1 pr-3 pl-7 text-xs transition-colors duration-150",
          isSelected && "is-selected bg-bg-selected hover:bg-bg-selected-hover"
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title={stash.message}
      >
        <StashIcon />
        <span className="stash-item-name text-text-primary shrink-0 font-mono">{stashName}</span>
        <span
          className={clsx(
            "stash-item-message text-2xs flex-1 truncate",
            isSelected ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
          )}
        >
          {getShortMessage()}
        </span>
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

function StashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="stash-icon text-text-secondary shrink-0"
    >
      <path d="M2 3h12v2H2V3zm1 3h10v2H3V6zm1 3h8v2H4V9zm1 3h6v2H5v-2z" />
    </svg>
  );
}

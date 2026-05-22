import { useCallback } from "react";
import clsx from "clsx";
import { IconStack2 } from "@tabler/icons-react";
import type { StashInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { ContextMenu } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useContextMenu } from "../../hooks/useContextMenu";
import { cleanStashMessage } from "../../utils/stashMessage";
import { buildStashDropMessage } from "../../utils/dialogText";
import { SidebarListItem } from "./SidebarListItem";

interface StashItemProps {
  stash: StashInfo;
}

export function StashItem({ stash }: StashItemProps) {
  const loadStashDetails = useRepositoryStore((s) => s.loadStashDetails);
  const applyStash = useRepositoryStore((s) => s.applyStash);
  const dropStash = useRepositoryStore((s) => s.dropStash);
  const selectedStashDetails = useRepositoryStore((s) => s.selectedStashDetails);
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
  }, [stash.index, loadStashDetails]);

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
      title: "Drop stash",
      message: buildStashDropMessage([stash]),
      confirmLabel: "Drop",
      cancelLabel: "Cancel",
    });
    if (confirmed) {
      dropStash(stash.index);
    }
  }, [stash, closeContextMenu, dropStash, showConfirm]);

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
      label: "Drop",
      onClick: handleDelete,
    },
  ];

  return (
    <>
      <SidebarListItem
        itemClass="stash-item group"
        isSelected={isSelected}
        title={stash.message}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <StashIcon />
        <span className="stash-item-name text-text-primary shrink-0 font-mono">{stashName}</span>
        <span
          className={clsx(
            "stash-item-message text-2xs flex-1 truncate",
            isSelected ? "text-text-primary" : "text-text-muted group-hover:text-text-primary"
          )}
        >
          {getShortMessage()}
        </span>
      </SidebarListItem>
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
    <IconStack2
      size={14}
      stroke={1.75}
      className="stash-icon text-text-muted shrink-0"
      aria-hidden
    />
  );
}

import { memo, useCallback } from "react";
import clsx from "clsx";
import type { FileStatus, FileStatusType } from "../../types";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useContextMenu } from "../../hooks/useContextMenu";

interface FileItemProps {
  file: FileStatus;
  isStaged: boolean;
  isUntracked?: boolean;
  isSelected?: boolean;
  onToggleStage: () => void;
  onSelect: () => void;
  onSelectWithModifiers?: (path: string, isCtrl: boolean, isShift: boolean) => void;
  onDoubleClick?: () => void;
  extraMenuItems?: ContextMenuItem[];
}

const STATUS_ICONS: Record<FileStatusType, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  copied: "C",
  untracked: "?",
  conflicted: "!",
};

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  modified: {
    color: "var(--color-status-modified)",
    bg: "color-mix(in srgb, var(--color-status-modified) var(--badge-bg-mix), transparent)",
  },
  added: {
    color: "var(--color-status-added)",
    bg: "color-mix(in srgb, var(--color-status-added) var(--badge-bg-mix), transparent)",
  },
  deleted: {
    color: "var(--color-status-deleted)",
    bg: "color-mix(in srgb, var(--color-status-deleted) var(--badge-bg-mix), transparent)",
  },
  renamed: {
    color: "var(--color-status-modified)",
    bg: "color-mix(in srgb, var(--color-status-modified) var(--badge-bg-mix), transparent)",
  },
  untracked: {
    color: "var(--color-status-untracked)",
    bg: "color-mix(in srgb, var(--color-status-untracked) var(--badge-bg-mix), transparent)",
  },
  conflicted: {
    color: "var(--color-status-conflicted)",
    bg: "color-mix(in srgb, var(--color-status-conflicted) var(--badge-bg-mix), transparent)",
  },
};

export const FileItem = memo(function FileItem({
  file,
  isStaged,
  isUntracked,
  isSelected,
  onToggleStage,
  onSelect,
  onSelectWithModifiers,
  onDoubleClick,
  extraMenuItems,
}: FileItemProps) {
  // Avoid subscribing to repositoryInfo here — it would re-render every
  // FileItem whenever any repository state changes. Read it lazily inside
  // the context menu callback instead.
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (onSelectWithModifiers) {
        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        onSelectWithModifiers(file.path, isCtrl, isShift);
      } else {
        onSelect();
      }
    },
    [file.path, onSelect, onSelectWithModifiers]
  );

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStage();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.();
  };

  const fileName = file.path.split("/").pop() || file.path;
  const dirPath = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";

  const menuItems: ContextMenuItem[] = [
    {
      label: "Copy",
      children: [
        {
          label: "Relative path",
          onClick: () => {
            copyToClipboard(file.path);
          },
        },
        {
          label: "Absolute path",
          onClick: () => {
            // Read repositoryInfo lazily so this component does not subscribe to it.
            const repoPath = useRepositoryStore.getState().repositoryInfo?.path ?? "";
            copyToClipboard(repoPath ? `${repoPath}/${file.path}` : file.path);
          },
        },
        {
          label: "File name",
          onClick: () => {
            copyToClipboard(fileName);
          },
        },
      ],
    },
  ];
  if (extraMenuItems) {
    menuItems.push(...extraMenuItems);
  }

  return (
    <>
      <div
        className={clsx(
          "file-item hover:bg-bg-hover min-h-row flex shrink-0 cursor-pointer items-center gap-2 px-3 py-1 text-xs transition-colors duration-100",
          isStaged && "staged light:bg-success/15 light:hover:bg-success/20",
          isSelected && "selected bg-bg-selected hover:bg-bg-selected-hover",
          isStaged && isSelected && "bg-success/20 hover:bg-success/30"
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-testid="file-item"
        title={file.path}
      >
        <span
          className={clsx(
            "stage-checkbox flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border",
            isStaged
              ? "border-addition bg-addition/20 text-addition"
              : "border-border bg-bg-well text-transparent"
          )}
          onClick={handleCheckboxClick}
          role="presentation"
          title={isStaged ? "Unstage file" : "Stage file"}
        >
          {isStaged && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path
                d="M8.5 2.5L4 7.5L1.5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span
          className="status-icon flex size-4.5 shrink-0 items-center justify-center rounded text-xs font-bold"
          style={
            STATUS_STYLE[file.status]
              ? { color: STATUS_STYLE[file.status].color, background: STATUS_STYLE[file.status].bg }
              : undefined
          }
        >
          {STATUS_ICONS[file.status]}
        </span>
        <span className="file-name shrink-0 font-mono font-medium">{fileName}</span>
        {dirPath && (
          <span className="file-path text-text-muted ml-1 flex-1 truncate font-mono">
            {dirPath}
          </span>
        )}
        {isUntracked && (
          <span
            className="untracked-badge text-status-untracked text-2xs shrink-0 rounded px-1.5 py-px"
            style={{
              background:
                "color-mix(in srgb, var(--color-status-untracked) var(--badge-bg-mix), transparent)",
            }}
          >
            new
          </span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={menuItems}
        />
      )}
    </>
  );
});

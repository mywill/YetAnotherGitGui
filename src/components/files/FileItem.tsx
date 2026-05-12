import { memo, useCallback } from "react";
import clsx from "clsx";
import { IconCheck } from "@tabler/icons-react";
import type { FileStatus } from "../../types";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useContextMenu } from "../../hooks/useContextMenu";
import { STATUS_COLORS, getStatusLetter } from "../../utils/statusColors";

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
  // Intentionally NOT subscribing to repositoryInfo: a long file list would
  // re-render every row whenever any repository state changes. The repo path
  // is read lazily via useRepositoryStore.getState() in the context-menu
  // callback below — context menus open from a click, so the value is fresh.
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
          "file-item hover:bg-bg-hover min-h-row py-row-pad flex shrink-0 cursor-pointer items-center gap-2 px-3 text-xs transition-colors duration-100",
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
          {isStaged && <IconCheck size={10} stroke={1.5} aria-hidden />}
        </span>
        <span
          className="status-icon flex size-4.5 shrink-0 items-center justify-center rounded text-xs font-bold"
          style={
            STATUS_COLORS[file.status]
              ? {
                  color: STATUS_COLORS[file.status].color,
                  background: STATUS_COLORS[file.status].bg,
                }
              : undefined
          }
        >
          {getStatusLetter(file.status)}
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
            style={{ background: STATUS_COLORS.untracked.bg }}
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

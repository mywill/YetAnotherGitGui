import { useState, useCallback } from "react";
import clsx from "clsx";
import type { FileStatus, FileStatusType } from "../../types";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useRepositoryStore } from "../../stores/repositoryStore";

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

const STATUS_STYLE: Record<string, string> = {
  modified: "text-status-modified bg-status-modified/15",
  added: "text-status-added bg-status-added/15",
  deleted: "text-status-deleted bg-status-deleted/15",
  renamed: "text-status-modified bg-status-modified/15",
  untracked: "text-status-untracked bg-status-untracked/15",
  conflicted: "text-status-conflicted bg-status-conflicted/20",
};

export function FileItem({
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
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleStage();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.();
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const fileName = file.path.split("/").pop() || file.path;
  const dirPath = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : "";

  const repoPath = repositoryInfo?.path ?? "";

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
          "file-item hover:bg-bg-hover flex shrink-0 cursor-pointer items-center gap-2 px-3 py-1 text-xs transition-colors duration-100",
          isStaged && "staged bg-success/8 hover:bg-success/15",
          isSelected &&
            "selected bg-bg-selected outline-primary hover:bg-bg-selected-hover outline outline-1 -outline-offset-1",
          isStaged && isSelected && "bg-primary/20 hover:bg-primary/30"
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-testid="file-item"
        title={file.path}
      >
        <input
          type="checkbox"
          className="stage-checkbox accent-addition size-4 shrink-0 cursor-pointer"
          checked={isStaged}
          onChange={handleCheckboxChange}
          onClick={handleCheckboxClick}
          title={isStaged ? "Unstage file" : "Stage file"}
        />
        <span
          className={clsx(
            "status-icon flex size-4.5 shrink-0 items-center justify-center rounded text-xs font-bold",
            STATUS_STYLE[file.status] || ""
          )}
        >
          {STATUS_ICONS[file.status]}
        </span>
        <span className="file-name shrink-0 font-medium">{fileName}</span>
        {dirPath && (
          <span className="file-path text-text-muted ml-1 flex-1 truncate">{dirPath}</span>
        )}
        {isUntracked && (
          <span className="untracked-badge text-status-untracked bg-status-untracked/20 text-2xs shrink-0 rounded px-1.5 py-px">
            new
          </span>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={menuItems}
        />
      )}
    </>
  );
}

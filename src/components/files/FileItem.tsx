import { useState, useCallback } from "react";
import type { FileStatus, FileStatusType } from "../../types";
import { ContextMenu, type ContextMenuItem } from "../common/ContextMenu";
import { copyToClipboard } from "../../services/clipboard";
import { useRepositoryStore } from "../../stores/repositoryStore";
import "./FileItem.css";

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
        className={`file-item ${isStaged ? "staged" : ""} ${isSelected ? "selected" : ""}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-testid="file-item"
      >
        <input
          type="checkbox"
          className="stage-checkbox"
          checked={isStaged}
          onChange={handleCheckboxChange}
          onClick={handleCheckboxClick}
          title={isStaged ? "Unstage file" : "Stage file"}
        />
        <span className={`status-icon status-${file.status}`}>{STATUS_ICONS[file.status]}</span>
        <span className="file-name">{fileName}</span>
        {dirPath && <span className="file-path">{dirPath}</span>}
        {isUntracked && <span className="untracked-badge">new</span>}
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

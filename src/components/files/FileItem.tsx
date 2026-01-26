import { useState, useCallback } from "react";
import type { FileStatus, FileStatusType } from "../../types";
import { ContextMenu } from "../common/ContextMenu";
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
  onDelete?: () => void;
  onRevert?: () => void;
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
  onDelete,
  onRevert,
}: FileItemProps) {
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

  const menuItems = [];
  if (onRevert) {
    menuItems.push({
      label: "Revert changes",
      onClick: () => {
        onRevert();
        setContextMenu(null);
      },
    });
  }
  if (onDelete) {
    menuItems.push({
      label: "Delete file",
      onClick: () => {
        onDelete();
        setContextMenu(null);
      },
    });
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

      {contextMenu && menuItems.length > 0 && (
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

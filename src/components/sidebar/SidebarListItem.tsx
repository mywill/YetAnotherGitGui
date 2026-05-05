import type { MouseEvent, ReactNode } from "react";
import clsx from "clsx";

interface SidebarListItemProps {
  /** Identifying class — e.g. "branch-item", "tag-item", "stash-item". */
  itemClass: string;
  /** Extra modifier classes (e.g. "is-current", "is-remote text-text-muted"). */
  modifiers?: string;
  isSelected?: boolean;
  ariaCurrent?: "true" | undefined;
  title?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  children: ReactNode;
}

/**
 * Shared row container for branch/tag/stash sidebar entries. Owns the row
 * skeleton (height, hover, selection), each item supplies icon + content +
 * trailing badges as children.
 */
export function SidebarListItem({
  itemClass,
  modifiers,
  isSelected,
  ariaCurrent,
  title,
  onClick,
  onDoubleClick,
  onContextMenu,
  children,
}: SidebarListItemProps) {
  return (
    <div
      className={clsx(
        "text-text-primary hover:bg-bg-hover min-h-row flex cursor-pointer items-center gap-2 py-1 pr-3 pl-7 text-xs transition-colors duration-150",
        itemClass,
        modifiers,
        isSelected && "is-selected bg-bg-selected hover:bg-bg-selected-hover"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={title}
      aria-current={ariaCurrent}
    >
      {children}
    </div>
  );
}

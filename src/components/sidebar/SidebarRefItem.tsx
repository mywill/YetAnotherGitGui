import type { MouseEvent, ReactNode } from "react";
import type { ContextMenuItem } from "../common/ContextMenu";
import { ContextMenu } from "../common/ContextMenu";
import { SidebarListItem } from "./SidebarListItem";

interface SidebarRefItemProps {
  itemClass: string;
  title?: string;
  modifiers?: string;
  ariaCurrent?: "true" | undefined;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  contextMenuItems: ContextMenuItem[];
  contextMenuAnchor: { x: number; y: number } | null;
  onCloseContextMenu: () => void;
  children: ReactNode;
}

export function SidebarRefItem({
  itemClass,
  title,
  modifiers,
  ariaCurrent,
  onClick,
  onDoubleClick,
  onContextMenu,
  contextMenuItems,
  contextMenuAnchor,
  onCloseContextMenu,
  children,
}: SidebarRefItemProps) {
  return (
    <>
      <SidebarListItem
        itemClass={itemClass}
        modifiers={modifiers}
        ariaCurrent={ariaCurrent}
        title={title}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
      >
        {children}
      </SidebarListItem>
      {contextMenuAnchor && (
        <ContextMenu
          x={contextMenuAnchor.x}
          y={contextMenuAnchor.y}
          items={contextMenuItems}
          onClose={onCloseContextMenu}
        />
      )}
    </>
  );
}

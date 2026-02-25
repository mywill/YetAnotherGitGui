import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

function ContextMenuItemComponent({
  item,
  onClose,
}: {
  item: ContextMenuItem;
  onClose: () => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div
      ref={itemRef}
      className={clsx(
        "context-menu-item hover:bg-bg-hover cursor-pointer px-3 py-1 text-xs transition-colors duration-100",
        item.disabled && "disabled text-text-muted cursor-not-allowed hover:bg-transparent",
        hasChildren && "has-submenu relative flex items-center justify-between"
      )}
      onClick={() => {
        if (!item.disabled && !hasChildren && item.onClick) {
          item.onClick();
          onClose();
        }
      }}
      onMouseEnter={() => hasChildren && setSubmenuOpen(true)}
      onMouseLeave={() => hasChildren && setSubmenuOpen(false)}
    >
      <span>{item.label}</span>
      {hasChildren && <span className="submenu-arrow text-submenu-arrow ml-2">&#9656;</span>}
      {hasChildren && submenuOpen && (
        <div className="context-submenu border-border bg-bg-secondary shadow-menu absolute top-0 left-full min-w-40 rounded border py-1">
          {item.children!.map((child, idx) => (
            <div
              key={idx}
              className={clsx(
                "context-menu-item hover:bg-bg-hover cursor-pointer px-3 py-1 text-xs transition-colors duration-100",
                child.disabled && "disabled text-text-muted cursor-not-allowed hover:bg-transparent"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (!child.disabled && child.onClick) {
                  child.onClick();
                  onClose();
                }
              }}
            >
              {child.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const menu = (
    <div
      ref={menuRef}
      className="context-menu border-border bg-bg-secondary shadow-menu fixed min-w-40 rounded border py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <ContextMenuItemComponent key={index} item={item} onClose={onClose} />
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}

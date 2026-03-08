import { useEffect, useRef, useState, useCallback } from "react";
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
  isFocused,
  onMouseEnterItem,
  itemRef,
}: {
  item: ContextMenuItem;
  onClose: () => void;
  isFocused: boolean;
  onMouseEnterItem: () => void;
  itemRef: (el: HTMLDivElement | null) => void;
}) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuFocusIndex, setSubmenuFocusIndex] = useState(-1);
  const submenuRefs = useRef<(HTMLDivElement | null)[]>([]);

  const hasChildren = item.children && item.children.length > 0;

  // Open submenu when focused and ArrowRight is pressed (handled by parent)
  // Also open on hover
  useEffect(() => {
    if (!isFocused) {
      setSubmenuOpen(false);
      setSubmenuFocusIndex(-1);
    }
  }, [isFocused]);

  const openSubmenu = useCallback(() => {
    if (hasChildren) {
      setSubmenuOpen(true);
      // Focus first enabled child
      const firstEnabled = item.children!.findIndex((c) => !c.disabled);
      setSubmenuFocusIndex(firstEnabled >= 0 ? firstEnabled : 0);
    }
  }, [hasChildren, item.children]);

  const closeSubmenu = useCallback(() => {
    setSubmenuOpen(false);
    setSubmenuFocusIndex(-1);
  }, []);

  // Focus submenu item when submenuFocusIndex changes
  useEffect(() => {
    if (submenuOpen && submenuFocusIndex >= 0) {
      submenuRefs.current[submenuFocusIndex]?.focus();
    }
  }, [submenuOpen, submenuFocusIndex]);

  const handleSubmenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!item.children) return;

      const enabledIndices = item.children
        .map((c, i) => (!c.disabled ? i : -1))
        .filter((i) => i >= 0);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          e.stopPropagation();
          const currentPos = enabledIndices.indexOf(submenuFocusIndex);
          const nextPos = (currentPos + 1) % enabledIndices.length;
          setSubmenuFocusIndex(enabledIndices[nextPos]);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          e.stopPropagation();
          const currentPos = enabledIndices.indexOf(submenuFocusIndex);
          const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
          setSubmenuFocusIndex(enabledIndices[prevPos]);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          e.stopPropagation();
          closeSubmenu();
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          e.stopPropagation();
          const child = item.children[submenuFocusIndex];
          if (child && !child.disabled && child.onClick) {
            child.onClick();
            onClose();
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          e.stopPropagation();
          closeSubmenu();
          break;
        }
      }
    },
    [item.children, submenuFocusIndex, closeSubmenu, onClose]
  );

  return (
    <div
      ref={itemRef}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={item.disabled || undefined}
      aria-haspopup={hasChildren ? "menu" : undefined}
      aria-expanded={hasChildren ? submenuOpen : undefined}
      className={clsx(
        "context-menu-item hover:bg-bg-hover cursor-pointer px-3 py-1 text-xs transition-colors duration-100",
        item.disabled && "disabled text-text-muted cursor-not-allowed hover:bg-transparent",
        hasChildren && "has-submenu relative flex items-center justify-between",
        isFocused && "bg-bg-hover"
      )}
      onClick={() => {
        if (!item.disabled && !hasChildren && item.onClick) {
          item.onClick();
          onClose();
        }
      }}
      onMouseEnter={() => {
        onMouseEnterItem();
        if (hasChildren) setSubmenuOpen(true);
      }}
      onMouseLeave={() => {
        if (hasChildren) setSubmenuOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && hasChildren) {
          e.preventDefault();
          openSubmenu();
        }
      }}
    >
      <span>{item.label}</span>
      {hasChildren && <span className="submenu-arrow text-submenu-arrow ml-2">&#9656;</span>}
      {hasChildren && submenuOpen && (
        <div
          role="menu"
          className="context-submenu border-border bg-bg-secondary shadow-menu absolute top-0 left-full min-w-40 rounded border py-1"
          onKeyDown={handleSubmenuKeyDown}
        >
          {item.children!.map((child, idx) => (
            <div
              key={idx}
              ref={(el) => {
                submenuRefs.current[idx] = el;
              }}
              role="menuitem"
              tabIndex={-1}
              aria-disabled={child.disabled || undefined}
              className={clsx(
                "context-menu-item hover:bg-bg-hover cursor-pointer px-3 py-1 text-xs transition-colors duration-100",
                child.disabled &&
                  "disabled text-text-muted cursor-not-allowed hover:bg-transparent",
                idx === submenuFocusIndex && "bg-bg-hover"
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
  const [focusIndex, setFocusIndex] = useState(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const enabledIndices = items.map((item, i) => (!item.disabled ? i : -1)).filter((i) => i >= 0);

  // Auto-focus first enabled item on mount
  useEffect(() => {
    const firstEnabled = enabledIndices[0];
    if (firstEnabled !== undefined) {
      setFocusIndex(firstEnabled);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the active item when focusIndex changes
  useEffect(() => {
    if (focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]!.focus();
    }
  }, [focusIndex]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const currentPos = enabledIndices.indexOf(focusIndex);
          const nextPos = (currentPos + 1) % enabledIndices.length;
          setFocusIndex(enabledIndices[nextPos]);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const currentPos = enabledIndices.indexOf(focusIndex);
          const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
          setFocusIndex(enabledIndices[prevPos]);
          break;
        }
        case "Home": {
          e.preventDefault();
          if (enabledIndices.length > 0) {
            setFocusIndex(enabledIndices[0]);
          }
          break;
        }
        case "End": {
          e.preventDefault();
          if (enabledIndices.length > 0) {
            setFocusIndex(enabledIndices[enabledIndices.length - 1]);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const item = items[focusIndex];
          if (item && !item.disabled) {
            if (item.children && item.children.length > 0) {
              // ArrowRight opens submenu, handled in item component
            } else if (item.onClick) {
              item.onClick();
              onClose();
            }
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          onClose();
          break;
        }
      }
    },
    [enabledIndices, focusIndex, items, onClose]
  );

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      className="context-menu border-border bg-bg-secondary shadow-menu fixed min-w-40 rounded border py-1"
      style={{ left: x, top: y }}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => (
        <ContextMenuItemComponent
          key={index}
          item={item}
          onClose={onClose}
          isFocused={index === focusIndex}
          onMouseEnterItem={() => setFocusIndex(index)}
          itemRef={(el) => {
            itemRefs.current[index] = el;
          }}
        />
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}

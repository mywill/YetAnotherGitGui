import {
  createContext,
  useCallback,
  useContext,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { ListImperativeAPI } from "react-window";

interface KeyboardListVirtualizedProps {
  "aria-label": string;
  itemCount: number;
  listRef: RefObject<ListImperativeAPI | null>;
  onActivate?: (index: number) => void;
  onSecondaryActivate?: (index: number) => void;
  onDelete?: (index: number) => void;
  onFocusChange?: (index: number) => void;
  children: ReactNode;
  className?: string;
}

interface VirtualizedFocusContextValue {
  focusedIndex: number;
}

const VirtualizedFocusContext = createContext<VirtualizedFocusContextValue>({
  focusedIndex: -1,
});

export function useVirtualizedFocus() {
  return useContext(VirtualizedFocusContext);
}

export function KeyboardListVirtualized({
  "aria-label": ariaLabel,
  itemCount,
  listRef,
  onActivate,
  onSecondaryActivate,
  onDelete,
  onFocusChange,
  children,
  className,
}: KeyboardListVirtualizedProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const scrollTo = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      onFocusChange?.(index);
      if (listRef.current) {
        listRef.current.scrollToRow({ index, align: "center" });
      }
    },
    [listRef, onFocusChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (itemCount === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = focusedIndex < itemCount - 1 ? focusedIndex + 1 : 0;
          scrollTo(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = focusedIndex > 0 ? focusedIndex - 1 : itemCount - 1;
          scrollTo(prev);
          break;
        }
        case "Home": {
          e.preventDefault();
          scrollTo(0);
          break;
        }
        case "End": {
          e.preventDefault();
          scrollTo(itemCount - 1);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0) {
            onActivate?.(focusedIndex);
          }
          break;
        }
        case " ": {
          e.preventDefault();
          if (focusedIndex >= 0) {
            onSecondaryActivate?.(focusedIndex);
          }
          break;
        }
        case "Delete":
        case "Backspace": {
          e.preventDefault();
          if (focusedIndex >= 0) {
            onDelete?.(focusedIndex);
          }
          break;
        }
      }
    },
    [focusedIndex, itemCount, scrollTo, onActivate, onSecondaryActivate, onDelete]
  );

  return (
    <VirtualizedFocusContext.Provider value={{ focusedIndex }}>
      <div
        role="listbox"
        aria-label={ariaLabel}
        {...(onDelete ? { "aria-keyshortcuts": "Delete" } : {})}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={className}
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
        onFocus={() => {
          if (focusedIndex < 0 && itemCount > 0) {
            setFocusedIndex(0);
            onFocusChange?.(0);
          }
        }}
      >
        {children}
      </div>
    </VirtualizedFocusContext.Provider>
  );
}

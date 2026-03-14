import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

interface KeyboardListProps {
  "aria-label": string;
  onActivate?: (index: number) => void;
  onSecondaryActivate?: (index: number) => void;
  onDelete?: (index: number) => void;
  onActiveChange?: (index: number, isShift: boolean) => void;
  children: ReactNode;
  className?: string;
}

interface KeyboardListItemProps {
  index: number;
  children: ReactNode;
  className?: string;
}

interface KeyboardListContextValue {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onActiveChange: RefObject<((index: number, isShift: boolean) => void) | undefined>;
  registerItem: (index: number, el: HTMLDivElement | null) => void;
  skipNextFocus: RefObject<boolean>;
  itemCount: number;
  listId: string;
  listRef: RefObject<HTMLDivElement | null>;
}

const KeyboardListContext = createContext<KeyboardListContextValue>({
  activeIndex: 0,
  setActiveIndex: () => {},
  onActiveChange: { current: undefined },
  registerItem: () => {},
  skipNextFocus: { current: false },
  itemCount: 0,
  listId: "",
  listRef: { current: null },
});

function KeyboardListItem({ index, children, className }: KeyboardListItemProps) {
  const { activeIndex, setActiveIndex, registerItem, skipNextFocus, listId, listRef } =
    useContext(KeyboardListContext);
  const isActive = index === activeIndex;

  const handleClick = useCallback(() => {
    setActiveIndex(index);
    skipNextFocus.current = true;
    listRef.current?.focus();
  }, [index, setActiveIndex, skipNextFocus, listRef]);

  return (
    <div
      role="option"
      id={`${listId}-item-${index}`}
      aria-selected={isActive}
      tabIndex={-1}
      ref={(el) => registerItem(index, el)}
      className={className}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

export function KeyboardList({
  "aria-label": ariaLabel,
  onActivate,
  onSecondaryActivate,
  onDelete,
  onActiveChange,
  children,
  className,
}: KeyboardListProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const itemCountRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const skipNextFocusRef = useRef(false);
  const listId = useId();

  const registerItem = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(index, el);
      if (index >= itemCountRef.current) {
        itemCountRef.current = index + 1;
      }
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  const prevCountRef = useRef(0);

  useEffect(() => {
    const count = itemRefs.current.size;
    const prevCount = prevCountRef.current;
    prevCountRef.current = count;

    if (count === 0) return;
    if (activeIndex >= count) {
      const clamped = count - 1;
      setActiveIndex(clamped);
      onActiveChangeRef.current?.(clamped, false);
    } else if (count < prevCount) {
      // Items removed but index still valid — item at this index shifted
      onActiveChangeRef.current?.(activeIndex, false);
    }
  });

  const scrollToItem = useCallback((index: number, isShift = false) => {
    setActiveIndex(index);
    onActiveChangeRef.current?.(index, isShift);
    const el = itemRefs.current.get(index);
    if (el) {
      el.scrollIntoView?.({ block: "nearest" });
    }
  }, []);

  const getItemCount = useCallback(() => {
    return itemRefs.current.size;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const count = getItemCount();
      if (count === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = (activeIndex + 1) % count;
          scrollToItem(next, e.shiftKey);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = (activeIndex - 1 + count) % count;
          scrollToItem(prev, e.shiftKey);
          break;
        }
        case "Home": {
          e.preventDefault();
          scrollToItem(0);
          break;
        }
        case "End": {
          e.preventDefault();
          scrollToItem(count - 1);
          break;
        }
        case "Enter": {
          e.preventDefault();
          onActivate?.(activeIndex);
          break;
        }
        case " ": {
          e.preventDefault();
          onSecondaryActivate?.(activeIndex);
          break;
        }
        case "Delete":
        case "Backspace": {
          e.preventDefault();
          onDelete?.(activeIndex);
          break;
        }
      }
    },
    [activeIndex, scrollToItem, getItemCount, onActivate, onSecondaryActivate, onDelete]
  );

  return (
    <KeyboardListContext.Provider
      value={{
        activeIndex,
        setActiveIndex,
        onActiveChange: onActiveChangeRef,
        registerItem,
        skipNextFocus: skipNextFocusRef,
        itemCount: itemCountRef.current,
        listId,
        listRef,
      }}
    >
      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`${listId}-item-${activeIndex}`}
        {...(onDelete ? { "aria-keyshortcuts": "Delete" } : {})}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (skipNextFocusRef.current) {
            skipNextFocusRef.current = false;
            return;
          }
          const count = itemRefs.current.size;
          if (count > 0) {
            onActiveChangeRef.current?.(activeIndex, false);
          }
        }}
        className={className}
      >
        {children}
      </div>
    </KeyboardListContext.Provider>
  );
}

KeyboardList.Item = KeyboardListItem;

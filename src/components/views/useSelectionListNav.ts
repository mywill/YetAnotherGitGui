import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useCleanupStore, type CleanupCategory } from "../../stores/cleanupStore";

export interface SelectionListNav {
  activeIndex: number;
  listboxId: string;
  listRef: React.RefObject<HTMLUListElement | null>;
  rowIdFor: (i: number) => string;
  handleRowClick: (id: string, index: number, e: MouseEvent) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLUListElement>) => void;
}

export function useSelectionListNav(args: {
  category: CleanupCategory;
  allIds: string[];
  selected: Set<string>;
  onRun: () => void;
}): SelectionListNav {
  const { category, allIds, selected, onRun } = args;

  const toggleSelection = useCleanupStore((s) => s.toggleSelection);
  const selectAllCategory = useCleanupStore((s) => s.selectAll);
  const selectNoneCategory = useCleanupStore((s) => s.selectNone);
  const setRangeSelection = useCleanupStore((s) => s.setRangeSelection);
  const extendSelection = useCleanupStore((s) => s.extendSelection);
  const lastSelectedId = useCleanupStore((s) => s[category].lastSelectedId);

  // Clamp active-row index so list shrinkage doesn't leave it past the end.
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    if (activeIndex >= allIds.length && allIds.length > 0) {
      setActiveIndex(allIds.length - 1);
    }
  }, [allIds.length, activeIndex]);

  const listboxId = useId();
  const rowIdFor = (i: number) => `${listboxId}-row-${i}`;
  const listRef = useRef<HTMLUListElement>(null);

  const handleRowClick = (id: string, index: number, e: MouseEvent) => {
    setActiveIndex(index);
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    if (isShift && lastSelectedId) {
      const start = allIds.indexOf(lastSelectedId);
      const end = allIds.indexOf(id);
      if (start !== -1 && end !== -1) {
        const [lo, hi] = start < end ? [start, end] : [end, start];
        setRangeSelection(category, allIds.slice(lo, hi + 1));
        return;
      }
    }
    if (isCtrl) {
      toggleSelection(category, id);
      return;
    }
    // Plain click: replace selection with this single item.
    if (selected.size === 1 && selected.has(id)) {
      selectNoneCategory(category);
    } else {
      setRangeSelection(category, [id]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (allIds.length === 0) return;
    const moveTo = (next: number) => {
      const clamped = Math.max(0, Math.min(allIds.length - 1, next));
      setActiveIndex(clamped);
      if (e.shiftKey && lastSelectedId) {
        const anchorIdx = allIds.indexOf(lastSelectedId);
        if (anchorIdx !== -1) {
          const [lo, hi] = anchorIdx < clamped ? [anchorIdx, clamped] : [clamped, anchorIdx];
          // extendSelection preserves the anchor so the user can keep
          // expanding from the same point with repeated Shift+Arrow.
          extendSelection(category, allIds.slice(lo, hi + 1));
        }
      }
    };

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        moveTo(activeIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveTo(activeIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(allIds.length - 1);
        break;
      case " ": {
        e.preventDefault();
        const id = allIds[activeIndex];
        if (id !== undefined) toggleSelection(category, id);
        break;
      }
      case "Enter":
        e.preventDefault();
        if (selected.size > 0) onRun();
        break;
      case "a":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          selectAllCategory(category);
        }
        break;
    }
  };

  return { activeIndex, listboxId, listRef, rowIdFor, handleRowClick, handleKeyDown };
}

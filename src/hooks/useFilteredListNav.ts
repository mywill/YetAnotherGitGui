import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { matchesQuery } from "./useCommandPaletteSearch";

interface UseFilteredListNavOptions<T> {
  items: T[];
  getLabel: (item: T) => string;
  open: boolean;
  onActivate: (item: T, index: number) => void;
  onEscape?: () => void;
}

interface UseFilteredListNavResult<T> {
  query: string;
  setQuery: (q: string) => void;
  filtered: T[];
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Filtered-list keyboard navigation for standalone popovers (filter input +
 * single-select listbox). Shared by BranchSwitcher and any future picker.
 */
export function useFilteredListNav<T>({
  items,
  getLabel,
  open,
  onActivate,
  onEscape,
}: UseFilteredListNavOptions<T>): UseFilteredListNavResult<T> {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter((it) => matchesQuery(getLabel(it), q));
  }, [items, query, getLabel]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape?.();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        if (filtered.length > 0) setActiveIndex(filtered.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) onActivate(item, activeIndex);
      }
    },
    [filtered, activeIndex, onActivate, onEscape]
  );

  return { query, setQuery, filtered, activeIndex, setActiveIndex, handleKeyDown };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCommandPaletteStore, type FilterCategory } from "../../stores/commandPaletteStore";
import { useCommandPaletteSearch, type SearchResult } from "../../hooks/useCommandPaletteSearch";
import { useSelectionStore } from "../../stores/selectionStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import type { GraphCommit, BranchInfo, TagInfo, FileStatus, StashInfo } from "../../types";

const FILTER_CHIPS: { label: string; value: FilterCategory; shortcut: string }[] = [
  { label: "Commits", value: "commits", shortcut: "1" },
  { label: "Branches", value: "branches", shortcut: "2" },
  { label: "Tags", value: "tags", shortcut: "3" },
  { label: "Authors", value: "authors", shortcut: "4" },
  { label: "Files", value: "files", shortcut: "5" },
  { label: "Stashes", value: "stashes", shortcut: "6" },
];

const CATEGORY_LABELS: Record<string, string> = {
  commits: "Commits",
  branches: "Branches",
  tags: "Tags",
  authors: "Authors",
  files: "Files",
  stashes: "Stashes",
};

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const activeFilter = useCommandPaletteStore((s) => s.activeFilter);
  const close = useCommandPaletteStore((s) => s.close);
  const toggleFilter = useCommandPaletteStore((s) => s.toggleFilter);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useCommandPaletteSearch(query, activeFilter);

  // Reset state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[aria-selected="true"]');
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      const selectAndScrollToCommit = useSelectionStore.getState().selectAndScrollToCommit;
      const setActiveView = useSelectionStore.getState().setActiveView;
      const selectFile = useSelectionStore.getState().selectFile;
      const loadStashDetails = useRepositoryStore.getState().loadStashDetails;

      switch (result.category) {
        case "commits": {
          const commit = result.data as GraphCommit;
          selectAndScrollToCommit(commit.hash);
          break;
        }
        case "branches": {
          const branch = result.data as BranchInfo;
          selectAndScrollToCommit(branch.target_hash);
          break;
        }
        case "tags": {
          const tag = result.data as TagInfo;
          selectAndScrollToCommit(tag.target_hash);
          break;
        }
        case "authors": {
          const commit = result.data as GraphCommit;
          selectAndScrollToCommit(commit.hash);
          break;
        }
        case "files": {
          const file = result.data as FileStatus;
          setActiveView("status");
          selectFile(file.path, file.is_staged);
          break;
        }
        case "stashes": {
          const stash = result.data as StashInfo;
          setActiveView("status");
          loadStashDetails(stash.index);
          break;
        }
      }

      close();
    },
    [close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (results[activeIndex]) {
          selectResult(results[activeIndex]);
        }
        return;
      }

      // Ctrl+1 through Ctrl+6 for filter shortcuts
      if (e.ctrlKey || e.metaKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 6) {
          e.preventDefault();
          toggleFilter(FILTER_CHIPS[num - 1].value);
        }
      }
    },
    [close, results, activeIndex, selectResult, toggleFilter]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );

  if (!isOpen) return null;

  // Group results by category for "all" mode
  const groupedResults =
    activeFilter === "all"
      ? results.reduce<Record<string, SearchResult[]>>((acc, r) => {
          if (!acc[r.category]) acc[r.category] = [];
          acc[r.category].push(r);
          return acc;
        }, {})
      : null;

  // Build flat list with category header indices for rendering
  let flatIndex = 0;

  return createPortal(
    <div
      className="command-palette-backdrop fixed inset-0 bg-black/50"
      style={{ zIndex: 9999 }}
      onClick={handleBackdropClick}
    >
      <div
        className="command-palette border-border bg-bg-secondary shadow-dialog mx-auto mt-16 flex max-h-[min(500px,70vh)] max-w-xl flex-col overflow-hidden rounded-lg border"
        style={{ animation: "slideDown 0.15s ease" }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <span className="text-text-muted text-sm">&#128269;</span>
          <input
            ref={inputRef}
            type="search"
            className="flex-1 border-none bg-transparent p-0 text-sm outline-none"
            placeholder="Search commits, branches, tags, authors, files..."
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Filter chips */}
        <div
          className="border-border flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5"
          role="radiogroup"
          aria-label="Filter categories"
        >
          <button
            role="radio"
            aria-checked={activeFilter === "all"}
            className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors ${
              activeFilter === "all"
                ? "bg-bg-selected text-white"
                : "text-text-secondary hover:bg-bg-hover"
            }`}
            onClick={() => toggleFilter("all")}
          >
            All
          </button>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              role="radio"
              aria-checked={activeFilter === chip.value}
              className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors ${
                activeFilter === chip.value
                  ? "bg-bg-selected text-white"
                  : "text-text-secondary hover:bg-bg-hover"
              }`}
              onClick={() => toggleFilter(chip.value)}
            >
              {chip.label}
              <sup className="text-text-muted ml-0.5 text-[9px]">{chip.shortcut}</sup>
            </button>
          ))}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto"
          role="listbox"
          aria-activedescendant={results[activeIndex]?.id}
          aria-label="Search results"
        >
          {activeFilter !== "all" && results.length > 0 && (
            <div className="text-text-muted px-3 pt-2 text-[10px]">
              Showing: {CATEGORY_LABELS[activeFilter]}
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <div className="text-text-muted px-3 py-4 text-center text-xs">No results found</div>
          )}

          {groupedResults
            ? // "All" mode: grouped by category
              Object.entries(groupedResults).map(([category, items]) => {
                const headerContent = (
                  <div
                    key={`header-${category}`}
                    className="text-text-muted px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase"
                  >
                    {CATEGORY_LABELS[category]}
                  </div>
                );
                const itemElements = items.map((result) => {
                  const idx = flatIndex++;
                  return (
                    <ResultItem
                      key={result.id}
                      result={result}
                      isActive={idx === activeIndex}
                      onClick={() => selectResult(result)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    />
                  );
                });
                return [headerContent, ...itemElements];
              })
            : // Filtered mode: flat list
              results.map((result, idx) => (
                <ResultItem
                  key={result.id}
                  result={result}
                  isActive={idx === activeIndex}
                  onClick={() => selectResult(result)}
                  onMouseEnter={() => setActiveIndex(idx)}
                />
              ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResultItem({
  result,
  isActive,
  onClick,
  onMouseEnter,
}: {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <div
      id={result.id}
      role="option"
      aria-selected={isActive}
      className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs ${
        isActive ? "bg-bg-hover text-text-primary" : "text-text-secondary hover:bg-bg-hover/50"
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span className="min-w-0 flex-1 truncate">{result.label}</span>
      <span className="text-text-muted shrink-0 text-[10px]">{result.detail}</span>
    </div>
  );
}

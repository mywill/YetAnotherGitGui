import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { IconChevronDown } from "@tabler/icons-react";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { matchesQuery } from "../../hooks/useCommandPaletteSearch";

interface BranchSwitcherProps {
  branchName: string;
  isDetached: boolean;
}

export function BranchSwitcher({ branchName, isDetached }: BranchSwitcherProps) {
  const branches = useRepositoryStore((s) => s.branches);
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local branches only — HEAD first, then alphabetical.
  const orderedLocals = useMemo(() => {
    const locals = branches.filter((b) => !b.is_remote);
    return [...locals].sort((a, b) => {
      if (a.is_head && !b.is_head) return -1;
      if (!a.is_head && b.is_head) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [branches]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return orderedLocals;
    return orderedLocals.filter((b) => matchesQuery(b.name, q));
  }, [orderedLocals, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        close();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, close]);

  const activate = useCallback(
    async (index: number) => {
      const branch = filtered[index];
      if (!branch) return;
      if (branch.is_head) {
        close();
        return;
      }
      setOpen(false);
      const confirmed = await showConfirm({
        title: "Switch branch",
        message: `Switch to branch "${branch.name}"?`,
        confirmLabel: "Switch",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        await checkoutBranch(branch.name);
      }
      triggerRef.current?.focus();
    },
    [filtered, checkoutBranch, showConfirm, close]
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
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
        void activate(activeIndex);
      }
    },
    [filtered.length, activeIndex, activate, close]
  );

  const onTriggerClick = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const triggerLabel = isDetached ? branchName : branchName;

  return (
    <div ref={containerRef} className="branch-switcher relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Switch branch"
        title="Switch branch"
        disabled={isDetached}
        className={clsx(
          "branch-switcher-trigger text-text-muted hover:text-text-primary inline-flex items-center gap-1 truncate rounded px-1 font-mono",
          !isDetached && "hover:bg-bg-hover cursor-pointer",
          isDetached && "cursor-default"
        )}
      >
        <span className="branch-indicator truncate">{triggerLabel}</span>
        {!isDetached && (
          <IconChevronDown size={10} stroke={2} className="shrink-0 opacity-70" aria-hidden />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Switch branch"
          className="branch-switcher-popover border-border bg-bg-panel absolute bottom-full left-0 z-50 mb-1 flex max-h-80 w-64 flex-col rounded-md border shadow-lg"
        >
          <div className="border-border border-b px-2 py-1.5">
            <div className="text-text-muted text-3xs mb-1 font-mono font-medium tracking-widest uppercase">
              Switch branch
            </div>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Filter branches"
              aria-label="Filter branches"
              className="!text-2xs w-full !py-1"
            />
          </div>
          <div
            role="listbox"
            aria-label="Branches"
            aria-activedescendant={
              filtered[activeIndex] ? `branch-switcher-${filtered[activeIndex].name}` : undefined
            }
            className="min-h-0 flex-1 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <div className="text-text-muted text-2xs px-3 py-2">No branches match</div>
            )}
            {filtered.map((b, i) => (
              <div
                key={b.name}
                id={`branch-switcher-${b.name}`}
                role="option"
                aria-selected={i === activeIndex}
                aria-current={b.is_head ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => void activate(i)}
                className={clsx(
                  "branch-switcher-item flex cursor-pointer items-center gap-2 px-3 py-1 text-xs",
                  i === activeIndex && "bg-bg-hover",
                  b.is_head && "text-accent-cyan"
                )}
              >
                <span className="flex-1 truncate font-mono">{b.name}</span>
                {b.is_head && (
                  <span className="bg-accent-cyan/15 text-accent-cyan text-2xs rounded px-1 py-px font-medium">
                    current
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

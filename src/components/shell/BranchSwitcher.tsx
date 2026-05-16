import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import type { BranchInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useFilteredListNav } from "../../hooks/useFilteredListNav";
import { validateBranchName } from "../../services/git";

interface BranchSwitcherProps {
  branchName: string;
  isDetached: boolean;
}

type SwitcherRow = { kind: "branch"; branch: BranchInfo } | { kind: "create"; name: string };

const getRowLabel = (row: SwitcherRow) => (row.kind === "branch" ? row.branch.name : row.name);

const rowKey = (row: SwitcherRow) =>
  row.kind === "branch" ? `branch:${row.branch.name}` : `create:${row.name}`;

type Validation = { ok: true } | { ok: false; reason: string } | null;

export const BranchSwitcher = ({ branchName, isDetached }: BranchSwitcherProps) => {
  const branches = useRepositoryStore((s) => s.branches);
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const createBranch = useRepositoryStore((s) => s.createBranch);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const [open, setOpen] = useState(false);
  const [nameValidation, setNameValidation] = useState<Validation>(null);

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

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const activate = useCallback(
    async (row: SwitcherRow) => {
      if (row.kind === "create") {
        setOpen(false);
        try {
          await createBranch(row.name);
        } catch {
          // Store action surfaces errors via toast; ignore here so the popover
          // still closes cleanly.
        }
        triggerRef.current?.focus();
        return;
      }
      const branch = row.branch;
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
    [checkoutBranch, createBranch, showConfirm, close]
  );

  // Build the row list. The create row's existence depends on the typed text
  // being valid AND not already an exact match.
  const buildRows = useCallback(
    (query: string): SwitcherRow[] => {
      const branchRows: SwitcherRow[] = orderedLocals.map((branch) => ({
        kind: "branch" as const,
        branch,
      }));
      const trimmed = query.trim();
      if (!trimmed) return branchRows;
      const exactMatch = orderedLocals.some((b) => b.name === trimmed);
      if (exactMatch || !nameValidation || !nameValidation.ok) return branchRows;
      return [...branchRows, { kind: "create" as const, name: trimmed }];
    },
    [orderedLocals, nameValidation]
  );

  const [rows, setRows] = useState<SwitcherRow[]>(() => buildRows(""));

  const { query, setQuery, filtered, activeIndex, setActiveIndex, handleKeyDown } =
    useFilteredListNav<SwitcherRow>({
      items: rows,
      getLabel: getRowLabel,
      open,
      onActivate: activate,
      onEscape: () => {
        setQuery("");
        close();
      },
    });

  // Re-validate when query changes; debounce-free is fine — invoke is sub-ms.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setNameValidation(null);
      return;
    }
    let cancelled = false;
    validateBranchName(trimmed).then((result) => {
      if (!cancelled) setNameValidation(result);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Keep rows in sync with query + validation.
  useEffect(() => {
    setRows(buildRows(query));
  }, [query, buildRows]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setNameValidation(null);
    inputRef.current?.focus();

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        close();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, close, setQuery]);

  const onTriggerClick = useCallback(() => {
    setOpen((o) => !o);
  }, []);

  const trimmedQuery = query.trim();
  const showWarning = trimmedQuery.length > 0 && nameValidation !== null && !nameValidation.ok;

  return (
    <div ref={containerRef} className="branch-switcher relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={onTriggerClick}
        aria-haspopup="listbox"
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
        <span className="branch-indicator truncate">{branchName}</span>
        {!isDetached && (
          <IconChevronDown size={10} stroke={2} className="shrink-0 opacity-70" aria-hidden />
        )}
      </button>
      {open && (
        <div className="branch-switcher-popover border-border bg-bg-panel absolute bottom-full left-0 z-50 mb-1 flex max-h-80 w-64 flex-col rounded-md border shadow-lg">
          <div className="border-border border-b px-2 py-1.5">
            <div className="text-text-muted text-2xs mb-1 font-mono font-medium tracking-widest uppercase">
              Switch branch
            </div>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filter or type new branch name"
              aria-label="Filter branches"
              aria-controls="branch-switcher-listbox"
              aria-activedescendant={
                filtered[activeIndex]
                  ? `branch-switcher-${rowKey(filtered[activeIndex])}`
                  : undefined
              }
              className="text-2xs font-inherit bg-bg-well text-text-primary border-border focus-ring px-card-x w-full rounded border py-1"
            />
          </div>
          <div
            id="branch-switcher-listbox"
            role="listbox"
            aria-label="Branches"
            className="min-h-0 flex-1 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <div className="text-text-muted text-2xs px-3 py-2">No branches match</div>
            )}
            {filtered.map((row, i) =>
              row.kind === "branch" ? (
                <div
                  key={rowKey(row)}
                  id={`branch-switcher-${rowKey(row)}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-current={row.branch.is_head ? "true" : undefined}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => void activate(row)}
                  className={clsx(
                    "branch-switcher-item flex cursor-pointer items-center gap-2 px-3 py-1 text-xs",
                    i === activeIndex && "bg-bg-hover",
                    row.branch.is_head && "text-accent-cyan"
                  )}
                >
                  <span className="flex-1 truncate font-mono">{row.branch.name}</span>
                  {row.branch.is_head && (
                    <span className="bg-accent-cyan/15 text-accent-cyan text-2xs rounded px-1 py-px font-medium">
                      current
                    </span>
                  )}
                </div>
              ) : (
                <div
                  key={rowKey(row)}
                  id={`branch-switcher-${rowKey(row)}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => void activate(row)}
                  className={clsx(
                    "branch-switcher-item branch-switcher-create flex cursor-pointer items-center gap-2 px-3 py-1 text-xs italic",
                    i === activeIndex && "bg-bg-hover"
                  )}
                >
                  <IconPlus size={12} stroke={2} className="shrink-0 opacity-80" aria-hidden />
                  <span className="flex-1 truncate font-mono">Create &lsquo;{row.name}&rsquo;</span>
                </div>
              )
            )}
          </div>
          {showWarning && nameValidation && !nameValidation.ok && (
            <div className="branch-switcher-warning border-border text-text-muted text-2xs border-t px-3 py-1.5">
              ⚠ {nameValidation.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

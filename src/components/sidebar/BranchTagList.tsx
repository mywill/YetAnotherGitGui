import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { IconChevronRight } from "@tabler/icons-react";
import type { BranchInfo, TagInfo } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBranchFilterStore } from "../../stores/branchFilterStore";
import { KeyboardList } from "../common/KeyboardList";
import { BranchItem } from "./BranchItem";
import { TagItem } from "./TagItem";
import { matchesQuery, SEARCH_DEBOUNCE_MS } from "../../hooks/useCommandPaletteSearch";

const SECTION_KEY_LOCAL = "sidebar.branches.local";
const SECTION_KEY_REMOTE = "sidebar.branches.remote";
const SECTION_KEY_TAGS = "sidebar.tags";

export function BranchTagList() {
  const branches = useRepositoryStore((s) => s.branches);
  const tags = useRepositoryStore((s) => s.tags);
  const checkoutBranch = useRepositoryStore((s) => s.checkoutBranch);
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const selectAndScrollToCommit = useSelectionStore((s) => s.selectAndScrollToCommit);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const localExpanded = useSettingsStore((s) => s.sectionExpanded[SECTION_KEY_LOCAL] ?? false);
  const remoteExpanded = useSettingsStore((s) => s.sectionExpanded[SECTION_KEY_REMOTE] ?? false);
  const tagsExpanded = useSettingsStore((s) => s.sectionExpanded[SECTION_KEY_TAGS] ?? false);
  const setSectionExpanded = useSettingsStore((s) => s.setSectionExpanded);

  const filterQuery = useBranchFilterStore((s) => s.query);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(filterQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filterQuery]);

  const allLocals = useMemo(() => branches.filter((b) => !b.is_remote), [branches]);
  const allRemotes = useMemo(() => branches.filter((b) => b.is_remote), [branches]);

  const handleBranchActivate = useCallback(
    (branchList: BranchInfo[]) => async (index: number) => {
      const branch = branchList[index];
      if (!branch) return;
      if (branch.target_hash) {
        selectAndScrollToCommit(branch.target_hash);
      }
      if (branch.is_head) return;
      if (branch.is_remote) {
        await showConfirm({
          title: "Remote Branch",
          message: `To checkout remote branch "${branch.name}", create a local tracking branch first.`,
          confirmLabel: "OK",
          cancelLabel: "Cancel",
        });
        return;
      }
      const confirmed = await showConfirm({
        title: "Switch Branch",
        message: `Switch to branch "${branch.name}"?`,
        confirmLabel: "Switch",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutBranch(branch.name);
      }
    },
    [selectAndScrollToCommit, checkoutBranch, showConfirm]
  );

  const handleBranchSecondaryActivate = useCallback(
    (branchList: BranchInfo[]) => async (index: number) => {
      const branch = branchList[index];
      if (!branch || branch.is_head) return;
      if (branch.is_remote) {
        await showConfirm({
          title: "Remote Branch",
          message: `To checkout remote branch "${branch.name}", create a local tracking branch first.`,
          confirmLabel: "OK",
          cancelLabel: "Cancel",
        });
        return;
      }
      const confirmed = await showConfirm({
        title: "Switch Branch",
        message: `Switch to branch "${branch.name}"?`,
        confirmLabel: "Switch",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutBranch(branch.name);
      }
    },
    [checkoutBranch, showConfirm]
  );

  const handleTagActivate = useCallback(
    (tagList: TagInfo[]) => async (index: number) => {
      const tag = tagList[index];
      if (!tag) return;
      if (tag.target_hash) {
        selectAndScrollToCommit(tag.target_hash);
      }
      const confirmed = await showConfirm({
        title: "Checkout Tag",
        message: `Checkout tag "${tag.name}"? This will put you in detached HEAD state.`,
        confirmLabel: "Checkout",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutCommit(tag.target_hash);
      }
    },
    [selectAndScrollToCommit, checkoutCommit, showConfirm]
  );

  const handleTagSecondaryActivate = useCallback(
    (tagList: TagInfo[]) => async (index: number) => {
      const tag = tagList[index];
      if (!tag) return;
      const confirmed = await showConfirm({
        title: "Checkout Tag",
        message: `Checkout tag "${tag.name}"? This will put you in detached HEAD state.`,
        confirmLabel: "Checkout",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        checkoutCommit(tag.target_hash);
      }
    },
    [checkoutCommit, showConfirm]
  );

  return (
    <div className="branch-tag-list flex flex-col">
      <FilterableSection
        title="Local Branches"
        items={allLocals}
        expanded={localExpanded}
        onToggle={() => setSectionExpanded(SECTION_KEY_LOCAL, !localExpanded)}
        getLabel={(b) => b.name}
        renderItem={(b) => <BranchItem branch={b} />}
        listAriaLabel="Local Branches"
        onActivate={handleBranchActivate}
        onSecondaryActivate={handleBranchSecondaryActivate}
        filterQuery={debouncedQuery}
      />

      <FilterableSection
        title="Remote Branches"
        items={allRemotes}
        expanded={remoteExpanded}
        onToggle={() => setSectionExpanded(SECTION_KEY_REMOTE, !remoteExpanded)}
        getLabel={(b) => b.name}
        renderItem={(b) => <BranchItem branch={b} />}
        listAriaLabel="Remote Branches"
        onActivate={handleBranchActivate}
        onSecondaryActivate={handleBranchSecondaryActivate}
        filterQuery={debouncedQuery}
      />

      <FilterableSection
        title="Tags"
        items={tags}
        expanded={tagsExpanded}
        onToggle={() => setSectionExpanded(SECTION_KEY_TAGS, !tagsExpanded)}
        getLabel={(t) => t.name}
        renderItem={(t) => <TagItem tag={t} />}
        listAriaLabel="Tags"
        onActivate={handleTagActivate}
        onSecondaryActivate={handleTagSecondaryActivate}
        filterQuery={debouncedQuery}
      />
    </div>
  );
}

interface FilterableSectionProps<T extends { name: string }> {
  title: string;
  items: T[];
  expanded: boolean;
  onToggle: () => void;
  getLabel: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  listAriaLabel: string;
  onActivate: (list: T[]) => (index: number) => void;
  onSecondaryActivate: (list: T[]) => (index: number) => void;
  filterQuery: string;
}

function FilterableSection<T extends { name: string }>({
  title,
  items,
  expanded,
  onToggle,
  getLabel,
  renderItem,
  listAriaLabel,
  onActivate,
  onSecondaryActivate,
  filterQuery,
}: FilterableSectionProps<T>) {
  const isFiltering = filterQuery.trim().length > 0;
  const filtered = useMemo(() => {
    if (!isFiltering) return items;
    const q = filterQuery.trim();
    return items.filter((it) => matchesQuery(getLabel(it), q));
  }, [items, filterQuery, isFiltering, getLabel]);

  const effectiveExpanded = isFiltering ? true : expanded;
  const count = isFiltering ? filtered.length : items.length;

  return (
    <div className="collapsible-section filterable-section border-border border-b">
      <div
        className="section-header-row flex items-center gap-2 px-3 py-1.5"
        role="group"
        aria-label={`${title} section`}
      >
        <button
          type="button"
          className="section-chevron text-text-muted hover:text-text-primary flex min-w-0 flex-1 shrink cursor-pointer items-center gap-1 bg-transparent"
          onClick={onToggle}
          aria-expanded={effectiveExpanded}
          aria-label={`Toggle ${title}`}
          disabled={isFiltering}
        >
          <span
            className={clsx(
              "expand-icon flex size-3 shrink-0 items-center justify-center transition-transform duration-150",
              effectiveExpanded && "expanded rotate-90"
            )}
          >
            <ChevronIcon />
          </span>
          <span className="section-title text-2xs truncate font-mono font-medium tracking-widest uppercase">
            {title}
          </span>
        </button>

        <span
          className={clsx(
            "section-count bg-bg-well text-2xs inline-flex w-8 shrink-0 items-center justify-center rounded-full px-1.5 py-px font-mono tabular-nums",
            isFiltering && count === 0 && "text-text-muted opacity-60"
          )}
          aria-label={`${count} ${isFiltering ? "matches" : "items"}`}
        >
          {count}
        </span>
      </div>

      {effectiveExpanded && (
        <div className="section-content pb-1">
          {filtered.length === 0 ? (
            <div className="text-text-muted text-2xs px-3 py-2 font-mono italic">
              {isFiltering ? "No matches" : `No ${title.toLowerCase()}`}
            </div>
          ) : (
            <FilteredList
              items={filtered}
              ariaLabel={listAriaLabel}
              onActivate={onActivate(filtered)}
              onSecondaryActivate={onSecondaryActivate(filtered)}
              renderItem={renderItem}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface FilteredListProps<T extends { name: string }> {
  items: T[];
  ariaLabel: string;
  onActivate: (index: number) => void;
  onSecondaryActivate: (index: number) => void;
  renderItem: (item: T) => React.ReactNode;
}

function FilteredList<T extends { name: string }>({
  items,
  ariaLabel,
  onActivate,
  onSecondaryActivate,
  renderItem,
}: FilteredListProps<T>) {
  // Re-mount KeyboardList when the set of items changes so its internal
  // activeIndex doesn't point past the end of a filtered list.
  const keyRef = useRef(0);
  const prevLen = useRef(items.length);
  if (prevLen.current !== items.length) {
    keyRef.current += 1;
    prevLen.current = items.length;
  }

  return (
    <KeyboardList
      key={keyRef.current}
      aria-label={ariaLabel}
      onActivate={onActivate}
      onSecondaryActivate={onSecondaryActivate}
    >
      {items.map((item, i) => (
        <KeyboardList.Item key={item.name} index={i}>
          {renderItem(item)}
        </KeyboardList.Item>
      ))}
    </KeyboardList>
  );
}

function ChevronIcon() {
  return <IconChevronRight size={10} stroke={2} aria-hidden />;
}

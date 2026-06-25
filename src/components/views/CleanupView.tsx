import { useEffect, useRef, type RefObject } from "react";
import clsx from "clsx";
import {
  IconRefresh,
  IconTrash,
  IconCheckbox,
  IconDeselect,
  IconChevronRight,
  IconCheck,
} from "@tabler/icons-react";
import type { BranchInfo, StashInfo, BulkResult } from "../../types";
import { useCleanupStore, STASH_DAYS_OLD, type CleanupCategory } from "../../stores/cleanupStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { SectionActionButton } from "../files/SectionHeader";
import { buildStashDropMessage, formatList } from "../../utils/dialogText";
import { useSelectionListNav } from "./useSelectionListNav";
import { useCleanupConfirm } from "../../hooks/useCleanupConfirm";

const SECTION_KEYS = {
  prune: "cleanup.prune",
  gone: "cleanup.gone",
  merged: "cleanup.merged",
  stashes: "cleanup.stashes",
  untracked: "cleanup.untracked",
} as const;

function useSectionExpanded(key: string): [boolean, () => void] {
  const expanded = useSettingsStore((s) => s.sectionExpanded[key] ?? false);
  const toggleSectionExpanded = useSettingsStore((s) => s.toggleSectionExpanded);
  return [expanded, () => toggleSectionExpanded(key)];
}

export function CleanupView() {
  const refreshAll = useCleanupStore((s) => s.refreshAll);
  const remotes = useRepositoryStore((s) => s.repositoryInfo?.remotes ?? []);
  // Subscribed slices that should trigger a re-fetch of cleanup candidates
  // when external operations (commits, stash drops, branch checkouts, etc.)
  // mutate them while this view is mounted.
  const externalStashes = useRepositoryStore((s) => s.stashes);
  const externalBranches = useRepositoryStore((s) => s.branches);
  const externalFileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const initialMountRef = useRef(true);

  useEffect(() => {
    refreshAll();
    initialMountRef.current = false;
  }, [refreshAll]);

  useEffect(() => {
    // Skip the very first render — the mount effect above already fetched.
    if (initialMountRef.current) return;
    refreshAll();
  }, [externalStashes, externalBranches, externalFileStatuses, refreshAll]);

  return (
    <div className="cleanup-view bg-bg-canvas flex flex-1 flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-text-primary text-sm font-semibold">Cleanup</h2>
        <SectionActionButton
          onClick={() => refreshAll()}
          title="Refresh cleanup candidates"
          ariaLabel="Refresh cleanup candidates"
        >
          <IconRefresh size={12} stroke={2} aria-hidden />
          <span>Refresh</span>
        </SectionActionButton>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <RemotePruneSection remotes={remotes} />
        <BranchSection
          category="gone"
          title="Branches with deleted remote"
          description="Local branches whose remote was deleted."
          emptyText="No local branches have a deleted remote."
        />
        <BranchSection
          category="merged"
          title="Merged branches"
          description="Branches whose commits are already on the current branch."
          emptyText="No merged branches outside the protected list."
        />
        <StashSection />
        <UntrackedSection />
      </div>
    </div>
  );
}

function RemotePruneSection({ remotes }: { remotes: string[] }) {
  const prune = useCleanupStore((s) => s.pruneRemote);
  const [expanded, toggle] = useSectionExpanded(SECTION_KEYS.prune);
  if (remotes.length === 0) {
    return null;
  }
  return (
    <section className="cleanup-section border-border bg-bg-panel rounded border">
      <SectionChevronHeader
        title="Prune remote refs"
        count={remotes.length}
        expanded={expanded}
        onToggle={toggle}
      />
      {expanded && (
        <>
          <p className="text-text-muted px-3 pt-2 pb-1 text-xs">
            Delete tracking refs for branches that no longer exist on the remote. Requires network.
          </p>
          <div className="space-y-1 px-3 pt-1 pb-2">
            {remotes.map((remote) => (
              <div key={remote} className="flex items-center justify-between">
                <span className="text-text-primary font-mono text-xs">{remote}</span>
                <SectionActionButton
                  onClick={() => prune(remote)}
                  title={`Prune stale refs from ${remote}`}
                  ariaLabel={`Prune stale refs from ${remote}`}
                >
                  <IconTrash size={12} stroke={2} aria-hidden />
                  <span>Prune</span>
                </SectionActionButton>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface BranchSectionProps {
  category: "gone" | "merged";
  title: string;
  description: string;
  emptyText: string;
}

function BranchSection({ category, title, description, emptyText }: BranchSectionProps) {
  const data = useCleanupStore((s) => s[category]);

  const handleRun = useCleanupConfirm(category, (n) => ({
    title: "Delete branches",
    message: `Delete ${n} branch${n === 1 ? "" : "es"}? This cannot be undone.\n\n${formatList(Array.from(data.selected))}`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  }));

  const allIds = data.candidates.map((b) => b.name);

  return (
    <CategorySection
      category={category}
      sectionKey={SECTION_KEYS[category]}
      title={title}
      description={description}
      allIds={allIds}
      selected={data.selected}
      total={data.candidates.length}
      loading={data.loading}
      onRun={handleRun}
      runLabel="Delete"
      emptyText={emptyText}
      lastResult={data.lastResult}
    >
      {(getRowProps) =>
        data.candidates.map((b: BranchInfo, i) => (
          <SelectableRow
            key={b.name}
            primary={b.name}
            secondary={b.last_commit_summary ?? undefined}
            index={i}
            {...getRowProps(b.name, i)}
          />
        ))
      }
    </CategorySection>
  );
}

function StashSection() {
  const data = useCleanupStore((s) => s.stashes);

  const handleRun = useCleanupConfirm("stashes", (n, sel) => {
    const selectedStashes = data.candidates.filter((s) => sel.has(String(s.index)));
    return {
      title: n === 1 ? "Drop stash" : "Drop stashes",
      message: buildStashDropMessage(selectedStashes),
      confirmLabel: "Drop",
      cancelLabel: "Cancel",
    };
  });

  const allIds = data.candidates.map((s) => String(s.index));

  return (
    <CategorySection
      category="stashes"
      sectionKey={SECTION_KEYS.stashes}
      title={`Stashes older than ${STASH_DAYS_OLD} days`}
      description={`Stashes older than ${STASH_DAYS_OLD} days. Drops are permanent.`}
      allIds={allIds}
      selected={data.selected}
      total={data.candidates.length}
      loading={data.loading}
      onRun={handleRun}
      runLabel="Drop"
      emptyText={`No stashes older than ${STASH_DAYS_OLD} days.`}
      lastResult={data.lastResult}
    >
      {(getRowProps) =>
        data.candidates.map((s: StashInfo, i) => {
          const id = String(s.index);
          return (
            <SelectableRow
              key={id}
              primary={`stash@{${s.index}}`}
              secondary={s.message}
              index={i}
              {...getRowProps(id, i)}
            />
          );
        })
      }
    </CategorySection>
  );
}

function UntrackedSection() {
  const data = useCleanupStore((s) => s.untracked);

  const handleRun = useCleanupConfirm("untracked", (n) => ({
    title: "Delete untracked files",
    message: `Permanently delete ${n} untracked file${n === 1 ? "" : "s"}? This cannot be undone.\n\n${formatList(Array.from(data.selected))}`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  }));

  const allIds = data.candidates;

  return (
    <CategorySection
      category="untracked"
      sectionKey={SECTION_KEYS.untracked}
      title="Untracked files"
      description="Working tree files not tracked by git and not in .gitignore."
      allIds={allIds}
      selected={data.selected}
      total={data.candidates.length}
      loading={data.loading}
      onRun={handleRun}
      runLabel="Delete"
      emptyText="No untracked files (excluding .gitignore'd)."
      lastResult={data.lastResult}
    >
      {(getRowProps) =>
        data.candidates.map((path, i) => (
          <SelectableRow key={path} primary={path} index={i} {...getRowProps(path, i)} />
        ))
      }
    </CategorySection>
  );
}

interface RowProps {
  selected: boolean;
  isActive: boolean;
  rowId: string;
  onClick: (e: React.MouseEvent) => void;
}

interface CategorySectionProps {
  category: CleanupCategory;
  sectionKey: string;
  title: string;
  description: string;
  allIds: string[];
  selected: Set<string>;
  total: number;
  loading: boolean;
  onRun: () => void;
  runLabel: string;
  emptyText: string;
  lastResult: BulkResult[] | null;
  children: (getRowProps: (id: string, index: number) => RowProps) => React.ReactNode;
}

interface CategorySectionActionsProps {
  expanded: boolean;
  total: number;
  allSelected: boolean;
  category: CleanupCategory;
  selectAllCategory: (c: CleanupCategory) => void;
  selectNoneCategory: (c: CleanupCategory) => void;
  onRun: () => void;
  runLabel: string;
  selectedCount: number;
  loading: boolean;
}

function CategorySectionActions({
  expanded,
  total,
  allSelected,
  category,
  selectAllCategory,
  selectNoneCategory,
  onRun,
  runLabel,
  selectedCount,
  loading,
}: CategorySectionActionsProps) {
  if (!expanded || total === 0) return null;
  return (
    <>
      <SectionActionButton
        onClick={
          allSelected ? () => selectNoneCategory(category) : () => selectAllCategory(category)
        }
        title={allSelected ? "Deselect all" : "Select all"}
        ariaLabel={allSelected ? "Deselect all" : "Select all"}
      >
        {allSelected ? (
          <IconDeselect size={12} stroke={2} aria-hidden />
        ) : (
          <IconCheckbox size={12} stroke={2} aria-hidden />
        )}
        <span>{allSelected ? "Deselect" : "All"}</span>
      </SectionActionButton>
      <SectionActionButton
        onClick={onRun}
        title={`${runLabel} ${selectedCount} selected`}
        ariaLabel={`${runLabel} ${selectedCount} selected`}
        disabled={selectedCount === 0 || loading}
      >
        <IconTrash size={12} stroke={2} aria-hidden />
        <span>
          {runLabel} {selectedCount}
        </span>
      </SectionActionButton>
    </>
  );
}

interface CategorySectionContentProps {
  description: string;
  loading: boolean;
  total: number;
  emptyText: string;
  listRef: RefObject<HTMLUListElement | null>;
  listboxId: string;
  allIds: string[];
  activeIndex: number;
  rowIdFor: (index: number) => string;
  handleKeyDown: (e: React.KeyboardEvent<HTMLUListElement>) => void;
  children: (getRowProps: (id: string, index: number) => RowProps) => React.ReactNode;
  getRowProps: (id: string, index: number) => RowProps;
  lastResult: BulkResult[] | null;
}

function CategorySectionContent({
  description,
  loading,
  total,
  emptyText,
  listRef,
  listboxId,
  allIds,
  activeIndex,
  rowIdFor,
  handleKeyDown,
  children,
  getRowProps,
  lastResult,
}: CategorySectionContentProps) {
  return (
    <>
      <p className="text-text-muted px-3 pt-2 pb-1 text-xs">{description}</p>
      <div className="pt-1 pb-2">
        {loading && total === 0 ? (
          <p className="text-text-muted px-3 text-xs">Loading…</p>
        ) : total === 0 ? (
          <p className="text-text-muted px-3 text-xs italic">{emptyText}</p>
        ) : (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-activedescendant={
              allIds.length > 0 ? rowIdFor(Math.min(activeIndex, allIds.length - 1)) : undefined
            }
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="focus-ring flex flex-col outline-none"
          >
            {children(getRowProps)}
          </ul>
        )}
        {lastResult && lastResult.length > 0 && (
          <div className="px-3">
            <ResultSummary results={lastResult} />
          </div>
        )}
      </div>
    </>
  );
}

function CategorySection(props: CategorySectionProps) {
  const {
    category,
    sectionKey,
    title,
    description,
    allIds,
    selected,
    total,
    loading,
    onRun,
    runLabel,
    emptyText,
    lastResult,
    children,
  } = props;

  const [expanded, toggleExpanded] = useSectionExpanded(sectionKey);
  const selectAllCategory = useCleanupStore((s) => s.selectAll);
  const selectNoneCategory = useCleanupStore((s) => s.selectNone);
  const selectedCount = selected.size;
  const allSelected = total > 0 && selectedCount === total;

  const { activeIndex, listboxId, listRef, rowIdFor, handleRowClick, handleKeyDown } =
    useSelectionListNav({ category, allIds, selected, onRun });

  const getRowProps = (id: string, index: number): RowProps => ({
    selected: selected.has(id),
    isActive: index === activeIndex,
    rowId: rowIdFor(index),
    onClick: (e) => handleRowClick(id, index, e),
  });

  return (
    <section className="cleanup-section border-border bg-bg-panel rounded border">
      <SectionChevronHeader
        title={title}
        count={total}
        expanded={expanded}
        onToggle={toggleExpanded}
        selectedCount={selectedCount}
        actions={
          <CategorySectionActions
            expanded={expanded}
            total={total}
            allSelected={allSelected}
            category={category}
            selectAllCategory={selectAllCategory}
            selectNoneCategory={selectNoneCategory}
            onRun={onRun}
            runLabel={runLabel}
            selectedCount={selectedCount}
            loading={loading}
          />
        }
      />
      {expanded && (
        <CategorySectionContent
          description={description}
          loading={loading}
          total={total}
          emptyText={emptyText}
          listRef={listRef}
          listboxId={listboxId}
          allIds={allIds}
          activeIndex={activeIndex}
          rowIdFor={rowIdFor}
          handleKeyDown={handleKeyDown}
          children={children}
          getRowProps={getRowProps}
          lastResult={lastResult}
        />
      )}
    </section>
  );
}

interface SectionChevronHeaderProps {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  selectedCount?: number;
  actions?: React.ReactNode;
}

function SectionChevronHeader({
  title,
  count,
  expanded,
  onToggle,
  selectedCount,
  actions,
}: SectionChevronHeaderProps) {
  return (
    <header className="border-border bg-bg-well flex items-center gap-2 border-b px-2 py-1.5 text-xs">
      <button
        type="button"
        onClick={onToggle}
        className="text-text-primary hover:text-text-primary flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent text-left"
        aria-expanded={expanded}
        aria-label={`Toggle ${title}`}
      >
        <span
          className={clsx(
            "flex size-3 shrink-0 items-center justify-center transition-transform duration-150",
            expanded && "rotate-90"
          )}
        >
          <IconChevronRight size={10} stroke={2} aria-hidden />
        </span>
        <span className="font-medium">{title}</span>
        {!expanded && selectedCount !== undefined && selectedCount > 0 && (
          <span className="text-accent-magenta">({selectedCount} selected)</span>
        )}
      </button>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      <span className="section-count bg-bg-canvas text-2xs inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-px font-mono tabular-nums">
        {count}
      </span>
    </header>
  );
}

interface SelectableRowProps extends RowProps {
  primary: string;
  secondary?: string;
  index: number;
}

function SelectableRow({
  primary,
  secondary,
  selected,
  isActive,
  rowId,
  onClick,
}: SelectableRowProps) {
  return (
    <li
      id={rowId}
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={clsx(
        "min-h-row hover:bg-bg-hover flex cursor-pointer items-center gap-2 px-3 py-1 text-xs transition-colors duration-100 select-none",
        selected && "bg-bg-selected/40 hover:bg-bg-selected-hover/50",
        isActive && "ring-accent-magenta/50 ring-1 ring-inset"
      )}
    >
      <SelectionCheckbox checked={selected} />
      <span className="text-text-primary truncate font-mono">{primary}</span>
      {secondary && <span className="text-text-muted truncate text-xs italic">{secondary}</span>}
    </li>
  );
}

/**
 * Visual checkbox indicator for selection state. Not focusable on its own —
 * the parent `<li role=option>` carries focus and click. Click events bubble
 * up to the row, so clicking either the checkbox or the row toggles selection.
 *
 * Native `<input type=checkbox>` renders inconsistently across Linux / macOS /
 * Windows; rendering our own box + icon keeps pixel-perfect parity.
 */
function SelectionCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
        checked
          ? "bg-accent-magenta border-accent-magenta text-white"
          : "bg-bg-well border-border-light"
      )}
    >
      {checked && <IconCheck size={12} stroke={3} aria-hidden />}
    </span>
  );
}

function ResultSummary({ results }: { results: BulkResult[] }) {
  const failures = results.filter((r) => !r.success);
  return (
    <div className="border-border mt-2 border-t pt-2 text-xs">
      <p className="text-text-muted">
        Last run: {results.length - failures.length} succeeded, {failures.length} failed.
      </p>
      {failures.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {failures.map((f) => (
            <li key={f.item} className="text-red-500">
              <span className="font-mono">{f.item}</span>: {f.error ?? "Unknown error"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

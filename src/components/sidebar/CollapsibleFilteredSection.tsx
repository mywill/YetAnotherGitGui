import { useMemo, type ReactNode } from "react";
import clsx from "clsx";
import { IconChevronRight } from "@tabler/icons-react";
import { matchesQuery } from "../../hooks/useCommandPaletteSearch";
import { KeyboardList } from "../common/KeyboardList";

interface CollapsibleFilteredSectionProps<T extends { name: string }> {
  title: string;
  items: T[];
  expanded: boolean;
  onToggle: () => void;
  filterQuery: string;
  listAriaLabel: string;
  /** Primary activation (Enter) — typically navigates AND acts. */
  onActivate: (item: T) => void;
  /** Secondary activation (Space) — typically just acts without navigating. */
  onSecondaryActivate: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  emptyLabel: string;
}

export function CollapsibleFilteredSection<T extends { name: string }>({
  title,
  items,
  expanded,
  onToggle,
  filterQuery,
  listAriaLabel,
  onActivate,
  onSecondaryActivate,
  renderItem,
  emptyLabel,
}: CollapsibleFilteredSectionProps<T>) {
  const isFiltering = filterQuery.trim().length > 0;
  const filtered = useMemo(() => {
    if (!isFiltering) return items;
    const q = filterQuery.trim();
    return items.filter((it) => matchesQuery(it.name, q));
  }, [items, filterQuery, isFiltering]);

  const effectiveExpanded = isFiltering ? true : expanded;
  const count = isFiltering ? filtered.length : items.length;

  return (
    <div className="collapsible-section filterable-section border-border overflow-hidden rounded border">
      <div
        className="section-header-row bg-bg-well border-border flex items-center gap-2 border-b px-2 py-1.5 text-xs"
        role="group"
        aria-label={`${title} section`}
      >
        <button
          type="button"
          className="section-chevron text-text-primary hover:text-text-primary flex min-w-0 flex-1 shrink cursor-pointer items-center gap-2 bg-transparent text-left"
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
            <IconChevronRight size={10} stroke={2} aria-hidden />
          </span>
          <span className="section-title truncate font-medium">{title}</span>
        </button>

        <span
          className={clsx(
            "section-count bg-bg-canvas text-2xs inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-px font-mono tabular-nums",
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
              {isFiltering ? "No matches" : emptyLabel}
            </div>
          ) : (
            // Re-key the KeyboardList by the filter signature so its internal
            // activeIndex resets to 0 instead of pointing past a shorter list.
            <KeyboardList
              key={`${filtered.length}-${filterQuery}`}
              aria-label={listAriaLabel}
              onActivate={(i) => {
                const it = filtered[i];
                if (it) onActivate(it);
              }}
              onSecondaryActivate={(i) => {
                const it = filtered[i];
                if (it) onSecondaryActivate(it);
              }}
            >
              {filtered.map((item, i) => (
                <KeyboardList.Item key={item.name} index={i}>
                  {renderItem(item)}
                </KeyboardList.Item>
              ))}
            </KeyboardList>
          )}
        </div>
      )}
    </div>
  );
}

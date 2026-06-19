import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { List, type ListImperativeAPI, type RowComponentProps } from "react-window";
import type { GraphCommit } from "../../types";
import { CommitRow } from "./CommitRow";
import { ColumnResizer } from "./ColumnResizer";
import { KeyboardListVirtualized } from "../common/KeyboardListVirtualized";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";

const MIN_WIDTH = 60;

interface CommitRowRendererProps {
  commits: GraphCommit[];
  selectedCommitHash: string | null;
  headHash: string | null;
  rowHeight: number;
  handleSelect: (hash: string) => void;
  handleDoubleClick: (hash: string) => void;
}

function CommitRowRenderer({
  index,
  style,
  commits,
  selectedCommitHash,
  headHash,
  rowHeight,
  handleSelect,
  handleDoubleClick,
}: RowComponentProps<CommitRowRendererProps>) {
  const commit = commits[index];
  return (
    <CommitRow
      index={index}
      style={style}
      commit={commit}
      isSelected={commit.hash === selectedCommitHash}
      isHead={commit.hash === headHash}
      rowHeight={rowHeight}
      onSelect={() => handleSelect(commit.hash)}
      onDoubleClick={() => handleDoubleClick(commit.hash)}
    />
  );
}

interface CommitGraphProps {
  commits: GraphCommit[];
}

export function CommitGraph({ commits }: CommitGraphProps) {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedCommitHash = useSelectionStore((s) => s.selectedCommitHash);
  const selectCommit = useSelectionStore((s) => s.selectCommit);
  const scrollToCommit = useSelectionStore((s) => s.scrollToCommit);
  const clearScrollToCommit = useSelectionStore((s) => s.clearScrollToCommit);
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const loadCommitDetails = useRepositoryStore((s) => s.loadCommitDetails);
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const layoutSizes = useSettingsStore((s) => s.layoutSizes);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);
  const density = useSettingsStore((s) => s.density);
  const textSize = useSettingsStore((s) => s.textSize);
  const graphWidth = layoutSizes["graph.col.graph"] ?? 120;
  const authorWidth = layoutSizes["graph.col.author"] ?? 150;
  const dateWidth = layoutSizes["graph.col.date"] ?? 120;

  const minGraphWidth = useMemo(() => {
    const maxColumn = commits.reduce((max, c) => Math.max(max, c.column), 0);
    return Math.max(MIN_WIDTH, 12 + maxColumn * 12 + 12);
  }, [commits]);
  const effectiveGraphWidth = Math.max(graphWidth, minGraphWidth);

  const [containerWidth, setContainerWidth] = useState(0);

  // Row height follows density × text-size. Read the computed --spacing-row
  // value from the root so changing density/textSize reflows the list.
  // density and textSize aren't read inside this body — they're declared as
  // dependencies so that switching density/text-size re-runs the DOM read.
  const rowHeight = useMemo(() => {
    if (typeof window === "undefined") return 28;
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--spacing-row").trim();
    const px = parseFloat(raw);
    return Number.isFinite(px) && px > 0 ? px : 28;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, textSize]);

  // Track container width with ResizeObserver (for column resizer positions)
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Scroll to commit when requested. Tolerates:
  //   a) listRef not yet attached (react-window mounts after view switch)
  //   b) commits array still loading after view switch
  //
  // We only clear scrollToCommit on a successful scroll. If the target hash
  // is not in the current commits, the effect stays armed — when commits
  // reload (prop change), the effect re-runs and will find the target.
  useEffect(() => {
    if (!scrollToCommit) return;
    if (commits.length === 0) return; // still loading

    let cancelled = false;
    let frame = 0;
    const maxFrames = 60;

    const attempt = () => {
      if (cancelled) return;
      const index = commits.findIndex((c) => c.hash === scrollToCommit);
      if (index < 0) {
        // Not in current history view — leave scrollToCommit set so a future
        // commits update can still honor the request. Do not clear here.
        return;
      }
      const list = listRef.current;
      // react-window v2 assigns listRef.current before the DOM element attaches;
      // `list.element` staying null means scrollToRow is a no-op. Keep retrying
      // until the element is actually mounted.
      if (!list || !list.element) {
        if (frame++ < maxFrames) {
          requestAnimationFrame(attempt);
        }
        return;
      }
      // Manually center: place the target row in the middle of the scroll viewport
      // so there's always generous space above it (well clear of any header chrome).
      const el = list.element;
      const viewportH = el.clientHeight;
      const desired = Math.max(0, index * rowHeight - (viewportH - rowHeight) / 2);
      el.scrollTop = desired;
      loadCommitDetails(scrollToCommit);
      clearScrollToCommit();
    };

    attempt();
    return () => {
      cancelled = true;
    };
  }, [scrollToCommit, commits, rowHeight, clearScrollToCommit, loadCommitDetails]);

  const handleSelect = useCallback(
    (hash: string) => {
      selectCommit(hash);
      loadCommitDetails(hash);
    },
    [selectCommit, loadCommitDetails]
  );

  const handleDoubleClick = useCallback(
    async (hash: string) => {
      const confirmed = await showConfirm({
        title: "Checkout Commit",
        message: "This will checkout this commit and put you in detached HEAD state. Continue?",
        confirmLabel: "Checkout",
        cancelLabel: "Cancel",
      });
      if (confirmed) {
        await checkoutCommit(hash);
      }
    },
    [checkoutCommit, showConfirm]
  );

  const handleGraphResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["graph.col.graph"] ?? 120;
      setLayoutSize("graph.col.graph", Math.max(minGraphWidth, current + delta));
    },
    [setLayoutSize, minGraphWidth]
  );

  const handleMessageResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["graph.col.author"] ?? 150;
      setLayoutSize("graph.col.author", Math.max(MIN_WIDTH, current - delta));
    },
    [setLayoutSize]
  );

  const handleAuthorResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["graph.col.date"] ?? 120;
      setLayoutSize("graph.col.date", Math.max(MIN_WIDTH, current - delta));
    },
    [setLayoutSize]
  );

  // Calculate resizer positions (accounting for 24px column gaps)
  const padding = 8;
  const columnGap = 24;
  const halfGap = columnGap / 2;
  const graphResizerPos = padding + effectiveGraphWidth + halfGap;
  const authorResizerPos = containerWidth - padding - dateWidth - columnGap - authorWidth - halfGap;
  const dateResizerPos = containerWidth - padding - dateWidth - halfGap;

  // Get current HEAD hash for highlighting
  const headHash = repositoryInfo?.head_hash;

  // CSS custom properties for grid layout
  const containerStyle = {
    "--graph-width": `${effectiveGraphWidth}px`,
    "--author-width": `${authorWidth}px`,
    "--date-width": `${dateWidth}px`,
  } as React.CSSProperties;

  return (
    <div
      className="commit-graph relative flex h-full flex-col overflow-hidden pr-0.5"
      ref={containerRef}
      style={containerStyle}
    >
      <div
        className="commit-graph-header commit-graph-grid border-border bg-bg-well text-text-muted shrink-0 items-center border-b px-2 text-xs"
        style={{ display: "grid", height: "28px", columnGap: "24px", scrollbarGutter: "stable" }}
      >
        <div className="header-cell truncate">Graph</div>
        <div className="header-cell truncate">Message</div>
        <div className="header-cell truncate">Author</div>
        <div className="header-cell truncate text-right">Date</div>
      </div>

      {/* Resize handles */}
      <div className="column-resizers pointer-events-none absolute inset-x-0 top-0 h-7">
        <ColumnResizer
          position={graphResizerPos}
          onResize={handleGraphResize}
          ariaLabel="Resize graph column"
        />
        <ColumnResizer
          position={authorResizerPos}
          onResize={handleMessageResize}
          ariaLabel="Resize message column"
        />
        <ColumnResizer
          position={dateResizerPos}
          onResize={handleAuthorResize}
          ariaLabel="Resize author column"
        />
      </div>

      <KeyboardListVirtualized
        aria-label="Commit history"
        itemCount={commits.length}
        listRef={listRef}
        onFocusChange={(i) => handleSelect(commits[i].hash)}
        onActivate={(i) => handleDoubleClick(commits[i].hash)}
        onSecondaryActivate={(i) => handleDoubleClick(commits[i].hash)}
        className="flex-1"
      >
        <List
          listRef={listRef}
          rowCount={commits.length}
          rowHeight={rowHeight}
          rowComponent={CommitRowRenderer}
          rowProps={{
            commits,
            selectedCommitHash,
            headHash: headHash ?? null,
            rowHeight,
            handleSelect,
            handleDoubleClick,
          }}
          style={{ flex: 1, scrollbarGutter: "stable" }}
        />
      </KeyboardListVirtualized>
    </div>
  );
}

import { useCallback, useRef, useState, useEffect } from "react";
import { FixedSizeList as List } from "react-window";
import type { GraphCommit } from "../../types";
import { CommitRow } from "./CommitRow";
import { ColumnResizer } from "./ColumnResizer";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";

const ROW_HEIGHT = 28;
const MIN_WIDTH = 60;

interface CommitGraphProps {
  commits: GraphCommit[];
  onLoadMore: () => void;
  hasMore: boolean;
}

export function CommitGraph({ commits, onLoadMore, hasMore }: CommitGraphProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedCommitHash = useSelectionStore((s) => s.selectedCommitHash);
  const selectCommit = useSelectionStore((s) => s.selectCommit);
  const scrollToCommit = useSelectionStore((s) => s.scrollToCommit);
  const clearScrollToCommit = useSelectionStore((s) => s.clearScrollToCommit);
  const checkoutCommit = useRepositoryStore((s) => s.checkoutCommit);
  const loadCommitDetails = useRepositoryStore((s) => s.loadCommitDetails);
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  // Column widths state
  const [graphWidth, setGraphWidth] = useState(120);
  const [authorWidth, setAuthorWidth] = useState(150);
  const [dateWidth, setDateWidth] = useState(120);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track container width with ResizeObserver
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

  // Scroll to commit when requested
  useEffect(() => {
    if (scrollToCommit && listRef.current) {
      const index = commits.findIndex((c) => c.hash === scrollToCommit);
      if (index >= 0) {
        listRef.current.scrollToItem(index, "center");
        loadCommitDetails(scrollToCommit);
      }
      clearScrollToCommit();
    }
  }, [scrollToCommit, commits, clearScrollToCommit, loadCommitDetails]);

  const handleScroll = useCallback(
    ({
      scrollOffset,
      scrollUpdateWasRequested,
    }: {
      scrollOffset: number;
      scrollUpdateWasRequested: boolean;
    }) => {
      if (scrollUpdateWasRequested) return;

      const listHeight = Number(listRef.current?.props.height) || 0;
      const totalHeight = commits.length * ROW_HEIGHT;

      if (scrollOffset + listHeight >= totalHeight - ROW_HEIGHT * 10 && hasMore) {
        onLoadMore();
      }
    },
    [commits.length, hasMore, onLoadMore]
  );

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

  // Resize handlers
  const handleGraphResize = useCallback((delta: number) => {
    setGraphWidth((prev) => Math.max(MIN_WIDTH, prev + delta));
  }, []);

  const handleMessageResize = useCallback((delta: number) => {
    setAuthorWidth((prev) => Math.max(MIN_WIDTH, prev - delta));
  }, []);

  const handleAuthorResize = useCallback((delta: number) => {
    setDateWidth((prev) => Math.max(MIN_WIDTH, prev - delta));
  }, []);

  // Calculate resizer positions (accounting for 24px column gaps)
  const padding = 8;
  const columnGap = 24;
  const halfGap = columnGap / 2;
  const graphResizerPos = padding + graphWidth + halfGap;
  const authorResizerPos = containerWidth - padding - dateWidth - columnGap - authorWidth - halfGap;
  const dateResizerPos = containerWidth - padding - dateWidth - halfGap;

  // Get current HEAD hash for highlighting
  const headHash = repositoryInfo?.head_hash;

  // CSS custom properties for grid layout
  const containerStyle = {
    "--graph-width": `${graphWidth}px`,
    "--author-width": `${authorWidth}px`,
    "--date-width": `${dateWidth}px`,
  } as React.CSSProperties;

  return (
    <div
      className="commit-graph relative flex h-full flex-col overflow-hidden"
      ref={containerRef}
      style={containerStyle}
    >
      <div
        className="commit-graph-header commit-graph-grid border-border bg-bg-tertiary text-text-secondary shrink-0 items-center border-b px-2 text-xs"
        style={{ display: "grid", height: "28px", columnGap: "24px" }}
      >
        <div className="header-cell truncate">Graph</div>
        <div className="header-cell truncate">Message</div>
        <div className="header-cell truncate">Author</div>
        <div className="header-cell truncate text-right">Date</div>
      </div>

      {/* Resize handles */}
      <div className="column-resizers pointer-events-none absolute inset-x-0 top-0 h-7">
        <ColumnResizer position={graphResizerPos} onResize={handleGraphResize} />
        <ColumnResizer position={authorResizerPos} onResize={handleMessageResize} />
        <ColumnResizer position={dateResizerPos} onResize={handleAuthorResize} />
      </div>

      <List
        ref={listRef}
        height={600}
        width="100%"
        itemCount={commits.length}
        itemSize={ROW_HEIGHT}
        onScroll={handleScroll}
        style={{ height: "calc(100% - 28px)" }}
      >
        {({ index, style }) => (
          <CommitRow
            style={style}
            commit={commits[index]}
            isSelected={commits[index].hash === selectedCommitHash}
            isHead={commits[index].hash === headHash}
            onSelect={() => handleSelect(commits[index].hash)}
            onDoubleClick={() => handleDoubleClick(commits[index].hash)}
          />
        )}
      </List>
    </div>
  );
}

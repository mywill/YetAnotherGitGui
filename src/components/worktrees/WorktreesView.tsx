import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useWorktreeStore } from "../../stores/worktreeStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { YaggButton } from "../common/YaggButton";
import { WorktreeRow } from "./WorktreeRow";
import { AddWorktreeDialog } from "./AddWorktreeDialog";
import { ColumnResizer } from "../graph/ColumnResizer";

const MIN_WIDTH = 50;
const PADDING = 8;
const COLUMN_GAP = 16;
const HALF_GAP = COLUMN_GAP / 2;

export function WorktreesView() {
  const worktrees = useWorktreeStore((s) => s.worktrees);
  const loading = useWorktreeStore((s) => s.loading);
  const refresh = useWorktreeStore((s) => s.refresh);
  const openAddDialog = useWorktreeStore((s) => s.openAddDialog);
  const pruneWorktrees = useWorktreeStore((s) => s.pruneWorktrees);
  const addDialogOpen = useWorktreeStore((s) => s.addDialogOpen);
  const repositoryInfo = useRepositoryStore((s) => s.repositoryInfo);
  const initialMountRef = useRef(true);

  const layoutSizes = useSettingsStore((s) => s.layoutSizes);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  const nameWidth = layoutSizes["worktree.col.name"] ?? 160;
  const branchWidth = layoutSizes["worktree.col.branch"] ?? 120;
  const dirtyWidth = layoutSizes["worktree.col.dirty"] ?? 50;
  const stateWidth = layoutSizes["worktree.col.state"] ?? 90;
  const actionsWidth = layoutSizes["worktree.col.actions"] ?? 80;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    refresh();
    initialMountRef.current = false;
  }, [refresh]);

  useEffect(() => {
    if (initialMountRef.current) return;
    refresh();
  }, [repositoryInfo, refresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resizer positions (left-to-right, accumulated).
  const nameResizerPos = PADDING + nameWidth + HALF_GAP;
  const branchResizerPos = nameResizerPos + COLUMN_GAP + branchWidth + HALF_GAP;
  const dirtyResizerPos =
    containerWidth -
    PADDING -
    actionsWidth -
    COLUMN_GAP -
    stateWidth -
    COLUMN_GAP -
    dirtyWidth -
    HALF_GAP;
  const stateResizerPos =
    containerWidth - PADDING - actionsWidth - COLUMN_GAP - stateWidth - HALF_GAP;
  const actionsResizerPos = containerWidth - PADDING - actionsWidth - HALF_GAP;

  const handleNameResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["worktree.col.name"] ?? 160;
      setLayoutSize("worktree.col.name", Math.max(MIN_WIDTH, current + delta));
    },
    [setLayoutSize]
  );
  const handleBranchResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["worktree.col.branch"] ?? 120;
      setLayoutSize("worktree.col.branch", Math.max(MIN_WIDTH, current - delta));
    },
    [setLayoutSize]
  );
  const handleDirtyResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["worktree.col.dirty"] ?? 50;
      setLayoutSize("worktree.col.dirty", Math.max(MIN_WIDTH, current - delta));
    },
    [setLayoutSize]
  );
  const handleStateResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["worktree.col.state"] ?? 90;
      setLayoutSize("worktree.col.state", Math.max(MIN_WIDTH, current - delta));
    },
    [setLayoutSize]
  );
  const handleActionsResize = useCallback(
    (delta: number) => {
      const current = useSettingsStore.getState().layoutSizes["worktree.col.actions"] ?? 80;
      setLayoutSize("worktree.col.actions", Math.max(MIN_WIDTH, current - delta));
    },
    [setLayoutSize]
  );

  const containerStyle = useMemo(
    () =>
      ({
        "--wt-name-width": `${nameWidth}px`,
        "--wt-branch-width": `${branchWidth}px`,
        "--wt-dirty-width": `${dirtyWidth}px`,
        "--wt-state-width": `${stateWidth}px`,
        "--wt-actions-width": `${actionsWidth}px`,
      }) as React.CSSProperties,
    [nameWidth, branchWidth, dirtyWidth, stateWidth, actionsWidth]
  );

  const prunableCount = worktrees.filter((w) => w.is_prunable && !w.is_main).length;

  return (
    <div className="worktrees-view bg-bg-canvas relative flex flex-1 flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-text-primary text-sm font-semibold">Worktrees</h2>
        <div className="flex items-center gap-1">
          <YaggButton
            variant="icon"
            onClick={() => pruneWorktrees()}
            disabled={prunableCount === 0}
            title={
              prunableCount > 0
                ? `Prune ${prunableCount} worktree${prunableCount === 1 ? "" : "s"}`
                : "No prunable worktrees"
            }
            aria-label="Prune worktrees"
          >
            <IconTrash size={14} stroke={1.75} aria-hidden />
          </YaggButton>
          <YaggButton
            variant="icon"
            onClick={() => openAddDialog()}
            title="Add a worktree"
            aria-label="Add worktree"
          >
            <IconPlus size={14} stroke={1.75} aria-hidden />
          </YaggButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex flex-1 flex-col overflow-hidden"
        style={containerStyle}
      >
        {/* Header row — sticky, shares the worktree-grid class with rows */}
        <div
          className="worktree-grid border-border bg-bg-well text-text-muted text-2xs sticky top-0 z-10 grid shrink-0 items-center border-b px-2 font-medium tracking-wide uppercase"
          style={{ columnGap: `${COLUMN_GAP}px`, height: "28px", scrollbarGutter: "stable" }}
        >
          <div className="truncate">Name</div>
          <div className="truncate">Branch</div>
          <div className="truncate">Path</div>
          <div className="truncate text-right">Dirty</div>
          <div className="truncate">State</div>
          <div className="truncate text-center">Actions</div>
        </div>

        {/* Column resizers */}
        <div className="column-resizers pointer-events-none absolute inset-x-0 top-0 h-7">
          <ColumnResizer
            position={nameResizerPos}
            onResize={handleNameResize}
            ariaLabel="Resize name column"
            valueNow={nameWidth}
            valueMin={MIN_WIDTH}
          />
          <ColumnResizer
            position={branchResizerPos}
            onResize={handleBranchResize}
            ariaLabel="Resize branch column"
            valueNow={branchWidth}
            valueMin={MIN_WIDTH}
          />
          <ColumnResizer
            position={dirtyResizerPos}
            onResize={handleDirtyResize}
            ariaLabel="Resize dirty column"
            valueNow={dirtyWidth}
            valueMin={MIN_WIDTH}
          />
          <ColumnResizer
            position={stateResizerPos}
            onResize={handleStateResize}
            ariaLabel="Resize state column"
            valueNow={stateWidth}
            valueMin={MIN_WIDTH}
          />
          <ColumnResizer
            position={actionsResizerPos}
            onResize={handleActionsResize}
            ariaLabel="Resize actions column"
            valueNow={actionsWidth}
            valueMin={MIN_WIDTH}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          {loading && worktrees.length === 0 ? (
            <p className="text-text-muted px-3 py-3 text-xs">Loading…</p>
          ) : worktrees.length === 0 ? (
            <p className="text-text-muted px-3 py-3 text-xs italic">No worktrees.</p>
          ) : (
            worktrees.map((wt) => <WorktreeRow key={wt.name + wt.path} worktree={wt} />)
          )}
        </div>
      </div>

      {addDialogOpen && <AddWorktreeDialog />}
    </div>
  );
}

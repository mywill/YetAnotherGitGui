import { useCallback, useRef } from "react";
import { StagedPanel } from "../files/StagedPanel";
import { UnstagedPanel } from "../files/UnstagedPanel";
import { UntrackedPanel } from "../files/UntrackedPanel";
import { CommitPanel } from "../commit/CommitPanel";
import { DiffViewPanel } from "../diff/DiffViewPanel";
import { YaggResizer } from "../common/YaggResizer";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import {
  STATUS_LEFT_DEFAULT,
  STATUS_LEFT_MIN,
  STATUS_LEFT_MAX,
  STATUS_PANE_MIN,
  STATUS_PANE_MAX,
  LAYOUT_KEYS,
} from "../shell/layoutConstants";

const STAGED_KEY = LAYOUT_KEYS.statusStaged;
const UNTRACKED_KEY = LAYOUT_KEYS.statusUntracked;

export function StatusView() {
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const fileStatusesLoading = useRepositoryStore((s) => s.fileStatusesLoading);
  const currentDiff = useRepositoryStore((s) => s.currentDiff);
  const currentDiffStaged = useRepositoryStore((s) => s.currentDiffStaged);
  const diffLoading = useRepositoryStore((s) => s.diffLoading);

  const leftWidth = useSettingsStore(
    (s) => s.layoutSizes[LAYOUT_KEYS.statusLeft] ?? STATUS_LEFT_DEFAULT
  );
  const stagedSize = useSettingsStore((s) => s.layoutSizes[STAGED_KEY]);
  const untrackedSize = useSettingsStore((s) => s.layoutSizes[UNTRACKED_KEY]);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  // Measure rendered pixel sizes so the resizer drag baseline is correct
  // before either pane has a stored size, and so we can pin the opposite
  // pane when the user first drags.
  const stagedRef = useRef<HTMLDivElement>(null);
  const untrackedRef = useRef<HTMLDivElement>(null);
  const stagedMeasured = useResizeObserver(stagedRef);
  const untrackedMeasured = useResizeObserver(untrackedRef);

  const handleLeftResize = useCallback(
    (next: number) => {
      setLayoutSize(LAYOUT_KEYS.statusLeft, next);
    },
    [setLayoutSize]
  );

  const handleStagedResize = useCallback(
    (next: number) => {
      setLayoutSize(STAGED_KEY, next);
      // Pin untracked at its current rendered height on the first drag so
      // the unstaged middle pane is the only one that absorbs the change.
      if (untrackedSize === undefined && untrackedMeasured.height > 0) {
        setLayoutSize(UNTRACKED_KEY, untrackedMeasured.height);
      }
    },
    [setLayoutSize, untrackedSize, untrackedMeasured.height]
  );

  const handleUntrackedResize = useCallback(
    (next: number) => {
      setLayoutSize(UNTRACKED_KEY, next);
      if (stagedSize === undefined && stagedMeasured.height > 0) {
        setLayoutSize(STAGED_KEY, stagedMeasured.height);
      }
    },
    [setLayoutSize, stagedSize, stagedMeasured.height]
  );

  return (
    <div className="status-view flex min-h-0 flex-1 overflow-hidden">
      <div
        id="status-left-panel"
        className="status-left bg-bg-panel flex flex-col overflow-hidden"
        style={{ width: leftWidth }}
      >
        <div
          ref={stagedRef}
          id="status-staged-pane"
          className="status-staged flex min-h-0 flex-col overflow-hidden"
          style={
            stagedSize !== undefined
              ? { height: stagedSize, flexShrink: 0 }
              : { flexGrow: 3, flexShrink: 1, flexBasis: 0 }
          }
        >
          <StagedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
        <YaggResizer
          orientation="horizontal"
          size={stagedSize ?? stagedMeasured.height}
          onSizeChange={handleStagedResize}
          min={STATUS_PANE_MIN}
          max={STATUS_PANE_MAX}
          defaultSize={STATUS_PANE_MIN * 3}
          ariaLabel="Resize staged section"
          panelSide="up"
          panelId="status-staged-pane"
        />
        <div
          className="status-unstaged flex min-h-0 flex-col overflow-hidden"
          style={{ flexGrow: 3, flexShrink: 1, flexBasis: 0 }}
        >
          <UnstagedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
        <YaggResizer
          orientation="horizontal"
          size={untrackedSize ?? untrackedMeasured.height}
          onSizeChange={handleUntrackedResize}
          min={STATUS_PANE_MIN}
          max={STATUS_PANE_MAX}
          defaultSize={STATUS_PANE_MIN * 2}
          ariaLabel="Resize untracked section"
          panelSide="down"
          panelId="status-untracked-pane"
        />
        <div
          ref={untrackedRef}
          id="status-untracked-pane"
          className="status-untracked flex min-h-0 flex-col overflow-hidden"
          style={
            untrackedSize !== undefined
              ? { height: untrackedSize, flexShrink: 0 }
              : { flexGrow: 2, flexShrink: 1, flexBasis: 0 }
          }
        >
          <UntrackedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
      </div>
      <YaggResizer
        orientation="vertical"
        size={leftWidth}
        onSizeChange={handleLeftResize}
        min={STATUS_LEFT_MIN}
        max={STATUS_LEFT_MAX}
        defaultSize={STATUS_LEFT_DEFAULT}
        ariaLabel="Resize file panel"
        panelId="status-left-panel"
      />
      <div className="status-right flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="status-diff bg-bg-canvas min-h-50 flex-1 overflow-hidden">
          <DiffViewPanel diff={currentDiff} loading={diffLoading} staged={currentDiffStaged} />
        </div>
        <div className="status-commit border-border shrink-0 overflow-hidden border-t">
          <CommitPanel />
        </div>
      </div>
    </div>
  );
}

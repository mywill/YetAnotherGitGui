import { useCallback, useEffect, useRef, useState } from "react";
import { StagedPanel } from "../files/StagedPanel";
import { UnstagedPanel } from "../files/UnstagedPanel";
import { UntrackedPanel } from "../files/UntrackedPanel";
import { CommitPanel } from "../commit/CommitPanel";
import { DiffViewPanel } from "../diff/DiffViewPanel";
import { YaggResizer } from "../common/YaggResizer";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";

const LEFT_DEFAULT = 280;
const LEFT_MIN = 120;
const LEFT_MAX = 100000;

const PANE_MIN = 80;
const PANE_MAX = 100000;
const STAGED_KEY = "workspace.split.status.staged";
const UNTRACKED_KEY = "workspace.split.status.untracked";

export function StatusView() {
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const fileStatusesLoading = useRepositoryStore((s) => s.fileStatusesLoading);
  const currentDiff = useRepositoryStore((s) => s.currentDiff);
  const currentDiffStaged = useRepositoryStore((s) => s.currentDiffStaged);
  const diffLoading = useRepositoryStore((s) => s.diffLoading);

  const leftWidth = useSettingsStore(
    (s) => s.layoutSizes["workspace.split.workcopy"] ?? LEFT_DEFAULT
  );
  const stagedSize = useSettingsStore((s) => s.layoutSizes[STAGED_KEY]);
  const untrackedSize = useSettingsStore((s) => s.layoutSizes[UNTRACKED_KEY]);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  // Track rendered pixel sizes so the resizer drag baseline is correct even
  // before either pane has a stored size, and so we can pin the opposite pane
  // when the user first drags.
  const stagedRef = useRef<HTMLDivElement>(null);
  const untrackedRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState({ staged: 0, untracked: 0 });

  useEffect(() => {
    const stagedEl = stagedRef.current;
    const untrackedEl = untrackedRef.current;
    if (!stagedEl || !untrackedEl) return;
    const update = () => {
      setMeasured({ staged: stagedEl.offsetHeight, untracked: untrackedEl.offsetHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(stagedEl);
    ro.observe(untrackedEl);
    return () => ro.disconnect();
  }, []);

  const handleLeftResize = useCallback(
    (next: number) => {
      setLayoutSize("workspace.split.workcopy", next);
    },
    [setLayoutSize]
  );

  const handleStagedResize = useCallback(
    (next: number) => {
      setLayoutSize(STAGED_KEY, next);
      // Pin untracked at its current rendered height on the first drag so
      // the unstaged middle pane is the only one that absorbs the change.
      if (untrackedSize === undefined && measured.untracked > 0) {
        setLayoutSize(UNTRACKED_KEY, measured.untracked);
      }
    },
    [setLayoutSize, untrackedSize, measured.untracked]
  );

  const handleUntrackedResize = useCallback(
    (next: number) => {
      setLayoutSize(UNTRACKED_KEY, next);
      if (stagedSize === undefined && measured.staged > 0) {
        setLayoutSize(STAGED_KEY, measured.staged);
      }
    },
    [setLayoutSize, stagedSize, measured.staged]
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
          size={stagedSize ?? measured.staged}
          onSizeChange={handleStagedResize}
          min={PANE_MIN}
          max={PANE_MAX}
          defaultSize={PANE_MIN * 3}
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
          size={untrackedSize ?? measured.untracked}
          onSizeChange={handleUntrackedResize}
          min={PANE_MIN}
          max={PANE_MAX}
          defaultSize={PANE_MIN * 2}
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
        min={LEFT_MIN}
        max={LEFT_MAX}
        defaultSize={LEFT_DEFAULT}
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

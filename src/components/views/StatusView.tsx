import { useCallback } from "react";
import { StagedUnstagedPanel } from "../files/StagedUnstagedPanel";
import { UntrackedPanel } from "../files/UntrackedPanel";
import { CommitPanel } from "../commit/CommitPanel";
import { DiffViewPanel } from "../diff/DiffViewPanel";
import { YaggResizer } from "../common/YaggResizer";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";

const LEFT_DEFAULT = 280;
const LEFT_MIN = 120;
const LEFT_MAX = 100000;

export function StatusView() {
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const fileStatusesLoading = useRepositoryStore((s) => s.fileStatusesLoading);
  const currentDiff = useRepositoryStore((s) => s.currentDiff);
  const currentDiffStaged = useRepositoryStore((s) => s.currentDiffStaged);
  const diffLoading = useRepositoryStore((s) => s.diffLoading);

  const leftWidth = useSettingsStore(
    (s) => s.layoutSizes["workspace.split.workcopy"] ?? LEFT_DEFAULT
  );
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  const handleLeftResize = useCallback(
    (next: number) => {
      setLayoutSize("workspace.split.workcopy", next);
    },
    [setLayoutSize]
  );

  return (
    <div className="status-view flex min-h-0 flex-1 overflow-hidden">
      <div
        id="status-left-panel"
        className="status-left bg-bg-panel flex flex-col overflow-hidden"
        style={{ width: leftWidth }}
      >
        <div className="status-staging flex min-h-0 flex-3 flex-col overflow-hidden">
          <StagedUnstagedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
        <div className="status-untracked flex min-h-0 flex-1 flex-col overflow-hidden">
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

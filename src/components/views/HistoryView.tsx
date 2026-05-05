import { useCallback, useRef } from "react";
import { CommitGraph } from "../graph/CommitGraph";
import { CommitDetailsPanel } from "../history/CommitDetailsPanel";
import { DetailsPanelEmpty } from "../common/DetailsPanelStates";
import { YaggResizer } from "../common/YaggResizer";
import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useResizeObserver } from "../../hooks/useResizeObserver";
import {
  HISTORY_DETAILS_DEFAULT,
  HISTORY_DETAILS_MIN,
  HISTORY_DETAILS_EDGE_RESERVE,
  LAYOUT_KEYS,
} from "../shell/layoutConstants";

export function HistoryView() {
  const commits = useRepositoryStore((s) => s.commits);
  const selectedCommitDetails = useRepositoryStore((s) => s.selectedCommitDetails);
  const commitDetailsLoading = useRepositoryStore((s) => s.commitDetailsLoading);
  const isEmptyRepo = useIsEmptyRepo();

  const storedDetailsWidth = useSettingsStore((s) => s.layoutSizes[LAYOUT_KEYS.historyDetails]);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  const containerRef = useRef<HTMLDivElement>(null);
  const { width: containerW } = useResizeObserver(containerRef);

  const detailsMax = Math.max(HISTORY_DETAILS_MIN, containerW - HISTORY_DETAILS_EDGE_RESERVE);
  const detailsWidth = Math.min(
    detailsMax,
    Math.max(HISTORY_DETAILS_MIN, storedDetailsWidth ?? HISTORY_DETAILS_DEFAULT)
  );

  const handleDetailsResize = useCallback(
    (next: number) => {
      setLayoutSize(LAYOUT_KEYS.historyDetails, next);
    },
    [setLayoutSize]
  );

  if (isEmptyRepo) {
    return (
      <div className="history-view flex min-h-0 flex-1 overflow-hidden">
        <DetailsPanelEmpty
          className="history-empty flex-1"
          label="No commits yet. Create your first commit in the Status view."
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="history-view flex min-h-0 flex-1 overflow-hidden">
      <div className="history-graph bg-bg-canvas min-h-0 min-w-100 flex-1 overflow-hidden">
        <CommitGraph commits={commits} />
      </div>
      <YaggResizer
        orientation="vertical"
        size={detailsWidth}
        onSizeChange={handleDetailsResize}
        min={HISTORY_DETAILS_MIN}
        max={detailsMax}
        defaultSize={HISTORY_DETAILS_DEFAULT}
        ariaLabel="Resize commit details"
        panelSide="right"
      />
      <div
        id="history-details-panel"
        className="history-details border-border bg-bg-panel flex shrink-0 flex-col overflow-hidden border-l"
        style={{ width: detailsWidth }}
      >
        <CommitDetailsPanel details={selectedCommitDetails} loading={commitDetailsLoading} />
      </div>
    </div>
  );
}

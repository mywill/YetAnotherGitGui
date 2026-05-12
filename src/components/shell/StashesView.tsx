import { useCallback, useEffect, useRef, useState } from "react";
import { StashList } from "./StashList";
import { StashDetailsPanel } from "../sidebar/StashDetailsPanel";
import { DetailsPanelEmpty } from "../common/DetailsPanelStates";
import { YaggResizer } from "../common/YaggResizer";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";

const LIST_MIN = 180;
const LIST_EDGE_RESERVE = 240;
const LIST_FRACTION = 0.4;

export const StashesView = () => {
  const selectedStashDetails = useRepositoryStore((s) => s.selectedStashDetails);
  const stashDetailsLoading = useRepositoryStore((s) => s.stashDetailsLoading);

  const storedListWidth = useSettingsStore((s) => s.layoutSizes["stash.listWidth"]);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const defaultListWidth = Math.max(LIST_MIN, Math.round(containerW * LIST_FRACTION));
  const listMax = Math.max(LIST_MIN, containerW - LIST_EDGE_RESERVE);
  const listWidth = Math.min(listMax, Math.max(LIST_MIN, storedListWidth ?? defaultListWidth));

  const handleListResize = useCallback(
    (next: number) => {
      setLayoutSize("stash.listWidth", next);
    },
    [setLayoutSize]
  );

  return (
    <div ref={containerRef} className="stashes-view flex min-h-0 flex-1 overflow-hidden">
      <div
        className="stash-list-col border-border bg-bg-canvas flex shrink-0 flex-col overflow-hidden border-r"
        style={{ width: listWidth }}
      >
        <StashList />
      </div>
      <YaggResizer
        orientation="vertical"
        size={listWidth}
        onSizeChange={handleListResize}
        min={LIST_MIN}
        max={listMax}
        defaultSize={defaultListWidth}
        ariaLabel="Resize stash list"
        panelSide="left"
      />
      <div className="stash-details-col bg-bg-panel flex min-w-0 flex-1 flex-col overflow-hidden">
        {selectedStashDetails !== null || stashDetailsLoading ? (
          <StashDetailsPanel details={selectedStashDetails} loading={stashDetailsLoading} />
        ) : (
          <DetailsPanelEmpty
            className="stash-details-empty"
            label="Select a stash to view details"
          />
        )}
      </div>
    </div>
  );
};

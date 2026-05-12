import { useCallback, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { StashDetails } from "../../types";
import { StashFileItem } from "./StashFileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { KeyboardList } from "../common/KeyboardList";
import { YaggResizer } from "../common/YaggResizer";
import { DetailsPanelLoading, DetailsPanelEmpty } from "../common/DetailsPanelStates";
import { cleanStashMessage } from "../../utils/stashMessage";

const INFO_MIN = 120;

interface StashDetailsPanelProps {
  details: StashDetails | null;
  loading: boolean;
}

export function StashDetailsPanel({ details, loading }: StashDetailsPanelProps) {
  const toggleStashFileExpanded = useRepositoryStore((s) => s.toggleStashFileExpanded);
  const loadStashFileDiff = useRepositoryStore((s) => s.loadStashFileDiff);

  const storedInfoHeight = useSettingsStore((s) => s.layoutSizes["stash.infoHeight"]);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);

  const containerObsRef = useRef<ResizeObserver | null>(null);
  const infoObsRef = useRef<ResizeObserver | null>(null);
  const [containerH, setContainerH] = useState(0);
  const [contentH, setContentH] = useState(0);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    containerObsRef.current?.disconnect();
    containerObsRef.current = null;
    if (!el) return;
    setContainerH(el.clientHeight);
    const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
    ro.observe(el);
    containerObsRef.current = ro;
  }, []);

  const infoContentRef = useCallback((el: HTMLDivElement | null) => {
    infoObsRef.current?.disconnect();
    infoObsRef.current = null;
    if (!el) return;
    setContentH(el.scrollHeight);
    const ro = new ResizeObserver(() => setContentH(el.scrollHeight));
    ro.observe(el);
    infoObsRef.current = ro;
  }, []);

  const defaultInfoHeight = Math.max(INFO_MIN, contentH);
  const infoMax = Math.max(INFO_MIN, containerH - 120);
  const infoHeight = Math.min(infoMax, Math.max(INFO_MIN, storedInfoHeight ?? defaultInfoHeight));

  const handleInfoResize = useCallback(
    (next: number) => {
      setLayoutSize("stash.infoHeight", next);
    },
    [setLayoutSize]
  );

  const handleActivate = useCallback(
    (index: number) => {
      if (!details) return;
      const file = details.files_changed[index];
      const { expandedStashFiles, stashFileDiffs } = useRepositoryStore.getState();
      toggleStashFileExpanded(file.path);
      if (!expandedStashFiles.has(file.path) && !stashFileDiffs.has(file.path)) {
        loadStashFileDiff(details.index, file.path);
      }
    },
    [details, toggleStashFileExpanded, loadStashFileDiff]
  );

  if (loading) {
    return <DetailsPanelLoading className="stash-details-panel" label="Loading stash details..." />;
  }

  if (!details) {
    return (
      <DetailsPanelEmpty className="stash-details-panel" label="Select a stash to view details" />
    );
  }

  const date = new Date(details.timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });
  const stashName = `stash@{${details.index}}`;

  const cleanMessage = cleanStashMessage(details.message);

  return (
    <div ref={containerRef} className="stash-details-panel flex h-full flex-col overflow-hidden">
      <div
        ref={infoContentRef}
        className="stash-info border-border shrink-0 overflow-y-auto border-b p-3"
        style={{ height: infoHeight }}
      >
        <div className="stash-name mb-2 flex items-center gap-2">
          <span className="label text-text-muted text-xs">Stash</span>
          <code className="name bg-bg-well text-text-primary rounded px-1.5 py-px font-mono text-xs">
            {stashName}
          </code>
        </div>

        <div className="stash-message-full text-text-primary mb-3 leading-normal break-words whitespace-pre-wrap">
          {cleanMessage}
        </div>

        <div className="stash-meta flex flex-col gap-1">
          {details.branch_name && (
            <div className="meta-row flex gap-2 text-xs">
              <span className="label text-text-muted min-w-15 shrink-0">Branch</span>
              <span className="value text-text-muted font-mono">{details.branch_name}</span>
            </div>
          )}
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Created</span>
            <span className="value text-text-muted" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Commit</span>
            <code className="value commit-hash bg-bg-well text-text-muted rounded-sm px-1 py-px font-mono text-xs">
              {details.commit_hash.slice(0, 12)}
            </code>
          </div>
        </div>
      </div>

      <YaggResizer
        orientation="horizontal"
        size={infoHeight}
        onSizeChange={handleInfoResize}
        min={INFO_MIN}
        max={infoMax}
        defaultSize={defaultInfoHeight}
        ariaLabel="Resize stash info"
        panelSide="up"
      />

      <div className="files-section flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="files-header border-border bg-bg-well text-text-muted text-2xs flex shrink-0 items-center justify-between border-b px-3 py-2 font-mono font-medium tracking-widest uppercase">
          <span>Files changed</span>
          <span className="file-count bg-bg-hover rounded-full px-2 py-px font-mono text-xs font-normal tracking-normal normal-case">
            {details.files_changed.length}
          </span>
        </div>
        <KeyboardList
          aria-label="Files changed"
          onActivate={handleActivate}
          onSecondaryActivate={handleActivate}
          className="files-list min-w-0 flex-1 overflow-y-auto"
        >
          {details.files_changed.map((file, i) => (
            <KeyboardList.Item key={file.path} index={i}>
              <StashFileItem file={file} stashIndex={details.index} />
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      </div>
    </div>
  );
}

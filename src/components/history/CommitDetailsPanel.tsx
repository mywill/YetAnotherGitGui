import { useCallback, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { IconArrowBackUp } from "@tabler/icons-react";
import type { CommitDetails } from "../../types";
import { CommitFileItem } from "./CommitFileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { YaggButton } from "../common/YaggButton";
import { YaggResizer } from "../common/YaggResizer";
import { KeyboardList } from "../common/KeyboardList";
import { DetailsPanelLoading, DetailsPanelEmpty } from "../common/DetailsPanelStates";

const INFO_FRACTION = 0.5;
const INFO_MIN = 120;

interface CommitDetailsPanelProps {
  details: CommitDetails | null;
  loading: boolean;
}

export function CommitDetailsPanel({ details, loading }: CommitDetailsPanelProps) {
  const revertCommit = useRepositoryStore((s) => s.revertCommit);
  const toggleCommitFileExpanded = useRepositoryStore((s) => s.toggleCommitFileExpanded);
  const loadCommitFileDiff = useRepositoryStore((s) => s.loadCommitFileDiff);
  const setActiveView = useSelectionStore((s) => s.setActiveView);
  const showConfirm = useDialogStore((s) => s.showConfirm);

  const storedInfoHeight = useSettingsStore((s) => s.layoutSizes["history.commitInfo"]);
  const setLayoutSize = useSettingsStore((s) => s.setLayoutSize);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [containerH, setContainerH] = useState(0);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    setContainerH(el.clientHeight);
    const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  const handleInfoResize = useCallback(
    (next: number) => {
      setLayoutSize("history.commitInfo", next);
    },
    [setLayoutSize]
  );

  const defaultInfoHeight = Math.max(INFO_MIN, Math.round(containerH * INFO_FRACTION));
  const infoMax = Math.max(INFO_MIN, containerH - 120);
  const infoHeight = Math.min(infoMax, Math.max(INFO_MIN, storedInfoHeight ?? defaultInfoHeight));

  const handleActivate = useCallback(
    (index: number) => {
      if (!details) return;
      const file = details.files_changed[index];
      const { expandedCommitFiles, commitFileDiffs } = useRepositoryStore.getState();
      toggleCommitFileExpanded(file.path);
      if (!expandedCommitFiles.has(file.path) && !commitFileDiffs.has(file.path)) {
        loadCommitFileDiff(details.hash, file.path);
      }
    },
    [details, toggleCommitFileExpanded, loadCommitFileDiff]
  );

  const handleRevertCommit = useCallback(async () => {
    if (!details) return;
    const shortHash = details.hash.slice(0, 7);
    const confirmed = await showConfirm({
      title: "Revert commit",
      message: `Revert commit ${shortHash}?\n\nThis will create new changes that undo this commit and stage them.`,
      confirmLabel: "Revert",
    });
    if (confirmed) {
      await revertCommit(details.hash);
      setActiveView("status");
    }
  }, [details, revertCommit, setActiveView, showConfirm]);

  if (loading) {
    return (
      <DetailsPanelLoading className="commit-details-panel" label="Loading commit details..." />
    );
  }

  if (!details) {
    return (
      <DetailsPanelEmpty className="commit-details-panel" label="Select a commit to view details" />
    );
  }

  const date = new Date(details.timestamp * 1000);
  const timeAgo = formatDistanceToNow(date, { addSuffix: true });

  return (
    <div ref={containerRef} className="commit-details-panel flex h-full flex-col overflow-hidden">
      <div
        className="commit-info border-border px-card-x py-card-y shrink-0 overflow-y-auto border-b"
        style={{ height: infoHeight }}
      >
        <div className="commit-hash mb-2 flex items-center gap-2">
          <span className="label text-text-muted text-xs">Commit</span>
          <code className="hash bg-bg-well text-text-primary rounded px-1.5 py-0.5 font-mono text-xs">
            {details.hash.slice(0, 12)}
          </code>
        </div>

        <div className="commit-message-full text-text-primary mb-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {details.message}
        </div>

        <div className="commit-meta flex flex-col gap-1">
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Author</span>
            <span className="value text-text-muted">
              {details.author_name} &lt;{details.author_email}&gt;
            </span>
          </div>
          <div className="meta-row flex gap-2 text-xs">
            <span className="label text-text-muted min-w-15 shrink-0">Date</span>
            <span className="value text-text-muted" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          {details.parent_hashes.length > 0 && (
            <div className="meta-row flex gap-2 text-xs">
              <span className="label text-text-muted min-w-15 shrink-0">
                Parent{details.parent_hashes.length > 1 ? "s" : ""}
              </span>
              <span className="value parents text-text-muted flex flex-wrap gap-1">
                {details.parent_hashes.map((hash) => (
                  <code
                    key={hash}
                    className="parent-hash bg-bg-well rounded-sm px-1 py-px font-mono text-xs"
                  >
                    {hash.slice(0, 7)}
                  </code>
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      <YaggResizer
        orientation="horizontal"
        size={infoHeight}
        onSizeChange={handleInfoResize}
        min={INFO_MIN}
        max={infoMax}
        defaultSize={defaultInfoHeight}
        ariaLabel="Resize commit info"
        panelSide="up"
      />

      <div className="files-section flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="files-header border-border bg-bg-well text-text-muted text-2xs py-card-y flex items-center justify-between border-b px-3 font-mono font-medium tracking-widest uppercase">
          <span>Files changed</span>
          <span className="file-count bg-bg-hover rounded-full px-2 py-px font-mono text-xs font-normal tracking-normal normal-case">
            {details.files_changed.length}
          </span>
          <YaggButton
            variant="outline"
            className="revert-commit-btn ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs font-normal"
            onClick={handleRevertCommit}
          >
            <IconArrowBackUp size={12} stroke={2} aria-hidden />
            <span>Revert commit</span>
          </YaggButton>
        </div>
        <KeyboardList
          aria-label="Files changed"
          onActivate={handleActivate}
          onSecondaryActivate={handleActivate}
          className="files-list min-w-0 flex-1 overflow-hidden overflow-x-auto overflow-y-auto"
        >
          {details.files_changed.map((file, i) => (
            <KeyboardList.Item key={file.path} index={i}>
              <CommitFileItem file={file} commitHash={details.hash} />
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      </div>
    </div>
  );
}

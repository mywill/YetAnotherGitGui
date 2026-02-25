import { useState, useCallback } from "react";
import { StagedUnstagedPanel } from "../files/StagedUnstagedPanel";
import { UntrackedPanel } from "../files/UntrackedPanel";
import { CommitPanel } from "../commit/CommitPanel";
import { DiffViewPanel } from "../diff/DiffViewPanel";
import { StashDetailsPanel } from "../sidebar/StashDetailsPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";

export function StatusView() {
  const fileStatuses = useRepositoryStore((s) => s.fileStatuses);
  const fileStatusesLoading = useRepositoryStore((s) => s.fileStatusesLoading);
  const currentDiff = useRepositoryStore((s) => s.currentDiff);
  const currentDiffStaged = useRepositoryStore((s) => s.currentDiffStaged);
  const diffLoading = useRepositoryStore((s) => s.diffLoading);
  const selectedStashDetails = useRepositoryStore((s) => s.selectedStashDetails);
  const stashDetailsLoading = useRepositoryStore((s) => s.stashDetailsLoading);

  const [leftWidth, setLeftWidth] = useState(280);

  // Show stash details panel if a stash is selected
  const showStashDetails = selectedStashDetails !== null || stashDetailsLoading;

  const handleHorizontalResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(200, Math.min(450, w + delta)));
  }, []);

  return (
    <div className="status-view flex min-h-0 flex-1 overflow-hidden">
      {/* Left: File panels only */}
      <div
        className="status-left bg-bg-secondary flex max-w-112 min-w-50 flex-col overflow-hidden"
        style={{ width: leftWidth }}
      >
        <div className="status-staging flex min-h-0 flex-3 flex-col overflow-hidden">
          <StagedUnstagedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
        <div className="status-untracked flex min-h-0 flex-1 flex-col overflow-hidden">
          <UntrackedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
      </div>
      <HorizontalResizer onResize={handleHorizontalResize} />
      {/* Right: Diff + Commit or Stash Details */}
      <div className="status-right flex min-w-75 flex-1 flex-col overflow-hidden">
        {showStashDetails ? (
          <div className="status-stash-details bg-bg-primary flex-1 overflow-hidden">
            <StashDetailsPanel details={selectedStashDetails} loading={stashDetailsLoading} />
          </div>
        ) : (
          <>
            <div className="status-diff bg-bg-primary min-h-50 flex-1 overflow-hidden">
              <DiffViewPanel diff={currentDiff} loading={diffLoading} staged={currentDiffStaged} />
            </div>
            <div
              className="status-commit border-border shrink-0 overflow-hidden border-t"
              style={{ minHeight: 140, maxHeight: 220 }}
            >
              <CommitPanel />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ResizerProps {
  onResize: (delta: number) => void;
}

function HorizontalResizer({ onResize }: ResizerProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;

      const handleMouseMove = (e: MouseEvent) => {
        onResize(e.clientX - startX);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize]
  );

  return (
    <div
      className="status-resizer-h bg-border hover:bg-bg-selected w-1 shrink-0 cursor-col-resize transition-colors duration-150"
      onMouseDown={handleMouseDown}
    />
  );
}

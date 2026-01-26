import { useState, useCallback } from "react";
import { StagedUnstagedPanel } from "../files/StagedUnstagedPanel";
import { UntrackedPanel } from "../files/UntrackedPanel";
import { CommitPanel } from "../commit/CommitPanel";
import { DiffViewPanel } from "../diff/DiffViewPanel";
import { StashDetailsPanel } from "../sidebar/StashDetailsPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import "./StatusView.css";

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
    <div className="status-view">
      {/* Left: File panels only */}
      <div className="status-left" style={{ width: leftWidth }}>
        <div className="status-staging">
          <StagedUnstagedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
        <div className="status-untracked">
          <UntrackedPanel statuses={fileStatuses} loading={fileStatusesLoading} />
        </div>
      </div>
      <HorizontalResizer onResize={handleHorizontalResize} />
      {/* Right: Diff + Commit or Stash Details */}
      <div className="status-right">
        {showStashDetails ? (
          <div className="status-stash-details">
            <StashDetailsPanel details={selectedStashDetails} loading={stashDetailsLoading} />
          </div>
        ) : (
          <>
            <div className="status-diff">
              <DiffViewPanel diff={currentDiff} loading={diffLoading} staged={currentDiffStaged} />
            </div>
            <div className="status-commit">
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

  return <div className="status-resizer-h" onMouseDown={handleMouseDown} />;
}

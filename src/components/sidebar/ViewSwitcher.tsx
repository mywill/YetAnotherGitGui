import clsx from "clsx";
import { useSelectionStore } from "../../stores/selectionStore";

export function ViewSwitcher() {
  const activeView = useSelectionStore((s) => s.activeView);
  const setActiveView = useSelectionStore((s) => s.setActiveView);

  return (
    <div
      className="view-switcher border-border flex gap-1 border-b p-2"
      role="tablist"
      aria-label="View selection"
    >
      <button
        role="tab"
        aria-selected={activeView === "history"}
        className={clsx(
          "view-tab text-text-secondary hover:bg-bg-hover hover:text-text-primary flex flex-1 items-center justify-center gap-1 rounded border border-transparent bg-transparent p-2 transition-all duration-150",
          activeView === "history" && "active bg-bg-selected border-bg-selected text-text-primary"
        )}
        onClick={() => setActiveView("history")}
      >
        <HistoryIcon />
        <span>History</span>
      </button>
      <button
        role="tab"
        aria-selected={activeView === "status"}
        className={clsx(
          "view-tab text-text-secondary hover:bg-bg-hover hover:text-text-primary flex flex-1 items-center justify-center gap-1 rounded border border-transparent bg-transparent p-2 transition-all duration-150",
          activeView === "status" && "active bg-bg-selected border-bg-selected text-text-primary"
        )}
        onClick={() => setActiveView("status")}
      >
        <StatusIcon />
        <span>Status</span>
      </button>
    </div>
  );
}

function HistoryIcon() {
  return (
    <svg className="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12z" />
      <path d="M8 4v4.5l3 1.5-.5 1-3.5-1.75V4h1z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg className="shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3h12v1H2V3zm0 4h12v1H2V7zm0 4h8v1H2v-1z" />
      <path d="M12 10l2 2-2 2v-1.5H9v-1h3V10z" />
    </svg>
  );
}

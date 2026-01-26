import { useSelectionStore } from "../../stores/selectionStore";
import "./ViewSwitcher.css";

export function ViewSwitcher() {
  const activeView = useSelectionStore((s) => s.activeView);
  const setActiveView = useSelectionStore((s) => s.setActiveView);

  return (
    <div className="view-switcher" role="tablist" aria-label="View selection">
      <button
        role="tab"
        aria-selected={activeView === "history"}
        className={`view-tab ${activeView === "history" ? "active" : ""}`}
        onClick={() => setActiveView("history")}
      >
        <HistoryIcon />
        <span>History</span>
      </button>
      <button
        role="tab"
        aria-selected={activeView === "status"}
        className={`view-tab ${activeView === "status" ? "active" : ""}`}
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12z" />
      <path d="M8 4v4.5l3 1.5-.5 1-3.5-1.75V4h1z" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 3h12v1H2V3zm0 4h12v1H2V7zm0 4h8v1H2v-1z" />
      <path d="M12 10l2 2-2 2v-1.5H9v-1h3V10z" />
    </svg>
  );
}

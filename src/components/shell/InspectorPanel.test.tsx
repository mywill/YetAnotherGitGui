import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InspectorPanel } from "./InspectorPanel";
import { useSelectionStore } from "../../stores/selectionStore";
import { useRepositoryStore } from "../../stores/repositoryStore";

vi.mock("../history/CommitDetailsPanel", () => ({
  CommitDetailsPanel: ({ details, loading }: { details: unknown; loading: boolean }) => (
    <div data-testid="commit-details-panel">
      {loading ? "Loading..." : details ? "Commit details" : "No commit selected"}
    </div>
  ),
}));

vi.mock("../common/DetailsPanelStates", () => ({
  DetailsPanelEmpty: ({ label }: { label: string; className?: string }) => (
    <div data-testid="details-panel-empty">{label}</div>
  ),
}));

describe("InspectorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSelectionStore.setState({ activeView: "history" });
    useRepositoryStore.setState({
      selectedCommitDetails: null,
      commitDetailsLoading: false,
      selectedStashDetails: null,
      stashDetailsLoading: false,
    });
  });

  it("shows CommitDetailsPanel for history view", () => {
    useSelectionStore.setState({ activeView: "history" });

    render(<InspectorPanel />);

    expect(screen.getByTestId("commit-details-panel")).toBeInTheDocument();
  });

  it("shows empty state for branches view", () => {
    useSelectionStore.setState({ activeView: "branches" });

    render(<InspectorPanel />);

    expect(screen.getByTestId("details-panel-empty")).toHaveTextContent("No details to show");
  });

  it("shows empty state for stashes view (stash details render inline in WorkspaceCenter)", () => {
    useSelectionStore.setState({ activeView: "stashes" });

    render(<InspectorPanel />);

    expect(screen.getByTestId("details-panel-empty")).toHaveTextContent("No details to show");
  });
});

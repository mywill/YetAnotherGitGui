import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceCenter } from "./WorkspaceCenter";
import { useSelectionStore } from "../../stores/selectionStore";

vi.mock("../views/StatusView", () => ({
  StatusView: () => <div data-testid="status-view">StatusView</div>,
}));

vi.mock("../views/HistoryView", () => ({
  HistoryView: () => <div data-testid="history-view">HistoryView</div>,
}));

vi.mock("../views/BranchesView", () => ({
  BranchesView: () => <div data-testid="branches-view">BranchesView</div>,
}));

vi.mock("./StashesView", () => ({
  StashesView: () => <div data-testid="stashes-view">StashesView</div>,
}));

describe("WorkspaceCenter", () => {
  beforeEach(() => {
    useSelectionStore.setState({ activeView: "status" });
  });

  it("renders StatusView when activeView is status", () => {
    render(<WorkspaceCenter />);

    expect(screen.getByTestId("status-view")).toBeInTheDocument();
    expect(screen.queryByTestId("history-view")).not.toBeInTheDocument();
  });

  it("renders HistoryView when activeView is history", () => {
    useSelectionStore.setState({ activeView: "history" });

    render(<WorkspaceCenter />);

    expect(screen.getByTestId("history-view")).toBeInTheDocument();
    expect(screen.queryByTestId("status-view")).not.toBeInTheDocument();
  });

  it("renders BranchesView when activeView is branches", () => {
    useSelectionStore.setState({ activeView: "branches" });

    render(<WorkspaceCenter />);

    expect(screen.getByTestId("branches-view")).toBeInTheDocument();
    expect(screen.queryByTestId("status-view")).not.toBeInTheDocument();
  });

  it("renders StashesView when activeView is stashes", () => {
    useSelectionStore.setState({ activeView: "stashes" });

    render(<WorkspaceCenter />);

    expect(screen.getByTestId("stashes-view")).toBeInTheDocument();
    expect(screen.queryByTestId("status-view")).not.toBeInTheDocument();
  });

  it("has tabpanel role", () => {
    render(<WorkspaceCenter />);

    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("has workspace-center CSS class", () => {
    const { container } = render(<WorkspaceCenter />);

    expect(container.querySelector(".workspace-center")).toBeInTheDocument();
  });
});

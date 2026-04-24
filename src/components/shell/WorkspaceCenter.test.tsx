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

vi.mock("../sidebar/BranchTagList", () => ({
  BranchTagList: () => <div data-testid="branch-tag-list">BranchTagList</div>,
}));

vi.mock("./StashList", () => ({
  StashList: () => <div data-testid="stash-list">StashList</div>,
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

  it("renders BranchTagList when activeView is branches", () => {
    useSelectionStore.setState({ activeView: "branches" });

    render(<WorkspaceCenter />);

    expect(screen.getByTestId("branch-tag-list")).toBeInTheDocument();
    expect(screen.queryByTestId("status-view")).not.toBeInTheDocument();
  });

  it("renders StashList when activeView is stashes", () => {
    useSelectionStore.setState({ activeView: "stashes" });

    render(<WorkspaceCenter />);

    expect(screen.getByTestId("stash-list")).toBeInTheDocument();
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

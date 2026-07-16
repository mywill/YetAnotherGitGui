import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorktreesView } from "./WorktreesView";
import { useWorktreeStore } from "../../stores/worktreeStore";
import type { WorktreeInfo } from "../../types";

vi.mock("../../stores/worktreeStore", async () => {
  const actual = await vi.importActual<typeof import("../../stores/worktreeStore")>(
    "../../stores/worktreeStore"
  );
  return {
    ...actual,
    useWorktreeStore: vi.fn(actual.useWorktreeStore),
  };
});

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(() => ({ repositoryInfo: { path: "/repo" } })),
}));

const mainWt: WorktreeInfo = {
  name: "main",
  path: "/repo",
  is_main: true,
  branch: "main",
  head_hash: "abc",
  is_valid: true,
  is_locked: false,
  lock_reason: null,
  is_prunable: false,
  dirty_count: 0,
  ahead: null,
  behind: null,
  last_commit_summary: "init",
  last_commit_author: "me",
  last_commit_time: 1000,
};

const linkedWt: WorktreeInfo = {
  name: "feature",
  path: "/repo-wt",
  is_main: false,
  branch: "feature",
  head_hash: "def",
  is_valid: true,
  is_locked: true,
  lock_reason: "wip",
  is_prunable: false,
  dirty_count: 3,
  ahead: 2,
  behind: 1,
  last_commit_summary: "feat",
  last_commit_author: "you",
  last_commit_time: 2000,
};

const mockRefresh = vi.fn().mockResolvedValue(undefined);

describe("WorktreesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorktreeStore.setState({
      worktrees: [],
      loading: false,
      addDialogOpen: false,
      addDialogPreset: null,
      refresh: mockRefresh,
    });
  });

  it("renders the header and refreshes on mount", async () => {
    render(<WorktreesView />);
    expect(screen.getByText("Worktrees")).toBeInTheDocument();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows a loading state", () => {
    useWorktreeStore.setState({ loading: true, worktrees: [] });
    render(<WorktreesView />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders worktree rows including the main worktree", () => {
    useWorktreeStore.setState({ worktrees: [mainWt, linkedWt] });
    render(<WorktreesView />);
    expect(screen.getAllByText("main").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("feature").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the dirty count for a linked worktree", () => {
    useWorktreeStore.setState({ worktrees: [mainWt, linkedWt] });
    render(<WorktreesView />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens the add dialog when Add is clicked", () => {
    useWorktreeStore.setState({ worktrees: [mainWt] });
    const openAddDialog = vi.fn();
    useWorktreeStore.setState({ openAddDialog });
    render(<WorktreesView />);
    fireEvent.click(screen.getByRole("button", { name: "Add worktree" }));
    expect(openAddDialog).toHaveBeenCalled();
  });

  it("disables Prune when no prunable worktrees exist", () => {
    useWorktreeStore.setState({ worktrees: [mainWt, linkedWt] });
    render(<WorktreesView />);
    expect(screen.getByRole("button", { name: "Prune worktrees" })).toBeDisabled();
  });

  it("enables Prune when prunable worktrees exist", () => {
    useWorktreeStore.setState({
      worktrees: [mainWt, { ...linkedWt, is_prunable: true }],
    });
    render(<WorktreesView />);
    expect(screen.getByRole("button", { name: "Prune worktrees" })).toBeEnabled();
  });

  it("triggers pruneWorktrees when Prune is clicked", () => {
    const pruneWorktrees = vi.fn().mockResolvedValue(undefined);
    useWorktreeStore.setState({
      worktrees: [mainWt, { ...linkedWt, is_prunable: true }],
      pruneWorktrees,
    });
    render(<WorktreesView />);
    fireEvent.click(screen.getByRole("button", { name: "Prune worktrees" }));
    expect(pruneWorktrees).toHaveBeenCalled();
  });

  it("renders column headers in the sticky header row", () => {
    useWorktreeStore.setState({ worktrees: [mainWt] });
    render(<WorktreesView />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Branch")).toBeInTheDocument();
    expect(screen.getByText("Path")).toBeInTheDocument();
    expect(screen.getByText("Dirty")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});

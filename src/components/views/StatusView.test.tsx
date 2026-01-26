import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusView } from "./StatusView";
import { useRepositoryStore } from "../../stores/repositoryStore";
import type { FileStatuses, FileDiff } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../files/StagedUnstagedPanel", () => ({
  StagedUnstagedPanel: ({
    statuses,
    loading,
  }: {
    statuses: FileStatuses | null;
    loading: boolean;
  }) => (
    <div data-testid="staged-unstaged-panel">
      {loading ? "Loading..." : `Staged: ${statuses?.staged.length ?? 0}`}
    </div>
  ),
}));

vi.mock("../files/UntrackedPanel", () => ({
  UntrackedPanel: ({ statuses, loading }: { statuses: FileStatuses | null; loading: boolean }) => (
    <div data-testid="untracked-panel">
      {loading ? "Loading..." : `Untracked: ${statuses?.untracked.length ?? 0}`}
    </div>
  ),
}));

vi.mock("../commit/CommitPanel", () => ({
  CommitPanel: () => <div data-testid="commit-panel">CommitPanel</div>,
}));

vi.mock("../diff/DiffViewPanel", () => ({
  DiffViewPanel: ({
    diff,
    loading,
    staged,
  }: {
    diff: FileDiff | null;
    loading: boolean;
    staged: boolean;
  }) => (
    <div data-testid="diff-view-panel">
      {loading
        ? "Loading diff..."
        : diff
          ? `Diff: ${diff.path} (${staged ? "staged" : "unstaged"})`
          : "No diff"}
    </div>
  ),
}));

vi.mock("../sidebar/StashDetailsPanel", () => ({
  StashDetailsPanel: () => <div data-testid="stash-details-panel">StashDetailsPanel</div>,
}));

describe("StatusView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupStore(
    overrides: Partial<{
      fileStatuses: FileStatuses | null;
      fileStatusesLoading: boolean;
      currentDiff: FileDiff | null;
      currentDiffStaged: boolean;
      diffLoading: boolean;
      selectedStashDetails: null;
      stashDetailsLoading: boolean;
    }> = {}
  ) {
    const defaultState = {
      fileStatuses: { staged: [], unstaged: [], untracked: [] },
      fileStatusesLoading: false,
      currentDiff: null,
      currentDiffStaged: false,
      diffLoading: false,
      selectedStashDetails: null,
      stashDetailsLoading: false,
      ...overrides,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) => {
      return selector(defaultState);
    });
  }

  it("renders all main panels", () => {
    setupStore();

    render(<StatusView />);

    expect(screen.getByTestId("staged-unstaged-panel")).toBeInTheDocument();
    expect(screen.getByTestId("untracked-panel")).toBeInTheDocument();
    expect(screen.getByTestId("diff-view-panel")).toBeInTheDocument();
    expect(screen.getByTestId("commit-panel")).toBeInTheDocument();
  });

  it("passes file statuses to panels", () => {
    setupStore({
      fileStatuses: {
        staged: [{ path: "staged.txt", status: "modified", is_staged: true }],
        unstaged: [{ path: "unstaged.txt", status: "modified", is_staged: false }],
        untracked: [
          { path: "new1.txt", status: "untracked", is_staged: false },
          { path: "new2.txt", status: "untracked", is_staged: false },
        ],
      },
    });

    render(<StatusView />);

    expect(screen.getByText("Staged: 1")).toBeInTheDocument();
    expect(screen.getByText("Untracked: 2")).toBeInTheDocument();
  });

  it("shows loading state for file statuses", () => {
    setupStore({
      fileStatusesLoading: true,
    });

    render(<StatusView />);

    const loadingElements = screen.getAllByText("Loading...");
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it("shows diff when selected", () => {
    setupStore({
      currentDiff: {
        path: "test.txt",
        hunks: [],
        is_binary: false,
      },
      currentDiffStaged: false,
    });

    render(<StatusView />);

    expect(screen.getByText("Diff: test.txt (unstaged)")).toBeInTheDocument();
  });

  it("shows staged diff status", () => {
    setupStore({
      currentDiff: {
        path: "staged.txt",
        hunks: [],
        is_binary: false,
      },
      currentDiffStaged: true,
    });

    render(<StatusView />);

    expect(screen.getByText("Diff: staged.txt (staged)")).toBeInTheDocument();
  });

  it("shows diff loading state", () => {
    setupStore({
      diffLoading: true,
    });

    render(<StatusView />);

    expect(screen.getByText("Loading diff...")).toBeInTheDocument();
  });

  it("has correct CSS layout structure", () => {
    setupStore();

    const { container } = render(<StatusView />);

    expect(container.querySelector(".status-view")).toBeInTheDocument();
    expect(container.querySelector(".status-left")).toBeInTheDocument();
    expect(container.querySelector(".status-right")).toBeInTheDocument();
    expect(container.querySelector(".status-staging")).toBeInTheDocument();
    expect(container.querySelector(".status-untracked")).toBeInTheDocument();
    expect(container.querySelector(".status-diff")).toBeInTheDocument();
    expect(container.querySelector(".status-commit")).toBeInTheDocument();
  });

  it("has a horizontal resizer", () => {
    setupStore();

    const { container } = render(<StatusView />);

    expect(container.querySelector(".status-resizer-h")).toBeInTheDocument();
  });

  it("resizer responds to mouse events", () => {
    setupStore();

    const { container } = render(<StatusView />);

    const resizer = container.querySelector(".status-resizer-h");
    expect(resizer).toBeInTheDocument();

    // Simulate mousedown on resizer
    fireEvent.mouseDown(resizer!, { clientX: 300 });

    // Should set cursor style on body during resize
    expect(document.body.style.cursor).toBe("col-resize");

    // Simulate mouseup to end resize
    fireEvent.mouseUp(document);

    // Cursor should be reset
    expect(document.body.style.cursor).toBe("");
  });

  it("handles null file statuses", () => {
    setupStore({
      fileStatuses: null,
    });

    render(<StatusView />);

    expect(screen.getByText("Staged: 0")).toBeInTheDocument();
    expect(screen.getByText("Untracked: 0")).toBeInTheDocument();
  });
});

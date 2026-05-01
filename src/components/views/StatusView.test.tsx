import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusView } from "./StatusView";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { mockStore } from "../../test/mockStores";
import type { FileStatuses, FileDiff } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({ layoutSizes: {}, setLayoutSize: vi.fn() })),
  }),
}));

vi.mock("../files/StagedPanel", () => ({
  StagedPanel: ({ statuses, loading }: { statuses: FileStatuses | null; loading: boolean }) => (
    <div data-testid="staged-panel">
      {loading ? "Loading..." : `Staged: ${statuses?.staged.length ?? 0}`}
    </div>
  ),
}));

vi.mock("../files/UnstagedPanel", () => ({
  UnstagedPanel: ({ statuses, loading }: { statuses: FileStatuses | null; loading: boolean }) => (
    <div data-testid="unstaged-panel">
      {loading ? "Loading..." : `Unstaged: ${statuses?.unstaged.length ?? 0}`}
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

describe("StatusView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore(useSettingsStore, { layoutSizes: {}, setLayoutSize: vi.fn() });
  });

  function setupStore(
    overrides: Partial<{
      fileStatuses: FileStatuses | null;
      fileStatusesLoading: boolean;
      currentDiff: FileDiff | null;
      currentDiffStaged: boolean;
      diffLoading: boolean;
    }> = {}
  ) {
    const defaultState = {
      fileStatuses: { staged: [], unstaged: [], untracked: [] },
      fileStatusesLoading: false,
      currentDiff: null,
      currentDiffStaged: false,
      diffLoading: false,
      ...overrides,
    };

    mockStore(useRepositoryStore, defaultState);
  }

  it("renders all main panels", () => {
    setupStore();

    render(<StatusView />);

    expect(screen.getByTestId("staged-panel")).toBeInTheDocument();
    expect(screen.getByTestId("unstaged-panel")).toBeInTheDocument();
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
    expect(screen.getByText("Unstaged: 1")).toBeInTheDocument();
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
        total_lines: 0,
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
        total_lines: 0,
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
    expect(container.querySelector(".status-staged")).toBeInTheDocument();
    expect(container.querySelector(".status-unstaged")).toBeInTheDocument();
    expect(container.querySelector(".status-untracked")).toBeInTheDocument();
    expect(container.querySelector(".status-diff")).toBeInTheDocument();
    expect(container.querySelector(".status-commit")).toBeInTheDocument();
  });

  it("has a horizontal resizer between the file panel and the diff/commit panel", () => {
    setupStore();

    const { container } = render(<StatusView />);

    const resizer = container.querySelector('[role="separator"][aria-orientation="vertical"]');
    expect(resizer).toBeInTheDocument();
    expect(resizer).toHaveAttribute("aria-label", "Resize file panel");
  });

  it("has horizontal resizers between the staged/unstaged/untracked panes", () => {
    setupStore();

    const { container } = render(<StatusView />);

    const horizontalResizers = container.querySelectorAll(
      '[role="separator"][aria-orientation="horizontal"]'
    );
    expect(horizontalResizers).toHaveLength(2);
    expect(horizontalResizers[0]).toHaveAttribute("aria-label", "Resize staged section");
    expect(horizontalResizers[1]).toHaveAttribute("aria-label", "Resize untracked section");
  });

  it("renders panes in flex mode by default (no stored sizes)", () => {
    setupStore();
    const { container } = render(<StatusView />);

    // With no stored sizes all three panes use flex, preserving the original
    // 3:3:2 default ratio. Unstaged is always flex (it's the buffer pane).
    const staged = container.querySelector(".status-staged") as HTMLElement;
    const unstaged = container.querySelector(".status-unstaged") as HTMLElement;
    const untracked = container.querySelector(".status-untracked") as HTMLElement;

    expect(staged.style.flexGrow).toBe("3");
    expect(unstaged.style.flexGrow).toBe("3");
    expect(untracked.style.flexGrow).toBe("2");
  });

  it("renders staged and untracked in pixel mode when stored sizes exist", () => {
    setupStore();
    mockStore(useSettingsStore, {
      layoutSizes: {
        "workspace.split.status.staged": 200,
        "workspace.split.status.untracked": 150,
      },
      setLayoutSize: vi.fn(),
    });
    const { container } = render(<StatusView />);

    const staged = container.querySelector(".status-staged") as HTMLElement;
    const untracked = container.querySelector(".status-untracked") as HTMLElement;
    const unstaged = container.querySelector(".status-unstaged") as HTMLElement;

    expect(staged.style.height).toBe("200px");
    expect(untracked.style.height).toBe("150px");
    // Unstaged is always flex — it absorbs all resize changes.
    expect(unstaged.style.flexGrow).toBe("3");
  });

  it("handles null file statuses", () => {
    setupStore({
      fileStatuses: null,
    });

    render(<StatusView />);

    expect(screen.getByText("Staged: 0")).toBeInTheDocument();
    expect(screen.getByText("Unstaged: 0")).toBeInTheDocument();
    expect(screen.getByText("Untracked: 0")).toBeInTheDocument();
  });
});

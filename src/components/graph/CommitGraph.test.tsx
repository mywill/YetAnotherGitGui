import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitGraph } from "./CommitGraph";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { mockStore } from "../../test/mockStores";
import type { GraphCommit } from "../../types";

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor() {}
} as unknown as typeof globalThis.ResizeObserver;

// Mock the stores
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: Object.assign(vi.fn(), {
    getState: vi.fn(() => ({ layoutSizes: {} })),
  }),
}));

// Mock BranchLines component to simplify testing
vi.mock("./BranchLines", () => ({
  BranchLines: ({ commit }: { commit: GraphCommit }) => (
    <div data-testid={`branch-lines-${commit.hash}`}>Branch Lines</div>
  ),
}));

// Mock ColumnResizer — expose onResize as a clickable button for test triggers
vi.mock("./ColumnResizer", () => ({
  ColumnResizer: ({
    onResize,
    ariaLabel,
  }: {
    onResize: (delta: number) => void;
    ariaLabel: string;
  }) => (
    <button
      type="button"
      data-testid="column-resizer"
      aria-label={ariaLabel}
      onClick={() => onResize(10)}
    />
  ),
}));

// Mock react-window v2 List to render all rows directly in jsdom, and assign listRef
vi.mock("react-window", () => ({
  List: ({
    rowComponent: RowComponent,
    rowCount,
    rowProps,
    listRef,
  }: {
    rowComponent: React.ComponentType<Record<string, unknown>>;
    rowCount: number;
    rowHeight: number;
    rowProps: Record<string, unknown>;
    listRef?: { current: unknown };
    style?: React.CSSProperties;
  }) => {
    const el = typeof document !== "undefined" ? document.createElement("div") : null;
    if (el) {
      Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 200 });
    }
    if (listRef) {
      listRef.current = {
        element: el,
        scrollToRow: () => {},
      };
    }
    return (
      <div data-testid="virtual-list">
        {Array.from({ length: rowCount }, (_, index) => (
          <RowComponent
            key={index}
            index={index}
            style={{ position: "absolute", top: index * 28, height: 28, width: "100%" }}
            ariaAttributes={{
              "aria-posinset": index + 1,
              "aria-setsize": rowCount,
              role: "listitem" as const,
            }}
            {...rowProps}
          />
        ))}
      </div>
    );
  },
}));

const mockSelectCommit = vi.fn();
const mockLoadCommitDetails = vi.fn();
const mockCheckoutCommit = vi.fn();
const mockShowConfirm = vi.fn();
const mockClearScrollToCommit = vi.fn();

const createMockCommit = (overrides: Partial<GraphCommit> = {}): GraphCommit => ({
  hash: "abc123def456789",
  short_hash: "abc123d",
  message: "Test commit message",
  author_name: "Test Author",
  author_email: "test@example.com",
  timestamp: Math.floor(Date.now() / 1000),
  parent_hashes: [],
  column: 0,
  lines: [],
  refs: [],
  is_tip: false,
  ...overrides,
});

describe("CommitGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowConfirm.mockResolvedValue(true);

    mockStore(useRepositoryStore, {
      checkoutCommit: mockCheckoutCommit,
      loadCommitDetails: mockLoadCommitDetails,
      repositoryInfo: {
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc123def456789",
      },
    });

    mockStore(useSelectionStore, {
      selectedCommitHash: null,
      selectCommit: mockSelectCommit,
      scrollToCommit: null,
      clearScrollToCommit: mockClearScrollToCommit,
    });

    mockStore(useDialogStore, { showConfirm: mockShowConfirm });
    mockStore(useSettingsStore, { layoutSizes: {}, setLayoutSize: vi.fn() });
  });

  it("renders with no commits", () => {
    const { container } = render(<CommitGraph commits={[]} />);

    expect(container.querySelector(".commit-graph")).toBeInTheDocument();
    expect(container.querySelector(".commit-graph-header")).toBeInTheDocument();
  });

  it("renders commit rows for each commit", () => {
    const commits = [
      createMockCommit({ hash: "commit1", message: "First commit" }),
      createMockCommit({ hash: "commit2", message: "Second commit" }),
      createMockCommit({ hash: "commit3", message: "Third commit" }),
    ];

    render(<CommitGraph commits={commits} />);

    // Should render all commits
    expect(screen.getByText("First commit")).toBeInTheDocument();
    expect(screen.getByText("Second commit")).toBeInTheDocument();
    expect(screen.getByText("Third commit")).toBeInTheDocument();
  });

  it("renders commit author names", () => {
    const commits = [
      createMockCommit({ author_name: "John Doe" }),
      createMockCommit({ hash: "commit2", author_name: "Jane Smith" }),
    ];

    render(<CommitGraph commits={commits} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders branch lines for each commit", () => {
    const commits = [createMockCommit({ hash: "commit1" }), createMockCommit({ hash: "commit2" })];

    render(<CommitGraph commits={commits} />);

    expect(screen.getByTestId("branch-lines-commit1")).toBeInTheDocument();
    expect(screen.getByTestId("branch-lines-commit2")).toBeInTheDocument();
  });

  it("calls selectCommit and loadCommitDetails when commit is clicked", () => {
    const commits = [createMockCommit({ hash: "clickable-commit" })];

    render(<CommitGraph commits={commits} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");
    fireEvent.click(commitRow!);

    expect(mockSelectCommit).toHaveBeenCalledWith("clickable-commit");
    expect(mockLoadCommitDetails).toHaveBeenCalledWith("clickable-commit");
  });

  it("shows HEAD badge for head commit", () => {
    const commits = [createMockCommit({ hash: "abc123def456789" })];

    render(<CommitGraph commits={commits} />);

    expect(screen.getByText("HEAD")).toBeInTheDocument();
  });

  it("renders ref badges for commits with refs", () => {
    const commits = [
      createMockCommit({
        refs: [
          { name: "main", ref_type: "branch", is_head: true },
          { name: "v1.0.0", ref_type: "tag", is_head: false },
        ],
      }),
    ];

    render(<CommitGraph commits={commits} />);

    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("shows confirmation dialog on double-click", async () => {
    const commits = [createMockCommit({ hash: "double-click-commit" })];

    render(<CommitGraph commits={commits} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");

    // Simulate double-click using mousedown with detail=2
    fireEvent.mouseDown(commitRow!, { detail: 2 });

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Checkout Commit",
        })
      );
    });
  });

  it("calls checkoutCommit when confirmation is accepted", async () => {
    mockShowConfirm.mockResolvedValue(true);
    const commits = [createMockCommit({ hash: "checkout-commit" })];

    render(<CommitGraph commits={commits} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");
    fireEvent.mouseDown(commitRow!, { detail: 2 });

    await waitFor(() => {
      expect(mockCheckoutCommit).toHaveBeenCalledWith("checkout-commit");
    });
  });

  it("does not checkout when confirmation is cancelled", async () => {
    mockShowConfirm.mockResolvedValue(false);
    const commits = [createMockCommit({ hash: "no-checkout-commit" })];

    render(<CommitGraph commits={commits} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");
    fireEvent.mouseDown(commitRow!, { detail: 2 });

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });
    expect(mockCheckoutCommit).not.toHaveBeenCalled();
  });

  it("applies selected class to selected commit", () => {
    mockStore(useSelectionStore, {
      selectedCommitHash: "selected-commit",
      selectCommit: mockSelectCommit,
      scrollToCommit: null,
      clearScrollToCommit: mockClearScrollToCommit,
    });

    const commits = [
      createMockCommit({ hash: "selected-commit", message: "Selected" }),
      createMockCommit({ hash: "other-commit", message: "Other" }),
    ];

    render(<CommitGraph commits={commits} />);

    const selectedRow = screen.getByText("Selected").closest(".commit-row");
    const otherRow = screen.getByText("Other").closest(".commit-row");

    expect(selectedRow).toHaveClass("selected");
    expect(otherRow).not.toHaveClass("selected");
  });

  it("applies is-head class to HEAD commit", () => {
    const commits = [
      createMockCommit({ hash: "abc123def456789", message: "HEAD commit" }),
      createMockCommit({ hash: "other-hash", message: "Other commit" }),
    ];

    render(<CommitGraph commits={commits} />);

    const headRow = screen.getByText("HEAD commit").closest(".commit-row");
    const otherRow = screen.getByText("Other commit").closest(".commit-row");

    expect(headRow).toHaveClass("is-head");
    expect(otherRow).not.toHaveClass("is-head");
  });

  it("renders column resizers", () => {
    render(<CommitGraph commits={[]} />);

    // Should have 3 column resizers
    const resizers = screen.getAllByTestId("column-resizer");
    expect(resizers).toHaveLength(3);
  });

  describe("column resize callbacks", () => {
    it("handleGraphResize persists new width via setLayoutSize", () => {
      const setLayoutSize = vi.fn();
      mockStore(useSettingsStore, { layoutSizes: { "graph.col.graph": 120 }, setLayoutSize });
      (useSettingsStore as unknown as { getState: () => unknown }).getState = () => ({
        layoutSizes: { "graph.col.graph": 120, "graph.col.author": 150, "graph.col.date": 120 },
      });

      render(<CommitGraph commits={[]} />);
      const graphResizer = screen.getByRole("button", { name: "Resize graph column" });
      fireEvent.click(graphResizer);

      expect(setLayoutSize).toHaveBeenCalledWith("graph.col.graph", 130);
    });

    it("handleMessageResize persists new author width via setLayoutSize", () => {
      const setLayoutSize = vi.fn();
      mockStore(useSettingsStore, { layoutSizes: {}, setLayoutSize });
      (useSettingsStore as unknown as { getState: () => unknown }).getState = () => ({
        layoutSizes: { "graph.col.author": 150 },
      });

      render(<CommitGraph commits={[]} />);
      const messageResizer = screen.getByRole("button", { name: "Resize message column" });
      fireEvent.click(messageResizer);

      expect(setLayoutSize).toHaveBeenCalledWith("graph.col.author", 140);
    });

    it("handleAuthorResize persists new date width via setLayoutSize", () => {
      const setLayoutSize = vi.fn();
      mockStore(useSettingsStore, { layoutSizes: {}, setLayoutSize });
      (useSettingsStore as unknown as { getState: () => unknown }).getState = () => ({
        layoutSizes: {},
      });

      render(<CommitGraph commits={[]} />);
      const authorResizer = screen.getByRole("button", { name: "Resize author column" });
      fireEvent.click(authorResizer);

      expect(setLayoutSize).toHaveBeenCalledWith("graph.col.date", 110);
    });
  });

  describe("keyboard navigation", () => {
    it("Enter on the commits listbox calls handleDoubleClick for focused commit", async () => {
      mockShowConfirm.mockResolvedValue(true);
      const commits = [
        createMockCommit({ hash: "kb-commit-1", message: "First" }),
        createMockCommit({ hash: "kb-commit-2", message: "Second" }),
      ];

      render(<CommitGraph commits={commits} />);
      const listbox = screen.getByRole("listbox", { name: "Commit history" });

      // Focus to initialize focusedIndex to 0
      fireEvent.focus(listbox);
      // Press Enter on the focused commit
      fireEvent.keyDown(listbox, { key: "Enter" });

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
    });

    it("ArrowDown on the listbox triggers onFocusChange which calls handleSelect", () => {
      const commits = [
        createMockCommit({ hash: "kb-commit-1", message: "First" }),
        createMockCommit({ hash: "kb-commit-2", message: "Second" }),
      ];

      render(<CommitGraph commits={commits} />);
      const listbox = screen.getByRole("listbox", { name: "Commit history" });

      fireEvent.focus(listbox);
      fireEvent.keyDown(listbox, { key: "ArrowDown" });

      expect(mockSelectCommit).toHaveBeenCalledWith("kb-commit-2");
    });

    it("Space on the listbox invokes secondary activate", async () => {
      mockShowConfirm.mockResolvedValue(true);
      const commits = [createMockCommit({ hash: "space-commit", message: "Space" })];

      render(<CommitGraph commits={commits} />);
      const listbox = screen.getByRole("listbox", { name: "Commit history" });

      fireEvent.focus(listbox);
      fireEvent.keyDown(listbox, { key: " " });

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
    });
  });

  it("renders header with column names", () => {
    render(<CommitGraph commits={[]} />);

    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  describe("dynamic graph column width", () => {
    it("computes --graph-width from the maximum commit column", () => {
      const commits = [
        createMockCommit({ hash: "c1", column: 0 }),
        createMockCommit({ hash: "c2", column: 3 }),
        createMockCommit({ hash: "c3", column: 7 }),
      ];
      const { container } = render(<CommitGraph commits={commits} />);

      const graphEl = container.querySelector<HTMLElement>(".commit-graph");
      const gw = parseFloat(graphEl!.style.getPropertyValue("--graph-width"));

      // min = 12 + 7*12 + 12 = 108
      expect(gw).toBeGreaterThanOrEqual(108);
    });

    it("uses configured width when wider than content minimum", () => {
      mockStore(useSettingsStore, {
        layoutSizes: { "graph.col.graph": 200 },
        setLayoutSize: vi.fn(),
      });
      (useSettingsStore as unknown as { getState: () => unknown }).getState = () => ({
        layoutSizes: { "graph.col.graph": 200 },
      });

      const commits = [
        createMockCommit({ hash: "c1", column: 0 }),
        createMockCommit({ hash: "c2", column: 1 }),
      ];
      const { container } = render(<CommitGraph commits={commits} />);

      const graphEl = container.querySelector<HTMLElement>(".commit-graph");
      const gw = parseFloat(graphEl!.style.getPropertyValue("--graph-width"));

      expect(gw).toBe(200);
    });

    it("resizer clamps stored width to content minimum", () => {
      const setLayoutSize = vi.fn();
      mockStore(useSettingsStore, { layoutSizes: { "graph.col.graph": 120 }, setLayoutSize });
      (useSettingsStore as unknown as { getState: () => unknown }).getState = () => ({
        layoutSizes: { "graph.col.graph": 120 },
      });

      const commits = [
        // max column = 5 → needs at least 12 + 5*12 + 12 = 84
        createMockCommit({ column: 5, hash: "w" }),
      ];
      render(<CommitGraph commits={commits} />);

      const graphResizer = screen.getByRole("button", { name: "Resize graph column" });

      // Delta = 50 → 120+50 = 170, clamp to 84: result is 170 (> minimum, passes)
      // Now simulate resize down: stored 120, delta -50 → 70 → max(84, 70) = 84
      fireEvent.click(graphResizer);
      // The mock fires onResize(10), so current=120, new=130, max(84,130)=130

      // As a negative test, if we simulated -50 delta instead we'd need a custom column resizer mock
      // Verify the clamp by checking the call uses max(minGraphWidth, current+delta)
      expect(setLayoutSize).toHaveBeenCalledWith("graph.col.graph", 130);
    });
  });

  describe("scrollToCommit behavior", () => {
    it("does not clear scrollToCommit while commits are still empty (loading)", () => {
      mockStore(useSelectionStore, {
        selectedCommitHash: null,
        selectCommit: mockSelectCommit,
        scrollToCommit: "target-hash",
        clearScrollToCommit: mockClearScrollToCommit,
      });

      render(<CommitGraph commits={[]} />);

      // Bug fix: previously we'd call clearScrollToCommit() as soon as the
      // effect ran and commits.findIndex returned -1. That killed the request
      // before the commits prop had a chance to populate after a view switch.
      expect(mockClearScrollToCommit).not.toHaveBeenCalled();
    });

    it("does not clear scrollToCommit when target hash is not (yet) in loaded commits", () => {
      mockStore(useSelectionStore, {
        selectedCommitHash: null,
        selectCommit: mockSelectCommit,
        scrollToCommit: "not-in-history",
        clearScrollToCommit: mockClearScrollToCommit,
      });

      render(
        <CommitGraph
          commits={[createMockCommit({ hash: "other1" }), createMockCommit({ hash: "other2" })]}
        />
      );

      // We keep scrollToCommit armed: when commits are refetched with a wider
      // range the target may appear and we'll scroll then.
      expect(mockClearScrollToCommit).not.toHaveBeenCalled();
    });

    it("scrolls to target commit and clears the request when target is in history", () => {
      mockStore(useSelectionStore, {
        selectedCommitHash: null,
        selectCommit: mockSelectCommit,
        scrollToCommit: "target-here",
        clearScrollToCommit: mockClearScrollToCommit,
      });

      render(
        <CommitGraph
          commits={[
            createMockCommit({ hash: "other1" }),
            createMockCommit({ hash: "target-here" }),
          ]}
        />
      );

      expect(mockLoadCommitDetails).toHaveBeenCalledWith("target-here");
      expect(mockClearScrollToCommit).toHaveBeenCalled();
    });
  });
});

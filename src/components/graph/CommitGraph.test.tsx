import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitGraph } from "./CommitGraph";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
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

// Mock BranchLines component to simplify testing
vi.mock("./BranchLines", () => ({
  BranchLines: ({ commit }: { commit: GraphCommit }) => (
    <div data-testid={`branch-lines-${commit.hash}`}>Branch Lines</div>
  ),
}));

// Mock ColumnResizer
vi.mock("./ColumnResizer", () => ({
  ColumnResizer: () => <div data-testid="column-resizer" />,
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

    (useRepositoryStore as unknown as Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          checkoutCommit: mockCheckoutCommit,
          loadCommitDetails: mockLoadCommitDetails,
          repositoryInfo: {
            path: "/test/repo",
            current_branch: "main",
            is_detached: false,
            remotes: [],
            head_hash: "abc123def456789",
          },
        };
        return selector(state);
      }
    );

    (useSelectionStore as unknown as Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          selectedCommitHash: null,
          selectCommit: mockSelectCommit,
          scrollToCommit: null,
          clearScrollToCommit: mockClearScrollToCommit,
        };
        return selector(state);
      }
    );

    (useDialogStore as unknown as Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          showConfirm: mockShowConfirm,
        };
        return selector(state);
      }
    );
  });

  it("renders with no commits", () => {
    const { container } = render(<CommitGraph commits={[]} onLoadMore={vi.fn()} hasMore={false} />);

    expect(container.querySelector(".commit-graph")).toBeInTheDocument();
    expect(container.querySelector(".commit-graph-header")).toBeInTheDocument();
  });

  it("renders commit rows for each commit", () => {
    const commits = [
      createMockCommit({ hash: "commit1", message: "First commit" }),
      createMockCommit({ hash: "commit2", message: "Second commit" }),
      createMockCommit({ hash: "commit3", message: "Third commit" }),
    ];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

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

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("renders branch lines for each commit", () => {
    const commits = [createMockCommit({ hash: "commit1" }), createMockCommit({ hash: "commit2" })];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    expect(screen.getByTestId("branch-lines-commit1")).toBeInTheDocument();
    expect(screen.getByTestId("branch-lines-commit2")).toBeInTheDocument();
  });

  it("calls selectCommit and loadCommitDetails when commit is clicked", () => {
    const commits = [createMockCommit({ hash: "clickable-commit" })];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");
    fireEvent.click(commitRow!);

    expect(mockSelectCommit).toHaveBeenCalledWith("clickable-commit");
    expect(mockLoadCommitDetails).toHaveBeenCalledWith("clickable-commit");
  });

  it("shows HEAD badge for head commit", () => {
    const commits = [createMockCommit({ hash: "abc123def456789" })];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

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

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("shows confirmation dialog on double-click", async () => {
    const commits = [createMockCommit({ hash: "double-click-commit" })];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

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

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");
    fireEvent.mouseDown(commitRow!, { detail: 2 });

    await waitFor(() => {
      expect(mockCheckoutCommit).toHaveBeenCalledWith("checkout-commit");
    });
  });

  it("does not checkout when confirmation is cancelled", async () => {
    mockShowConfirm.mockResolvedValue(false);
    const commits = [createMockCommit({ hash: "no-checkout-commit" })];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    const commitRow = screen.getByText("Test commit message").closest(".commit-row");
    fireEvent.mouseDown(commitRow!, { detail: 2 });

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });
    expect(mockCheckoutCommit).not.toHaveBeenCalled();
  });

  it("applies selected class to selected commit", () => {
    (useSelectionStore as unknown as Mock).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          selectedCommitHash: "selected-commit",
          selectCommit: mockSelectCommit,
          scrollToCommit: null,
          clearScrollToCommit: mockClearScrollToCommit,
        };
        return selector(state);
      }
    );

    const commits = [
      createMockCommit({ hash: "selected-commit", message: "Selected" }),
      createMockCommit({ hash: "other-commit", message: "Other" }),
    ];

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

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

    render(<CommitGraph commits={commits} onLoadMore={vi.fn()} hasMore={false} />);

    const headRow = screen.getByText("HEAD commit").closest(".commit-row");
    const otherRow = screen.getByText("Other commit").closest(".commit-row");

    expect(headRow).toHaveClass("is-head");
    expect(otherRow).not.toHaveClass("is-head");
  });

  it("renders column resizers", () => {
    render(<CommitGraph commits={[]} onLoadMore={vi.fn()} hasMore={false} />);

    // Should have 3 column resizers
    const resizers = screen.getAllByTestId("column-resizer");
    expect(resizers).toHaveLength(3);
  });

  it("renders header with column names", () => {
    render(<CommitGraph commits={[]} onLoadMore={vi.fn()} hasMore={false} />);

    expect(screen.getByText("Graph")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(screen.getByText("Author")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });
});

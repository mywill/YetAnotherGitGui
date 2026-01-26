import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryView } from "./HistoryView";
import { useRepositoryStore } from "../../stores/repositoryStore";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock("../graph/CommitGraph", () => ({
  CommitGraph: ({ commits }: { commits: unknown[] }) => (
    <div data-testid="commit-graph">CommitGraph ({commits.length} commits)</div>
  ),
}));

vi.mock("../history/CommitDetailsPanel", () => ({
  CommitDetailsPanel: ({ details, loading }: { details: unknown; loading: boolean }) => (
    <div data-testid="commit-details-panel">
      {loading ? "Loading..." : details ? "Details loaded" : "No details"}
    </div>
  ),
}));

describe("HistoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset body styles
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  function setupStore(overrides = {}) {
    const state = {
      commits: [],
      hasMoreCommits: false,
      loadMoreCommits: vi.fn(),
      selectedCommitDetails: null,
      commitDetailsLoading: false,
      ...overrides,
    };

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => selector(state)
    );

    return state;
  }

  it("renders commit graph and details panel", () => {
    setupStore();

    render(<HistoryView />);

    expect(screen.getByTestId("commit-graph")).toBeInTheDocument();
    expect(screen.getByTestId("commit-details-panel")).toBeInTheDocument();
  });

  it("passes commits to CommitGraph", () => {
    const mockCommits = [
      { hash: "abc123", message: "Test commit" },
      { hash: "def456", message: "Another commit" },
    ];

    setupStore({ commits: mockCommits, hasMoreCommits: true });

    render(<HistoryView />);

    expect(screen.getByText(/2 commits/)).toBeInTheDocument();
  });

  it("shows loading state in details panel", () => {
    setupStore({ commitDetailsLoading: true });

    render(<HistoryView />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows details when commit is selected", () => {
    const mockDetails = {
      hash: "abc123",
      message: "Test commit",
      author_name: "Test Author",
    };

    setupStore({ selectedCommitDetails: mockDetails });

    render(<HistoryView />);

    expect(screen.getByText("Details loaded")).toBeInTheDocument();
  });

  it("has correct CSS classes for layout", () => {
    setupStore();

    const { container } = render(<HistoryView />);

    expect(container.querySelector(".history-view")).toBeInTheDocument();
    expect(container.querySelector(".history-graph")).toBeInTheDocument();
    expect(container.querySelector(".history-details")).toBeInTheDocument();
    expect(container.querySelector(".history-resizer")).toBeInTheDocument();
  });

  describe("Resizer", () => {
    it("sets col-resize cursor on mousedown", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const resizer = container.querySelector(".history-resizer");
      fireEvent.mouseDown(resizer!, { clientX: 400 });

      expect(document.body.style.cursor).toBe("col-resize");
    });

    it("sets user-select to none on mousedown", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const resizer = container.querySelector(".history-resizer");
      fireEvent.mouseDown(resizer!, { clientX: 400 });

      expect(document.body.style.userSelect).toBe("none");
    });

    it("resets cursor on mouseup", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const resizer = container.querySelector(".history-resizer");
      fireEvent.mouseDown(resizer!, { clientX: 400 });

      expect(document.body.style.cursor).toBe("col-resize");

      fireEvent.mouseUp(document);

      expect(document.body.style.cursor).toBe("");
    });

    it("resets user-select on mouseup", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const resizer = container.querySelector(".history-resizer");
      fireEvent.mouseDown(resizer!, { clientX: 400 });

      expect(document.body.style.userSelect).toBe("none");

      fireEvent.mouseUp(document);

      expect(document.body.style.userSelect).toBe("");
    });

    it("changes details panel width during resize", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const detailsPanel = container.querySelector(".history-details");
      const resizer = container.querySelector(".history-resizer");

      // Initial width
      expect(detailsPanel).toHaveStyle({ width: "400px" });

      // Start resize
      fireEvent.mouseDown(resizer!, { clientX: 400 });

      // Move mouse (delta = -50, so width increases by 50)
      fireEvent.mouseMove(document, { clientX: 350 });

      expect(detailsPanel).toHaveStyle({ width: "450px" });

      fireEvent.mouseUp(document);
    });

    it("respects minimum width of 300px", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const detailsPanel = container.querySelector(".history-details");
      const resizer = container.querySelector(".history-resizer");

      fireEvent.mouseDown(resizer!, { clientX: 400 });

      // Try to shrink way below minimum
      fireEvent.mouseMove(document, { clientX: 600 });

      expect(detailsPanel).toHaveStyle({ width: "300px" });

      fireEvent.mouseUp(document);
    });

    it("respects maximum width of 600px", () => {
      setupStore();

      const { container } = render(<HistoryView />);

      const detailsPanel = container.querySelector(".history-details");
      const resizer = container.querySelector(".history-resizer");

      fireEvent.mouseDown(resizer!, { clientX: 400 });

      // Try to expand way above maximum
      fireEvent.mouseMove(document, { clientX: 0 });

      expect(detailsPanel).toHaveStyle({ width: "600px" });

      fireEvent.mouseUp(document);
    });
  });
});

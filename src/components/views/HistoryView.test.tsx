import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryView } from "./HistoryView";
import { useRepositoryStore, useIsEmptyRepo } from "../../stores/repositoryStore";
import { mockStore } from "../../test/mockStores";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
  useIsEmptyRepo: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock("../graph/CommitGraph", () => ({
  CommitGraph: ({ commits }: { commits: unknown[] }) => (
    <div data-testid="commit-graph">CommitGraph ({commits.length} commits)</div>
  ),
}));

describe("HistoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupStore(overrides: Record<string, unknown> = {}, isEmptyRepo = false) {
    const state = {
      commits: [],
      hasMoreCommits: false,
      loadMoreCommits: vi.fn(),
      ...overrides,
    };

    mockStore(useRepositoryStore, state);
    vi.mocked(useIsEmptyRepo).mockReturnValue(isEmptyRepo);

    return state;
  }

  it("renders commit graph", () => {
    setupStore();

    render(<HistoryView />);

    expect(screen.getByTestId("commit-graph")).toBeInTheDocument();
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

  it("has correct CSS classes for layout", () => {
    setupStore();

    const { container } = render(<HistoryView />);

    expect(container.querySelector(".history-view")).toBeInTheDocument();
    expect(container.querySelector(".history-graph")).toBeInTheDocument();
  });

  describe("empty repo", () => {
    it("shows empty state message when repo has no commits", () => {
      setupStore({}, true);

      render(<HistoryView />);

      expect(
        screen.getByText("No commits yet. Create your first commit in the Status view.")
      ).toBeInTheDocument();
    });

    it("does not show commit graph when repo is empty", () => {
      setupStore({}, true);

      render(<HistoryView />);

      expect(screen.queryByTestId("commit-graph")).not.toBeInTheDocument();
    });

    it("has history-view class on empty state", () => {
      setupStore({}, true);

      const { container } = render(<HistoryView />);

      expect(container.querySelector(".history-view")).toBeInTheDocument();
    });
  });
});

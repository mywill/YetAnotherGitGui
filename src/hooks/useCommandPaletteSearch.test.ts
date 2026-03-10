import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandPaletteSearch } from "./useCommandPaletteSearch";
import { useRepositoryStore } from "../stores/repositoryStore";
import type { GraphCommit, BranchInfo, TagInfo, StashInfo, FileStatuses } from "../types";

// Mock minimal commit data
function makeCommit(overrides: Partial<GraphCommit> = {}): GraphCommit {
  return {
    hash: "abc123def456789",
    short_hash: "abc123d",
    message: "Initial commit",
    author_name: "Test User",
    author_email: "test@example.com",
    timestamp: Date.now() / 1000,
    parent_hashes: [],
    column: 0,
    lines: [],
    refs: [],
    is_tip: false,
    ...overrides,
  };
}

function makeBranch(overrides: Partial<BranchInfo> = {}): BranchInfo {
  return {
    name: "main",
    is_remote: false,
    is_head: true,
    target_hash: "abc123",
    ...overrides,
  };
}

function makeTag(overrides: Partial<TagInfo> = {}): TagInfo {
  return {
    name: "v1.0.0",
    target_hash: "abc123",
    is_annotated: true,
    ...overrides,
  };
}

function makeStash(overrides: Partial<StashInfo> = {}): StashInfo {
  return {
    index: 0,
    message: "WIP on main",
    commit_hash: "stash123",
    timestamp: Date.now() / 1000,
    branch_name: "main",
    ...overrides,
  };
}

const mockFileStatuses: FileStatuses = {
  staged: [{ path: "staged-file.ts", status: "modified", is_staged: true }],
  unstaged: [{ path: "unstaged-file.ts", status: "modified", is_staged: false }],
  untracked: [{ path: "new-file.ts", status: "untracked", is_staged: false }],
};

describe("useCommandPaletteSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRepositoryStore.setState({
      commits: [
        makeCommit({
          hash: "aaa111",
          short_hash: "aaa111",
          message: "Fix login bug",
          author_name: "Alice",
        }),
        makeCommit({
          hash: "bbb222",
          short_hash: "bbb222",
          message: "Add feature",
          author_name: "Bob",
        }),
        makeCommit({
          hash: "ccc333",
          short_hash: "ccc333",
          message: "Update readme",
          author_name: "Alice",
        }),
      ],
      branches: [
        makeBranch({ name: "main" }),
        makeBranch({ name: "feature/login", is_head: false }),
        makeBranch({ name: "origin/main", is_remote: true, is_head: false }),
      ],
      tags: [makeTag({ name: "v1.0.0" }), makeTag({ name: "v2.0.0-beta" })],
      stashes: [makeStash({ message: "WIP on login feature" })],
      fileStatuses: mockFileStatuses,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty results for empty query", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toEqual([]);
  });

  it("returns empty results for whitespace query", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("   ", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toEqual([]);
  });

  it("searches commits by message", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("login", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const commits = result.current.filter((r) => r.category === "commits");
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe("Fix login bug");
  });

  it("searches commits by short hash", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("aaa111", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const commits = result.current.filter((r) => r.category === "commits");
    expect(commits).toHaveLength(1);
    expect(commits[0].detail).toBe("aaa111");
  });

  it("searches branches by name", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("login", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const branches = result.current.filter((r) => r.category === "branches");
    expect(branches).toHaveLength(1);
    expect(branches[0].label).toBe("feature/login");
  });

  it("searches tags by name", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("beta", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const tags = result.current.filter((r) => r.category === "tags");
    expect(tags).toHaveLength(1);
    expect(tags[0].label).toBe("v2.0.0-beta");
  });

  it("searches authors with deduplication", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("Alice", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const authors = result.current.filter((r) => r.category === "authors");
    // Alice appears in 2 commits but should be deduplicated
    expect(authors).toHaveLength(1);
    expect(authors[0].label).toBe("Alice");
  });

  it("searches files by path", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("staged", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const files = result.current.filter((r) => r.category === "files");
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files.some((f) => f.label === "staged-file.ts")).toBe(true);
  });

  it("searches stashes by message", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("login", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const stashes = result.current.filter((r) => r.category === "stashes");
    expect(stashes).toHaveLength(1);
    expect(stashes[0].label).toBe("WIP on login feature");
  });

  it("is case-insensitive", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("LOGIN", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const commits = result.current.filter((r) => r.category === "commits");
    expect(commits).toHaveLength(1);
  });

  it("limits results to 5 per category in all mode", () => {
    // Add more than 5 commits that match
    const manyCommits = Array.from({ length: 10 }, (_, i) =>
      makeCommit({
        hash: `hash${i}`,
        short_hash: `h${i}`,
        message: `test commit ${i}`,
        author_name: `Author${i}`,
      })
    );
    useRepositoryStore.setState({ commits: manyCommits });

    const { result } = renderHook(() => useCommandPaletteSearch("test", "all"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const commits = result.current.filter((r) => r.category === "commits");
    expect(commits).toHaveLength(5);
  });

  it("allows up to 50 results in filtered mode", () => {
    const manyCommits = Array.from({ length: 60 }, (_, i) =>
      makeCommit({ hash: `hash${i}`, short_hash: `h${i}`, message: `test commit ${i}` })
    );
    useRepositoryStore.setState({ commits: manyCommits });

    const { result } = renderHook(() => useCommandPaletteSearch("test", "commits"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toHaveLength(50);
  });

  it("only returns results for the active filter category", () => {
    const { result } = renderHook(() => useCommandPaletteSearch("main", "branches"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.every((r) => r.category === "branches")).toBe(true);
  });

  it("debounces search with 150ms delay", () => {
    const { result, rerender } = renderHook(({ query }) => useCommandPaletteSearch(query, "all"), {
      initialProps: { query: "" },
    });

    // Change query
    rerender({ query: "login" });

    // Before debounce fires, should still be empty (initial query was "")
    expect(result.current).toEqual([]);

    // After partial time, still empty
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toEqual([]);

    // After full debounce, results appear
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const commits = result.current.filter((r) => r.category === "commits");
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe("Fix login bug");
  });
});

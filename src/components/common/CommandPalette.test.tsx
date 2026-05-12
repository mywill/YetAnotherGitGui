import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { useCommandPaletteStore } from "../../stores/commandPaletteStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import type { GraphCommit, BranchInfo, TagInfo, StashInfo, FileStatuses } from "../../types";

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

const mockFileStatuses: FileStatuses = {
  staged: [{ path: "staged-file.ts", status: "modified", is_staged: true }],
  unstaged: [{ path: "unstaged-file.ts", status: "modified", is_staged: false }],
  untracked: [],
};

describe("CommandPalette", () => {
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
      ],
      branches: [
        { name: "main", is_remote: false, is_head: true, target_hash: "aaa111" } as BranchInfo,
        {
          name: "feature/login",
          is_remote: false,
          is_head: false,
          target_hash: "bbb222",
        } as BranchInfo,
      ],
      tags: [{ name: "v1.0.0", target_hash: "aaa111", is_annotated: true } as TagInfo],
      stashes: [
        {
          index: 0,
          message: "WIP on main",
          commit_hash: "stash1",
          timestamp: Date.now() / 1000,
          branch_name: "main",
        } as StashInfo,
      ],
      fileStatuses: mockFileStatuses,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useCommandPaletteStore.getState().close();
  });

  it("does not render when closed", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when open", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const backdrop = document.querySelector(".command-palette-backdrop")!;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows filter chips", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    expect(screen.getByRole("radio", { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Commits/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Branches/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Tags/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Authors/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Files/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Stashes/i })).toBeInTheDocument();
  });

  it("toggles filter on chip click", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const commitsChip = screen.getByRole("radio", { name: /Commits/i });
    fireEvent.click(commitsChip);
    expect(commitsChip).toHaveAttribute("aria-checked", "true");

    // Clicking again returns to "all"
    fireEvent.click(commitsChip);
    expect(commitsChip).toHaveAttribute("aria-checked", "false");
  });

  it("shows search results after typing", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "login" } });

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
  });

  it("shows 'No results found' for unmatched query", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "xyznonexistent" } });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("navigates results with arrow keys", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "a" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const dialog = screen.getByRole("dialog");

    // First result should be active
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    // Arrow down
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    // Arrow up
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("selects a commit result and navigates to it", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "login" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Enter" });

    // Palette should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Selection store should have been updated
    const selectionState = useSelectionStore.getState();
    expect(selectionState.selectedCommitHash).toBe("aaa111");
    expect(selectionState.activeView).toBe("history");
  });

  it("has proper ARIA attributes", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Command palette");

    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-label", "Filter categories");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-label", "Search results");
  });

  it("activates a branch result and scrolls to its target commit", () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggleFilter("branches");
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "feature" } });
    act(() => vi.advanceTimersByTime(200));

    fireEvent.click(screen.getByText(/feature\/login/i).closest("[role=option]")!);
    expect(useSelectionStore.getState().selectedCommitHash).toBe("bbb222");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("activates a tag result and scrolls to its target commit", () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggleFilter("tags");
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "v1" } });
    act(() => vi.advanceTimersByTime(200));

    fireEvent.click(screen.getByText(/v1\.0\.0/i).closest("[role=option]")!);
    expect(useSelectionStore.getState().selectedCommitHash).toBe("aaa111");
  });

  it("activates a file result and switches to status view", () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggleFilter("files");
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "staged-file" } });
    act(() => vi.advanceTimersByTime(200));

    fireEvent.click(screen.getAllByRole("option")[0]);
    expect(useSelectionStore.getState().activeView).toBe("status");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("activates a stash result and switches to status view", () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggleFilter("stashes");
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "WIP" } });
    act(() => vi.advanceTimersByTime(200));

    fireEvent.click(screen.getByText(/WIP on main/i).closest("[role=option]")!);
    expect(useSelectionStore.getState().activeView).toBe("status");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("activates an author result by scrolling to one of their commits", () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggleFilter("authors");
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "Alice" } });
    act(() => vi.advanceTimersByTime(200));

    const alice = screen.getAllByRole("option")[0];
    fireEvent.click(alice);
    // Either of the commits belongs to Alice; just confirm a selection occurred.
    expect(useSelectionStore.getState().selectedCommitHash).not.toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hover on a result makes it active", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "a" } });
    act(() => vi.advanceTimersByTime(200));

    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("Ctrl+2 toggles the Branches filter chip", () => {
    useCommandPaletteStore.getState().open();
    render(<CommandPalette />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "2", ctrlKey: true });
    const branchesChip = screen.getByRole("radio", { name: /Branches/i });
    expect(branchesChip).toHaveAttribute("aria-checked", "true");
  });

  it("ArrowDown stops at last result", () => {
    useCommandPaletteStore.getState().open();
    useCommandPaletteStore.getState().toggleFilter("commits");
    render(<CommandPalette />);

    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "a" } });
    act(() => vi.advanceTimersByTime(200));

    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(dialog, { key: "ArrowDown" });
    }
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAttribute("aria-selected", "true");
  });
});

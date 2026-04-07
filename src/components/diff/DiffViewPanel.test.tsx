import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiffViewPanel } from "./DiffViewPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { mockStore } from "../../test/mockStores";
import type { FileDiff } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

vi.mock("./DiffHunk", () => ({
  DiffHunk: ({
    onAction,
    actionLabel,
    onDiscardHunk,
    onDiscardLines,
    onResolveConflict,
  }: {
    onAction: () => void;
    actionLabel: string;
    onDiscardHunk?: () => void;
    onDiscardLines?: (lineIndices: number[]) => void;
    onResolveConflict?: (strategy: string) => void;
  }) => (
    <div data-testid="diff-hunk">
      <button onClick={onAction}>{actionLabel}</button>
      {onDiscardHunk && (
        <button data-testid="discard-hunk-btn" onClick={onDiscardHunk}>
          Discard hunk
        </button>
      )}
      {onDiscardLines && (
        <button data-testid="discard-lines-btn" onClick={() => onDiscardLines([1, 2])}>
          Discard lines
        </button>
      )}
      {onResolveConflict && (
        <>
          <button onClick={() => onResolveConflict("ours")}>Accept Ours</button>
          <button onClick={() => onResolveConflict("theirs")}>Accept Theirs</button>
          <button onClick={() => onResolveConflict("both")}>Both</button>
        </>
      )}
    </div>
  ),
}));

describe("DiffViewPanel", () => {
  const mockStageHunk = vi.fn();
  const mockUnstageHunk = vi.fn();
  const mockStageLines = vi.fn();
  const mockDiscardHunk = vi.fn();
  const mockDiscardLines = vi.fn();
  const mockShowConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore(useRepositoryStore, {
      stageHunk: mockStageHunk,
      unstageHunk: mockUnstageHunk,
      stageLines: mockStageLines,
      discardHunk: mockDiscardHunk,
      discardLines: mockDiscardLines,
      currentDiffPath: "test.txt",
      currentDiffIsUntracked: false,
      loadDiffHunk: vi.fn(),
    });

    mockStore(useSelectionStore, { selectedFilePaths: new Set() });

    mockStore(useDialogStore, { showConfirm: mockShowConfirm });
  });

  it("renders loading state", () => {
    render(<DiffViewPanel diff={null} loading={true} staged={false} />);

    expect(screen.getByText("Loading diff...")).toBeInTheDocument();
  });

  it("renders empty state when no diff", () => {
    render(<DiffViewPanel diff={null} loading={false} staged={false} />);

    expect(screen.getByText("Select a file to view its diff")).toBeInTheDocument();
  });

  it("renders binary file message", () => {
    const binaryDiff: FileDiff = {
      path: "image.png",
      hunks: [],
      is_binary: true,
      total_lines: 0,
    };

    render(<DiffViewPanel diff={binaryDiff} loading={false} staged={false} />);

    expect(screen.getByText("image.png")).toBeInTheDocument();
    expect(screen.getByText("Binary file - cannot display diff")).toBeInTheDocument();
  });

  it("renders no changes message when hunks are empty", () => {
    const emptyDiff: FileDiff = {
      path: "empty.txt",
      hunks: [],
      is_binary: false,
      total_lines: 0,
    };

    render(<DiffViewPanel diff={emptyDiff} loading={false} staged={false} />);

    expect(screen.getByText("empty.txt")).toBeInTheDocument();
    expect(screen.getByText("No changes to display")).toBeInTheDocument();
  });

  it("renders diff hunks", () => {
    const diff: FileDiff = {
      path: "test.txt",
      hunks: [
        {
          header: "@@ -1,3 +1,4 @@",
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 4,
          is_loaded: true,
          lines: [
            { content: "line 1", line_type: "context", old_lineno: 1, new_lineno: 1 },
            { content: "new line", line_type: "addition", old_lineno: null, new_lineno: 2 },
          ],
        },
      ],
      is_binary: false,
      total_lines: 2,
    };

    render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

    expect(screen.getByText("test.txt")).toBeInTheDocument();
    expect(screen.getByText("(unstaged)")).toBeInTheDocument();
    expect(screen.getByTestId("diff-hunk")).toBeInTheDocument();
  });

  it("shows staged status", () => {
    const diff: FileDiff = {
      path: "test.txt",
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
      ],
      is_binary: false,
      total_lines: 0,
    };

    render(<DiffViewPanel diff={diff} loading={false} staged={true} />);

    expect(screen.getByText("(staged)")).toBeInTheDocument();
  });

  it("calls stageHunk when action clicked for unstaged diff", async () => {
    const diff: FileDiff = {
      path: "test.txt",
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
      ],
      is_binary: false,
      total_lines: 0,
    };

    render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

    const stageButton = screen.getByText("Stage hunk");
    fireEvent.click(stageButton);

    expect(mockStageHunk).toHaveBeenCalledWith("test.txt", 0);
  });

  it("calls unstageHunk when action clicked for staged diff", async () => {
    const diff: FileDiff = {
      path: "test.txt",
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
      ],
      is_binary: false,
      total_lines: 0,
    };

    render(<DiffViewPanel diff={diff} loading={false} staged={true} />);

    const unstageButton = screen.getByText("Unstage hunk");
    fireEvent.click(unstageButton);

    expect(mockUnstageHunk).toHaveBeenCalledWith("test.txt", 0);
  });

  it("renders multiple hunks", () => {
    const diff: FileDiff = {
      path: "multi.txt",
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
        {
          header: "@@ -10,1 +10,1 @@",
          old_start: 10,
          old_lines: 1,
          new_start: 10,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
      ],
      is_binary: false,
      total_lines: 0,
    };

    render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

    const hunks = screen.getAllByTestId("diff-hunk");
    expect(hunks).toHaveLength(2);
  });

  it("has correct CSS classes", () => {
    const diff: FileDiff = {
      path: "test.txt",
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
      ],
      is_binary: false,
      total_lines: 0,
    };

    const { container } = render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

    expect(container.querySelector(".diff-view-panel")).toBeInTheDocument();
    expect(container.querySelector(".diff-header")).toBeInTheDocument();
    expect(container.querySelector(".diff-content")).toBeInTheDocument();
  });

  describe("discard buttons", () => {
    const diff: FileDiff = {
      path: "test.txt",
      hunks: [
        {
          header: "@@ -1,1 +1,1 @@",
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          is_loaded: true,
          lines: [],
        },
      ],
      is_binary: false,
      total_lines: 0,
    };

    it("passes discard props for unstaged diffs", () => {
      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(screen.getByTestId("discard-hunk-btn")).toBeInTheDocument();
      expect(screen.getByTestId("discard-lines-btn")).toBeInTheDocument();
    });

    it("does not pass discard props for staged diffs", () => {
      render(<DiffViewPanel diff={diff} loading={false} staged={true} />);

      expect(screen.queryByTestId("discard-hunk-btn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("discard-lines-btn")).not.toBeInTheDocument();
    });

    it("shows confirmation dialog before discarding hunk", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByTestId("discard-hunk-btn"));

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Discard hunk?",
          confirmLabel: "Discard",
        })
      );
    });

    it("calls discardHunk after confirmation", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByTestId("discard-hunk-btn"));

      // Wait for async confirmation
      await vi.waitFor(() => {
        expect(mockDiscardHunk).toHaveBeenCalledWith("test.txt", 0);
      });
    });

    it("does not call discardHunk when confirmation is cancelled", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByTestId("discard-hunk-btn"));

      await vi.waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });

      expect(mockDiscardHunk).not.toHaveBeenCalled();
    });

    it("shows confirmation dialog before discarding lines", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByTestId("discard-lines-btn"));

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Discard 2 lines?",
          confirmLabel: "Discard",
        })
      );
    });

    it("calls discardLines after confirmation", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByTestId("discard-lines-btn"));

      await vi.waitFor(() => {
        expect(mockDiscardLines).toHaveBeenCalledWith("test.txt", 0, [1, 2]);
      });
    });
  });

  describe("multi-file selection", () => {
    it("shows multi-select message when multiple files are selected", () => {
      mockStore(useSelectionStore, {
        selectedFilePaths: new Set([
          "unstaged:file1.txt",
          "unstaged:file2.txt",
          "unstaged:file3.txt",
        ]),
      });

      const diff: FileDiff = {
        path: "file1.txt",
        hunks: [
          {
            header: "@@ -1,1 +1,1 @@",
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 1,
            is_loaded: true,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 0,
      };

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText(/files selected/)).toBeInTheDocument();
      expect(screen.getByText("Select a single file to view its diff")).toBeInTheDocument();
    });

    it("shows diff when only one file is selected", () => {
      mockStore(useSelectionStore, {
        selectedFilePaths: new Set(["unstaged:file1.txt"]),
      });

      const diff: FileDiff = {
        path: "file1.txt",
        hunks: [
          {
            header: "@@ -1,1 +1,1 @@",
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 1,
            is_loaded: true,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 0,
      };

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(screen.getByText("file1.txt")).toBeInTheDocument();
      expect(screen.queryByText(/files selected/)).not.toBeInTheDocument();
    });

    it("has correct CSS class for multi-select state", () => {
      mockStore(useSelectionStore, {
        selectedFilePaths: new Set(["unstaged:file1.txt", "unstaged:file2.txt"]),
      });

      const { container } = render(<DiffViewPanel diff={null} loading={false} staged={false} />);

      expect(container.querySelector(".diff-view-panel.multi-select")).toBeInTheDocument();
    });
  });

  describe("collapsed hunks", () => {
    const mockLoadDiffHunk = vi.fn();

    beforeEach(() => {
      mockStore(useRepositoryStore, {
        stageHunk: vi.fn(),
        unstageHunk: vi.fn(),
        stageLines: vi.fn(),
        discardHunk: vi.fn(),
        discardLines: vi.fn(),
        currentDiffPath: "large-file.ts",
        currentDiffIsUntracked: false,
        loadDiffHunk: mockLoadDiffHunk,
      });
    });

    it("renders collapsed placeholder for unloaded hunks", () => {
      const diff: FileDiff = {
        path: "large-file.ts",
        hunks: [
          {
            header: "@@ -1,3 +1,4 @@",
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            is_loaded: true,
            lines: [{ content: "line 1", line_type: "context", old_lineno: 1, new_lineno: 1 }],
          },
          {
            header: "@@ -100,5 +100,6 @@",
            old_start: 100,
            old_lines: 5,
            new_start: 100,
            new_lines: 6,
            is_loaded: false,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 50,
      };

      const { container } = render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(container.querySelector(".collapsed-hunk")).toBeInTheDocument();
      expect(screen.getByText("Load hunk")).toBeInTheDocument();
      expect(screen.getByText("~11 lines")).toBeInTheDocument();
    });

    it("shows truncation summary bar when hunks are collapsed", () => {
      const diff: FileDiff = {
        path: "large-file.ts",
        hunks: [
          {
            header: "@@ -1,3 +1,4 @@",
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            is_loaded: true,
            lines: [
              { content: "line 1", line_type: "context", old_lineno: 1, new_lineno: 1 },
              { content: "line 2", line_type: "addition", old_lineno: null, new_lineno: 2 },
            ],
          },
          {
            header: "@@ -100,5 +100,6 @@",
            old_start: 100,
            old_lines: 5,
            new_start: 100,
            new_lines: 6,
            is_loaded: false,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 20,
      };

      const { container } = render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(container.querySelector(".truncation-bar")).toBeInTheDocument();
      expect(screen.getByText(/showing 2 of 20 lines/)).toBeInTheDocument();
      expect(screen.getByText(/1 hunk collapsed/)).toBeInTheDocument();
      expect(screen.getByText("Load All")).toBeInTheDocument();
    });

    it("calls loadDiffHunk when Load hunk button is clicked", () => {
      const diff: FileDiff = {
        path: "large-file.ts",
        hunks: [
          {
            header: "@@ -100,5 +100,6 @@",
            old_start: 100,
            old_lines: 5,
            new_start: 100,
            new_lines: 6,
            is_loaded: false,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 20,
      };

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByText("Load hunk"));

      expect(mockLoadDiffHunk).toHaveBeenCalledWith(
        "large-file.ts",
        false,
        0,
        undefined,
        undefined
      );
    });

    it("calls loadDiffHunk for all collapsed hunks on Load All", async () => {
      const diff: FileDiff = {
        path: "large-file.ts",
        hunks: [
          {
            header: "@@ -1,3 +1,4 @@",
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            is_loaded: true,
            lines: [],
          },
          {
            header: "@@ -50,5 +50,6 @@",
            old_start: 50,
            old_lines: 5,
            new_start: 50,
            new_lines: 6,
            is_loaded: false,
            lines: [],
          },
          {
            header: "@@ -100,5 +100,6 @@",
            old_start: 100,
            old_lines: 5,
            new_start: 100,
            new_lines: 6,
            is_loaded: false,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 40,
      };

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      fireEvent.click(screen.getByText("Load All"));

      await vi.waitFor(() => {
        expect(mockLoadDiffHunk).toHaveBeenCalledTimes(2);
        expect(mockLoadDiffHunk).toHaveBeenCalledWith(
          "large-file.ts",
          false,
          1,
          undefined,
          undefined
        );
        expect(mockLoadDiffHunk).toHaveBeenCalledWith(
          "large-file.ts",
          false,
          2,
          undefined,
          undefined
        );
      });
    });

    it("does not show truncation bar when all hunks are loaded", () => {
      const diff: FileDiff = {
        path: "small-file.ts",
        hunks: [
          {
            header: "@@ -1,3 +1,4 @@",
            old_start: 1,
            old_lines: 3,
            new_start: 1,
            new_lines: 4,
            is_loaded: true,
            lines: [],
          },
        ],
        is_binary: false,
        total_lines: 5,
      };

      const { container } = render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(container.querySelector(".truncation-bar")).not.toBeInTheDocument();
    });
  });

  describe("conflict mode", () => {
    const conflictDiff: FileDiff = {
      path: "conflict.txt",
      hunks: [
        {
          header: "@@ Conflict 1/1 @@",
          old_start: 0,
          old_lines: 0,
          new_start: 1,
          new_lines: 5,
          is_loaded: true,
          lines: [
            {
              content: "<<<<<<< HEAD",
              line_type: "conflict_marker",
              old_lineno: null,
              new_lineno: 1,
            },
            { content: "ours", line_type: "conflict_ours", old_lineno: null, new_lineno: 2 },
            { content: "=======", line_type: "conflict_marker", old_lineno: null, new_lineno: 3 },
            {
              content: "theirs",
              line_type: "conflict_theirs",
              old_lineno: null,
              new_lineno: 4,
            },
            {
              content: ">>>>>>> branch",
              line_type: "conflict_marker",
              old_lineno: null,
              new_lineno: 5,
            },
          ],
        },
      ],
      is_binary: false,
      total_lines: 5,
      is_conflicted: true,
    };

    const mockResolveConflict = vi.fn();
    const mockStageFile = vi.fn();

    beforeEach(() => {
      mockStore(useRepositoryStore, {
        stageHunk: mockStageHunk,
        unstageHunk: mockUnstageHunk,
        stageLines: mockStageLines,
        discardHunk: mockDiscardHunk,
        discardLines: mockDiscardLines,
        currentDiffPath: "conflict.txt",
        currentDiffIsUntracked: false,
        currentDiffIsConflicted: true,
        loadDiffHunk: vi.fn(),
        resolveConflict: mockResolveConflict,
        stageFile: mockStageFile,
      });
    });

    it("shows conflicted status with count instead of (staged)/(unstaged)", () => {
      render(<DiffViewPanel diff={conflictDiff} loading={false} staged={false} />);

      expect(screen.getByText("(conflicted — 1 conflict)")).toBeInTheDocument();
      expect(screen.queryByText("(unstaged)")).not.toBeInTheDocument();
    });

    it("shows conflict resolution buttons in hunk header", () => {
      render(<DiffViewPanel diff={conflictDiff} loading={false} staged={false} />);

      expect(screen.getByText("Accept Ours")).toBeInTheDocument();
      expect(screen.getByText("Accept Theirs")).toBeInTheDocument();
      expect(screen.getByText("Both")).toBeInTheDocument();
    });

    it("shows Mark Resolved button in diff header", () => {
      render(<DiffViewPanel diff={conflictDiff} loading={false} staged={false} />);

      expect(screen.getByText("Mark Resolved")).toBeInTheDocument();
    });

    it("calls resolveConflict with ours strategy when Accept Ours is clicked", () => {
      render(<DiffViewPanel diff={conflictDiff} loading={false} staged={false} />);

      fireEvent.click(screen.getByText("Accept Ours"));

      expect(mockResolveConflict).toHaveBeenCalledWith("conflict.txt", "ours");
    });

    it("calls resolveConflict with theirs strategy when Accept Theirs is clicked", () => {
      render(<DiffViewPanel diff={conflictDiff} loading={false} staged={false} />);

      fireEvent.click(screen.getByText("Accept Theirs"));

      expect(mockResolveConflict).toHaveBeenCalledWith("conflict.txt", "theirs");
    });

    it("calls resolveConflict with both strategy when Both is clicked", () => {
      render(<DiffViewPanel diff={conflictDiff} loading={false} staged={false} />);

      fireEvent.click(screen.getByText("Both"));

      expect(mockResolveConflict).toHaveBeenCalledWith("conflict.txt", "both");
    });
  });
});

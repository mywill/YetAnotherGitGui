import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiffViewPanel } from "./DiffViewPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
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
  }: {
    onAction: () => void;
    actionLabel: string;
    onDiscardHunk?: () => void;
    onDiscardLines?: (lineIndices: number[]) => void;
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

    vi.mocked(useRepositoryStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => {
        const state = {
          stageHunk: mockStageHunk,
          unstageHunk: mockUnstageHunk,
          stageLines: mockStageLines,
          discardHunk: mockDiscardHunk,
          discardLines: mockDiscardLines,
          currentDiffPath: "test.txt",
        };
        return selector(state);
      }
    );

    // Default: no files selected
    vi.mocked(useSelectionStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => {
        const state = {
          selectedFilePaths: new Set(),
        };
        return selector(state);
      }
    );

    vi.mocked(useDialogStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => {
        const state = {
          showConfirm: mockShowConfirm,
        };
        return selector(state);
      }
    );
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
          lines: [
            { content: "line 1", line_type: "context", old_lineno: 1, new_lineno: 1 },
            { content: "new line", line_type: "addition", old_lineno: null, new_lineno: 2 },
          ],
        },
      ],
      is_binary: false,
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
          lines: [],
        },
      ],
      is_binary: false,
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
          lines: [],
        },
      ],
      is_binary: false,
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
          lines: [],
        },
      ],
      is_binary: false,
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
          lines: [],
        },
        {
          header: "@@ -10,1 +10,1 @@",
          old_start: 10,
          old_lines: 1,
          new_start: 10,
          new_lines: 1,
          lines: [],
        },
      ],
      is_binary: false,
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
          lines: [],
        },
      ],
      is_binary: false,
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
          lines: [],
        },
      ],
      is_binary: false,
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
      vi.mocked(useSelectionStore).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (selector: any) => {
          const state = {
            selectedFilePaths: new Set([
              "unstaged:file1.txt",
              "unstaged:file2.txt",
              "unstaged:file3.txt",
            ]),
          };
          return selector(state);
        }
      );

      const diff: FileDiff = {
        path: "file1.txt",
        hunks: [
          {
            header: "@@ -1,1 +1,1 @@",
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 1,
            lines: [],
          },
        ],
        is_binary: false,
      };

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText(/files selected/)).toBeInTheDocument();
      expect(screen.getByText("Select a single file to view its diff")).toBeInTheDocument();
    });

    it("shows diff when only one file is selected", () => {
      vi.mocked(useSelectionStore).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (selector: any) => {
          const state = {
            selectedFilePaths: new Set(["unstaged:file1.txt"]),
          };
          return selector(state);
        }
      );

      const diff: FileDiff = {
        path: "file1.txt",
        hunks: [
          {
            header: "@@ -1,1 +1,1 @@",
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 1,
            lines: [],
          },
        ],
        is_binary: false,
      };

      render(<DiffViewPanel diff={diff} loading={false} staged={false} />);

      expect(screen.getByText("file1.txt")).toBeInTheDocument();
      expect(screen.queryByText(/files selected/)).not.toBeInTheDocument();
    });

    it("has correct CSS class for multi-select state", () => {
      vi.mocked(useSelectionStore).mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (selector: any) => {
          const state = {
            selectedFilePaths: new Set(["unstaged:file1.txt", "unstaged:file2.txt"]),
          };
          return selector(state);
        }
      );

      const { container } = render(<DiffViewPanel diff={null} loading={false} staged={false} />);

      expect(container.querySelector(".diff-view-panel.multi-select")).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitFileDiff } from "./CommitFileDiff";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import type { FileDiff } from "../../types";

// Mock stores
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

describe("CommitFileDiff", () => {
  const mockRevertCommitFileLines = vi.fn().mockResolvedValue(undefined);
  const mockShowConfirm = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) =>
      selector({ revertCommitFileLines: mockRevertCommitFileLines })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDialogStore).mockImplementation((selector: any) =>
      selector({ showConfirm: mockShowConfirm })
    );
  });

  describe("binary file handling", () => {
    it("shows binary file message when is_binary is true", () => {
      const binaryDiff: FileDiff = {
        path: "image.png",
        hunks: [],
        is_binary: true,
      };

      render(<CommitFileDiff diff={binaryDiff} />);

      expect(screen.getByText("Binary file - cannot display diff")).toBeInTheDocument();
    });

    it("has binary CSS class for binary files", () => {
      const binaryDiff: FileDiff = {
        path: "image.png",
        hunks: [],
        is_binary: true,
      };

      const { container } = render(<CommitFileDiff diff={binaryDiff} />);

      expect(container.querySelector(".commit-file-diff.binary")).toBeInTheDocument();
    });
  });

  describe("empty hunks", () => {
    it("shows empty message when hunks array is empty", () => {
      const emptyDiff: FileDiff = {
        path: "unchanged.ts",
        hunks: [],
        is_binary: false,
      };

      render(<CommitFileDiff diff={emptyDiff} />);

      expect(screen.getByText("No changes to display")).toBeInTheDocument();
    });

    it("has empty CSS class for empty hunks", () => {
      const emptyDiff: FileDiff = {
        path: "unchanged.ts",
        hunks: [],
        is_binary: false,
      };

      const { container } = render(<CommitFileDiff diff={emptyDiff} />);

      expect(container.querySelector(".commit-file-diff.empty")).toBeInTheDocument();
    });
  });

  describe("diff rendering", () => {
    const sampleDiff: FileDiff = {
      path: "test.ts",
      hunks: [
        {
          header: "@@ -1,3 +1,4 @@",
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 4,
          lines: [
            { content: "const x = 1;", line_type: "context", old_lineno: 1, new_lineno: 1 },
            { content: "const y = 2;", line_type: "deletion", old_lineno: 2, new_lineno: null },
            { content: "const y = 3;", line_type: "addition", old_lineno: null, new_lineno: 2 },
            { content: "export { x };", line_type: "context", old_lineno: 3, new_lineno: 3 },
          ],
        },
      ],
      is_binary: false,
    };

    it("renders all lines in hunk", () => {
      render(<CommitFileDiff diff={sampleDiff} />);

      expect(screen.getByText("const x = 1;")).toBeInTheDocument();
      expect(screen.getByText("const y = 2;")).toBeInTheDocument();
      expect(screen.getByText("const y = 3;")).toBeInTheDocument();
      expect(screen.getByText("export { x };")).toBeInTheDocument();
    });

    it("renders line numbers correctly", () => {
      const { container } = render(<CommitFileDiff diff={sampleDiff} />);

      const oldLineNumbers = container.querySelectorAll(".line-number.old");
      const newLineNumbers = container.querySelectorAll(".line-number.new");

      expect(oldLineNumbers[0]).toHaveTextContent("1");
      expect(newLineNumbers[0]).toHaveTextContent("1");

      // Deletion has old line number but no new line number
      expect(oldLineNumbers[1]).toHaveTextContent("2");
      expect(newLineNumbers[1]).toHaveTextContent("");

      // Addition has new line number but no old line number
      expect(oldLineNumbers[2]).toHaveTextContent("");
      expect(newLineNumbers[2]).toHaveTextContent("2");
    });

    it("renders correct line prefixes", () => {
      const { container } = render(<CommitFileDiff diff={sampleDiff} />);

      const prefixes = container.querySelectorAll(".line-prefix");

      // Context lines have a space prefix, deletions have -, additions have +
      expect(prefixes[0].textContent?.trim()).toBe(""); // context (space becomes empty when trimmed)
      expect(prefixes[1]).toHaveTextContent("-"); // deletion
      expect(prefixes[2]).toHaveTextContent("+"); // addition
      expect(prefixes[3].textContent?.trim()).toBe(""); // context
    });

    it("applies correct CSS classes for line types", () => {
      const { container } = render(<CommitFileDiff diff={sampleDiff} />);

      expect(container.querySelectorAll(".line-context").length).toBe(2);
      expect(container.querySelector(".line-deletion")).toBeInTheDocument();
      expect(container.querySelector(".line-addition")).toBeInTheDocument();
    });
  });

  describe("multiple hunks", () => {
    it("renders multiple hunks", () => {
      const multiHunkDiff: FileDiff = {
        path: "test.ts",
        hunks: [
          {
            header: "@@ -1,2 +1,2 @@",
            old_start: 1,
            old_lines: 2,
            new_start: 1,
            new_lines: 2,
            lines: [
              { content: "first hunk content", line_type: "context", old_lineno: 1, new_lineno: 1 },
            ],
          },
          {
            header: "@@ -10,2 +10,2 @@",
            old_start: 10,
            old_lines: 2,
            new_start: 10,
            new_lines: 2,
            lines: [
              {
                content: "second hunk content",
                line_type: "context",
                old_lineno: 10,
                new_lineno: 10,
              },
            ],
          },
        ],
        is_binary: false,
      };

      const { container } = render(<CommitFileDiff diff={multiHunkDiff} />);

      const hunks = container.querySelectorAll(".diff-hunk");
      expect(hunks.length).toBe(2);

      expect(screen.getByText("first hunk content")).toBeInTheDocument();
      expect(screen.getByText("second hunk content")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS class structure", () => {
      const sampleDiff: FileDiff = {
        path: "test.ts",
        hunks: [
          {
            header: "@@ -1,1 +1,1 @@",
            old_start: 1,
            old_lines: 1,
            new_start: 1,
            new_lines: 1,
            lines: [{ content: "test", line_type: "context", old_lineno: 1, new_lineno: 1 }],
          },
        ],
        is_binary: false,
      };

      const { container } = render(<CommitFileDiff diff={sampleDiff} />);

      expect(container.querySelector(".commit-file-diff")).toBeInTheDocument();
      expect(container.querySelector(".diff-hunk")).toBeInTheDocument();
      expect(container.querySelector(".hunk-lines")).toBeInTheDocument();
      expect(container.querySelector(".diff-line")).toBeInTheDocument();
      expect(container.querySelector(".line-number.old")).toBeInTheDocument();
      expect(container.querySelector(".line-number.new")).toBeInTheDocument();
      expect(container.querySelector(".line-prefix")).toBeInTheDocument();
      expect(container.querySelector(".line-content")).toBeInTheDocument();
    });
  });

  describe("revert actions with confirmation dialogs", () => {
    const revertableDiff: FileDiff = {
      path: "test.ts",
      hunks: [
        {
          header: "@@ -1,3 +1,4 @@",
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 4,
          lines: [
            { content: "const x = 1;", line_type: "context", old_lineno: 1, new_lineno: 1 },
            { content: "const y = 2;", line_type: "deletion", old_lineno: 2, new_lineno: null },
            { content: "const y = 3;", line_type: "addition", old_lineno: null, new_lineno: 2 },
            { content: "export { x };", line_type: "context", old_lineno: 3, new_lineno: 3 },
          ],
        },
      ],
      is_binary: false,
    };

    it("shows Revert hunk button when commitHash and filePath are provided", () => {
      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      expect(screen.getByText("Revert hunk")).toBeInTheDocument();
    });

    it("does not show Revert hunk button without commitHash", () => {
      render(<CommitFileDiff diff={revertableDiff} />);

      expect(screen.queryByText("Revert hunk")).not.toBeInTheDocument();
    });

    it("shows confirmation dialog when Revert hunk is clicked", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      fireEvent.click(screen.getByText("Revert hunk"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith({
          title: "Revert hunk?",
          message: "This will undo the changes in this hunk and stage the result.",
          confirmLabel: "Revert",
        });
      });
    });

    it("calls revertCommitFileLines with all changed line indices on hunk revert confirm", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      fireEvent.click(screen.getByText("Revert hunk"));

      await waitFor(() => {
        expect(mockRevertCommitFileLines).toHaveBeenCalledWith(
          "abc123",
          "test.ts",
          0,
          [1, 2] // indices of deletion and addition lines
        );
      });
    });

    it("does not call revertCommitFileLines when hunk revert dialog is cancelled", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      fireEvent.click(screen.getByText("Revert hunk"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
      expect(mockRevertCommitFileLines).not.toHaveBeenCalled();
    });

    it("shows line selection revert button after selecting a line", async () => {
      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      // Click a deletion line to select it
      const deletionLine = screen.getByText("const y = 2;").closest(".diff-line");
      fireEvent.mouseDown(deletionLine!);
      fireEvent.mouseUp(deletionLine!);

      expect(screen.getByText("Revert 1 line")).toBeInTheDocument();
    });

    it("shows confirmation dialog when reverting selected lines", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      // Select a line
      const deletionLine = screen.getByText("const y = 2;").closest(".diff-line");
      fireEvent.mouseDown(deletionLine!);
      fireEvent.mouseUp(deletionLine!);

      // Click the revert selected lines button
      fireEvent.click(screen.getByText("Revert 1 line"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith({
          title: "Revert 1 line?",
          message: "This will undo the selected changes and stage the result.",
          confirmLabel: "Revert",
        });
      });
    });

    it("shows plural wording when multiple lines selected", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      // Select both changed lines via shift-click
      const deletionLine = screen.getByText("const y = 2;").closest(".diff-line");
      fireEvent.mouseDown(deletionLine!);

      const additionLine = screen.getByText("const y = 3;").closest(".diff-line");
      fireEvent.mouseEnter(additionLine!);
      fireEvent.mouseUp(additionLine!);

      expect(screen.getByText("Revert 2 lines")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Revert 2 lines"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith({
          title: "Revert 2 lines?",
          message: "This will undo the selected changes and stage the result.",
          confirmLabel: "Revert",
        });
      });
    });

    it("clears selection when Clear button is clicked", () => {
      render(<CommitFileDiff diff={revertableDiff} commitHash="abc123" filePath="test.ts" />);

      // Select a line
      const deletionLine = screen.getByText("const y = 2;").closest(".diff-line");
      fireEvent.mouseDown(deletionLine!);
      fireEvent.mouseUp(deletionLine!);

      expect(screen.getByText("Clear")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Clear"));

      expect(screen.queryByText("Clear")).not.toBeInTheDocument();
      expect(screen.queryByText(/Revert \d+ line/)).not.toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiffHunk } from "./DiffHunk";
import type { DiffHunk as DiffHunkType } from "../../types";

describe("DiffHunk", () => {
  const mockOnAction = vi.fn();
  const mockOnStageLines = vi.fn();

  const sampleHunk: DiffHunkType = {
    header: "@@ -1,5 +1,6 @@",
    old_start: 1,
    old_lines: 5,
    new_start: 1,
    new_lines: 6,
    lines: [
      { content: "context line", line_type: "context", old_lineno: 1, new_lineno: 1 },
      { content: "deleted line", line_type: "deletion", old_lineno: 2, new_lineno: null },
      { content: "added line", line_type: "addition", old_lineno: null, new_lineno: 2 },
      { content: "another context", line_type: "context", old_lineno: 3, new_lineno: 3 },
    ],
  };

  const defaultProps = {
    hunk: sampleHunk,
    onAction: mockOnAction,
    onStageLines: mockOnStageLines,
    actionLabel: "Stage Hunk",
    canSelectLines: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all visible lines (excluding header)", () => {
      render(<DiffHunk {...defaultProps} />);

      expect(screen.getByText("context line")).toBeInTheDocument();
      expect(screen.getByText("deleted line")).toBeInTheDocument();
      expect(screen.getByText("added line")).toBeInTheDocument();
      expect(screen.getByText("another context")).toBeInTheDocument();
    });

    it("renders line numbers correctly", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const oldLineNumbers = container.querySelectorAll(".line-number.old");
      const newLineNumbers = container.querySelectorAll(".line-number.new");

      // First line: context (old: 1, new: 1)
      expect(oldLineNumbers[0]).toHaveTextContent("1");
      expect(newLineNumbers[0]).toHaveTextContent("1");

      // Second line: deletion (old: 2, new: empty)
      expect(oldLineNumbers[1]).toHaveTextContent("2");
      expect(newLineNumbers[1]).toHaveTextContent("");

      // Third line: addition (old: empty, new: 2)
      expect(oldLineNumbers[2]).toHaveTextContent("");
      expect(newLineNumbers[2]).toHaveTextContent("2");
    });

    it("renders correct line prefixes", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const prefixes = container.querySelectorAll(".line-prefix");

      // Context lines have a space prefix, deletions have -, additions have +
      expect(prefixes[0].textContent?.trim()).toBe(""); // context (space becomes empty when trimmed)
      expect(prefixes[1]).toHaveTextContent("-"); // deletion
      expect(prefixes[2]).toHaveTextContent("+"); // addition
      expect(prefixes[3].textContent?.trim()).toBe(""); // context
    });

    it("renders action button with correct label", () => {
      render(<DiffHunk {...defaultProps} />);

      expect(screen.getByText("Stage Hunk")).toBeInTheDocument();
    });

    it("applies correct CSS classes for line types", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      expect(container.querySelector(".line-context")).toBeInTheDocument();
      expect(container.querySelector(".line-deletion")).toBeInTheDocument();
      expect(container.querySelector(".line-addition")).toBeInTheDocument();
    });
  });

  describe("action button", () => {
    it("calls onAction when action button is clicked", () => {
      render(<DiffHunk {...defaultProps} />);

      fireEvent.click(screen.getByText("Stage Hunk"));

      expect(mockOnAction).toHaveBeenCalledTimes(1);
    });

    it("renders different action labels", () => {
      render(<DiffHunk {...defaultProps} actionLabel="Unstage Hunk" />);

      expect(screen.getByText("Unstage Hunk")).toBeInTheDocument();
    });
  });

  describe("line selection", () => {
    it("selects a line when clicked", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(additionLine).toHaveClass("selected");
    });

    it("does not select context lines", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const contextLine = container.querySelector(".line-context");
      fireEvent.mouseDown(contextLine!);

      expect(contextLine).not.toHaveClass("selected");
    });

    it("shows stage lines button when lines are selected", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(screen.getByText("Stage 1 line")).toBeInTheDocument();
    });

    it("shows correct plural form for multiple lines", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Select deletion line
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Shift-click addition line to select range
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!, { shiftKey: true });

      expect(screen.getByText("Stage 2 lines")).toBeInTheDocument();
    });

    it("calls onStageLines with selected line indices", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Select a line (addition is at index 2 in the original lines array)
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      // Click stage button
      fireEvent.click(screen.getByText("Stage 1 line"));

      expect(mockOnStageLines).toHaveBeenCalledWith([2]);
    });

    it("clears selection after staging", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(screen.getByText("Stage 1 line")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Stage 1 line"));

      expect(screen.queryByText("Stage 1 line")).not.toBeInTheDocument();
      expect(additionLine).not.toHaveClass("selected");
    });

    it("shows clear button when lines are selected", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("clears selection when clear button is clicked", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      fireEvent.click(screen.getByText("Clear"));

      expect(screen.queryByText("Stage 1 line")).not.toBeInTheDocument();
      expect(additionLine).not.toHaveClass("selected");
    });
  });

  describe("grouped selection border classes", () => {
    it("applies selected-first and selected-last on a single selected line", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(additionLine).toHaveClass("selected");
      expect(additionLine).toHaveClass("selected-first");
      expect(additionLine).toHaveClass("selected-last");
    });

    it("applies correct positional classes on consecutive selected lines", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Select deletion line first
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Shift-click addition to select range (deletion + addition are consecutive visible lines)
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!, { shiftKey: true });

      // Deletion is first in the group
      expect(deletionLine).toHaveClass("selected");
      expect(deletionLine).toHaveClass("selected-first");
      expect(deletionLine).not.toHaveClass("selected-last");

      // Addition is last in the group
      expect(additionLine).toHaveClass("selected");
      expect(additionLine).not.toHaveClass("selected-first");
      expect(additionLine).toHaveClass("selected-last");
    });

    it("does not apply outline classes on selected lines", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(additionLine).not.toHaveClass("outline");
      expect(additionLine).not.toHaveClass("outline-primary");
    });
  });

  describe("canSelectLines=false", () => {
    it("does not allow selection when canSelectLines is false", () => {
      const { container } = render(<DiffHunk {...defaultProps} canSelectLines={false} />);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(additionLine).not.toHaveClass("selected");
      expect(screen.queryByText("Stage 1 line")).not.toBeInTheDocument();
    });

    it("does not show selectable class when canSelectLines is false", () => {
      const { container } = render(<DiffHunk {...defaultProps} canSelectLines={false} />);

      const additionLine = container.querySelector(".line-addition");
      expect(additionLine).not.toHaveClass("selectable");
    });
  });

  describe("shift-click range selection", () => {
    it("selects range of lines with shift-click", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Click first selectable line
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Shift-click another selectable line
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!, { shiftKey: true });

      // Both should be selected
      expect(deletionLine).toHaveClass("selected");
      expect(additionLine).toHaveClass("selected");
    });

    it("excludes context lines from range selection", () => {
      const hunkWithContextInMiddle: DiffHunkType = {
        header: "@@ -1,4 +1,4 @@",
        old_start: 1,
        old_lines: 4,
        new_start: 1,
        new_lines: 4,
        lines: [
          { content: "delete1", line_type: "deletion", old_lineno: 1, new_lineno: null },
          { content: "context", line_type: "context", old_lineno: 2, new_lineno: 1 },
          { content: "add1", line_type: "addition", old_lineno: null, new_lineno: 2 },
        ],
      };

      const { container } = render(<DiffHunk {...defaultProps} hunk={hunkWithContextInMiddle} />);

      // Click deletion
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Shift-click addition
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!, { shiftKey: true });

      // Context line should NOT be selected
      const contextLine = container.querySelector(".line-context");
      expect(contextLine).not.toHaveClass("selected");

      // Should show 2 lines (deletion + addition, not context)
      expect(screen.getByText("Stage 2 lines")).toBeInTheDocument();
    });
  });

  describe("drag selection", () => {
    it("selects lines when dragging", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Start drag on deletion line
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Drag to addition line
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseEnter(additionLine!);

      // Both should be selected
      expect(deletionLine).toHaveClass("selected");
      expect(additionLine).toHaveClass("selected");
    });

    it("stops selection on mouse up", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Start drag
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Release
      const hunkDiv = container.querySelector(".diff-hunk");
      fireEvent.mouseUp(hunkDiv!);

      // Enter another line - should not add to selection
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseEnter(additionLine!);

      expect(additionLine).not.toHaveClass("selected");
    });

    it("stops selection on mouse leave", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Start drag
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      // Leave hunk area
      const hunkDiv = container.querySelector(".diff-hunk");
      fireEvent.mouseLeave(hunkDiv!);

      // Re-enter another line - should not add to selection
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseEnter(additionLine!);

      expect(additionLine).not.toHaveClass("selected");
    });
  });

  describe("discard buttons", () => {
    it("renders discard hunk button when onDiscardHunk is provided", () => {
      const mockDiscardHunk = vi.fn();
      render(<DiffHunk {...defaultProps} onDiscardHunk={mockDiscardHunk} />);

      expect(screen.getByText("Discard hunk")).toBeInTheDocument();
    });

    it("does not render discard hunk button when onDiscardHunk is not provided", () => {
      render(<DiffHunk {...defaultProps} />);

      expect(screen.queryByText("Discard hunk")).not.toBeInTheDocument();
    });

    it("calls onDiscardHunk when discard hunk button is clicked", () => {
      const mockDiscardHunk = vi.fn();
      render(<DiffHunk {...defaultProps} onDiscardHunk={mockDiscardHunk} />);

      fireEvent.click(screen.getByText("Discard hunk"));

      expect(mockDiscardHunk).toHaveBeenCalledTimes(1);
    });

    it("renders discard lines button when lines are selected and onDiscardLines is provided", () => {
      const mockDiscardLines = vi.fn();
      const { container } = render(
        <DiffHunk {...defaultProps} onDiscardLines={mockDiscardLines} />
      );

      // Select a line
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(screen.getByText("Discard 1 line")).toBeInTheDocument();
    });

    it("does not render discard lines button when onDiscardLines is not provided", () => {
      const { container } = render(<DiffHunk {...defaultProps} />);

      // Select a line
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(screen.queryByText("Discard 1 line")).not.toBeInTheDocument();
    });

    it("calls onDiscardLines with selected indices when discard lines button is clicked", () => {
      const mockDiscardLines = vi.fn();
      const { container } = render(
        <DiffHunk {...defaultProps} onDiscardLines={mockDiscardLines} />
      );

      // Select the addition line (index 2 in original lines)
      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      fireEvent.click(screen.getByText("Discard 1 line"));

      expect(mockDiscardLines).toHaveBeenCalledWith([2]);
    });

    it("clears selection after discarding lines", () => {
      const mockDiscardLines = vi.fn();
      const { container } = render(
        <DiffHunk {...defaultProps} onDiscardLines={mockDiscardLines} />
      );

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!);

      expect(screen.getByText("Discard 1 line")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Discard 1 line"));

      expect(screen.queryByText("Discard 1 line")).not.toBeInTheDocument();
      expect(additionLine).not.toHaveClass("selected");
    });

    it("shows plural form for multiple selected lines", () => {
      const mockDiscardLines = vi.fn();
      const { container } = render(
        <DiffHunk {...defaultProps} onDiscardLines={mockDiscardLines} />
      );

      // Select deletion then shift-click addition to get 2 lines
      const deletionLine = container.querySelector(".line-deletion");
      fireEvent.mouseDown(deletionLine!);

      const additionLine = container.querySelector(".line-addition");
      fireEvent.mouseDown(additionLine!, { shiftKey: true });

      expect(screen.getByText("Discard 2 lines")).toBeInTheDocument();
    });
  });

  describe("conflict line types", () => {
    const conflictHunk: DiffHunkType = {
      header: "@@ Conflict 1/1 @@",
      old_start: 0,
      old_lines: 0,
      new_start: 1,
      new_lines: 7,
      lines: [
        { content: "context line", line_type: "context", old_lineno: null, new_lineno: 1 },
        {
          content: "<<<<<<< HEAD",
          line_type: "conflict_marker",
          old_lineno: null,
          new_lineno: 2,
        },
        { content: "ours line", line_type: "conflict_ours", old_lineno: null, new_lineno: 3 },
        { content: "=======", line_type: "conflict_marker", old_lineno: null, new_lineno: 4 },
        {
          content: "theirs line",
          line_type: "conflict_theirs",
          old_lineno: null,
          new_lineno: 5,
        },
        {
          content: ">>>>>>> branch",
          line_type: "conflict_marker",
          old_lineno: null,
          new_lineno: 6,
        },
        { content: "after", line_type: "context", old_lineno: null, new_lineno: 7 },
      ],
    };

    it("renders conflict line types with correct CSS classes", () => {
      const { container } = render(<DiffHunk {...defaultProps} hunk={conflictHunk} />);

      expect(container.querySelector(".line-conflict_marker")).toBeInTheDocument();
      expect(container.querySelector(".line-conflict_ours")).toBeInTheDocument();
      expect(container.querySelector(".line-conflict_theirs")).toBeInTheDocument();
    });

    it("renders conflict marker lines with | prefix", () => {
      const { container } = render(<DiffHunk {...defaultProps} hunk={conflictHunk} />);

      const markerLines = container.querySelectorAll(".line-conflict_marker");
      for (const line of markerLines) {
        const prefix = line.querySelector(".line-prefix");
        expect(prefix).toHaveTextContent("|");
      }
    });

    it("does not allow selecting conflict lines", () => {
      const { container } = render(<DiffHunk {...defaultProps} hunk={conflictHunk} />);

      const oursLine = container.querySelector(".line-conflict_ours");
      fireEvent.mouseDown(oursLine!);

      expect(oursLine).not.toHaveClass("selected");
    });

    it("renders all conflict lines as visible", () => {
      const { container } = render(<DiffHunk {...defaultProps} hunk={conflictHunk} />);

      const allLines = container.querySelectorAll(".diff-line");
      // All 7 lines should be visible (none filtered)
      expect(allLines.length).toBe(7);
    });

    it("shows resolution buttons when onResolveConflict is provided", () => {
      const mockResolve = vi.fn();
      render(<DiffHunk {...defaultProps} hunk={conflictHunk} onResolveConflict={mockResolve} />);

      expect(screen.getByText("Accept Ours")).toBeInTheDocument();
      expect(screen.getByText("Accept Theirs")).toBeInTheDocument();
      expect(screen.getByText("Both")).toBeInTheDocument();
      // Normal action button should not be shown
      expect(screen.queryByText("Stage hunk")).not.toBeInTheDocument();
    });

    it("calls onResolveConflict with correct strategy", () => {
      const mockResolve = vi.fn();
      render(<DiffHunk {...defaultProps} hunk={conflictHunk} onResolveConflict={mockResolve} />);

      fireEvent.click(screen.getByText("Accept Ours"));
      expect(mockResolve).toHaveBeenCalledWith("ours");

      fireEvent.click(screen.getByText("Accept Theirs"));
      expect(mockResolve).toHaveBeenCalledWith("theirs");

      fireEvent.click(screen.getByText("Both"));
      expect(mockResolve).toHaveBeenCalledWith("both");
    });
  });

  describe("header lines", () => {
    it("filters out header lines from display", () => {
      const hunkWithHeader: DiffHunkType = {
        header: "@@ -1,2 +1,2 @@",
        old_start: 1,
        old_lines: 2,
        new_start: 1,
        new_lines: 2,
        lines: [
          { content: "@@ -1,2 +1,2 @@", line_type: "header", old_lineno: null, new_lineno: null },
          { content: "context", line_type: "context", old_lineno: 1, new_lineno: 1 },
        ],
      };

      const { container } = render(<DiffHunk {...defaultProps} hunk={hunkWithHeader} />);

      // Header content should not be rendered as a diff-line
      const lines = container.querySelectorAll(".diff-line");
      expect(lines.length).toBe(1); // Only context line

      // Header info is shown in the static hunk-info element, not as a diff-line
      const hunkInfo = container.querySelector(".hunk-info");
      expect(hunkInfo).toBeInTheDocument();
      expect(hunkInfo?.textContent).toContain("@@ -1,2 +1,2 @@");
    });
  });
});

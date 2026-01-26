import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitFileDiff } from "./CommitFileDiff";
import type { FileDiff } from "../../types";

describe("CommitFileDiff", () => {
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
});

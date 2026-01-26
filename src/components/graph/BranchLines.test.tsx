import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BranchLines } from "./BranchLines";
import type { GraphCommit } from "../../types";

describe("BranchLines", () => {
  const createMockCommit = (overrides: Partial<GraphCommit> = {}): GraphCommit => ({
    hash: "abc123",
    short_hash: "abc123",
    message: "Test commit",
    author_name: "Test",
    author_email: "test@test.com",
    timestamp: 1234567890,
    parent_hashes: [],
    column: 0,
    lines: [],
    refs: [],
    is_tip: false,
    ...overrides,
  });

  describe("SVG rendering", () => {
    it("renders an SVG element", () => {
      const commit = createMockCommit();

      const { container } = render(<BranchLines commit={commit} />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("has correct CSS class", () => {
      const commit = createMockCommit();

      const { container } = render(<BranchLines commit={commit} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("branch-lines-svg");
    });

    it("has correct height", () => {
      const commit = createMockCommit();

      const { container } = render(<BranchLines commit={commit} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("height", "28");
    });

    it("has 100% width", () => {
      const commit = createMockCommit();

      const { container } = render(<BranchLines commit={commit} />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "100%");
    });
  });

  describe("commit node (circle)", () => {
    it("renders circle for branch tips", () => {
      const commit = createMockCommit({ is_tip: true });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      expect(circle).toBeInTheDocument();
    });

    it("does not render circle for non-tip commits", () => {
      const commit = createMockCommit({ is_tip: false });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      expect(circle).not.toBeInTheDocument();
    });

    it("positions circle based on column", () => {
      const commit = createMockCommit({ is_tip: true, column: 2 });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      // Column width is 12, node X = 12 + column * 12 = 12 + 2*12 = 36
      expect(circle).toHaveAttribute("cx", "36");
    });

    it("centers circle vertically at height/2", () => {
      const commit = createMockCommit({ is_tip: true });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      // Height is 28, so cy = 14
      expect(circle).toHaveAttribute("cy", "14");
    });

    it("has correct radius", () => {
      const commit = createMockCommit({ is_tip: true });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      expect(circle).toHaveAttribute("r", "4");
    });
  });

  describe("line types", () => {
    it("renders pass_through line as vertical line", () => {
      const commit = createMockCommit({
        lines: [{ from_column: 1, to_column: 1, is_merge: false, line_type: "pass_through" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const lines = container.querySelectorAll("line");
      expect(lines.length).toBe(1);

      const line = lines[0];
      // Column 1: x = 12 + 1*12 = 24
      expect(line).toHaveAttribute("x1", "24");
      expect(line).toHaveAttribute("x2", "24");
      expect(line).toHaveAttribute("y1", "0");
      expect(line).toHaveAttribute("y2", "28");
    });

    it("renders from_above line from top to center", () => {
      const commit = createMockCommit({
        column: 0,
        lines: [{ from_column: 0, to_column: 0, is_merge: false, line_type: "from_above" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const lines = container.querySelectorAll("line");
      expect(lines.length).toBe(1);

      const line = lines[0];
      // Column 0: x = 12 + 0*12 = 12
      expect(line).toHaveAttribute("x1", "12");
      expect(line).toHaveAttribute("x2", "12");
      expect(line).toHaveAttribute("y1", "0");
      expect(line).toHaveAttribute("y2", "14"); // nodeY = height/2 = 14
    });

    it("renders merge line as curved path", () => {
      const commit = createMockCommit({
        column: 0,
        lines: [{ from_column: 0, to_column: 1, is_merge: true, line_type: "to_parent" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(1);

      const path = paths[0];
      expect(path).toHaveAttribute("fill", "none");
      // Should have quadratic bezier curve
      expect(path.getAttribute("d")).toContain("Q");
    });

    it("renders normal continuation line from node down", () => {
      const commit = createMockCommit({
        column: 0,
        lines: [{ from_column: 0, to_column: 0, is_merge: false, line_type: "to_parent" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const lines = container.querySelectorAll("line");
      expect(lines.length).toBe(1);

      const line = lines[0];
      expect(line).toHaveAttribute("y1", "14"); // nodeY
      expect(line).toHaveAttribute("y2", "28"); // height
    });
  });

  describe("colors", () => {
    it("assigns color based on column index", () => {
      const commit = createMockCommit({
        is_tip: true,
        column: 0,
        lines: [{ from_column: 0, to_column: 0, is_merge: false, line_type: "pass_through" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      // Should use first branch color variable
      expect(circle?.getAttribute("fill")).toContain("var(--branch-color-1)");
    });

    it("cycles through colors for different columns", () => {
      const commit = createMockCommit({
        is_tip: true,
        column: 8, // Should wrap around (8 colors defined)
      });

      const { container } = render(<BranchLines commit={commit} />);

      const circle = container.querySelector("circle");
      // Column 8 % 8 = 0, so should use branch-color-1
      expect(circle?.getAttribute("fill")).toContain("var(--branch-color-1)");
    });

    it("uses consistent color for line stroke", () => {
      const commit = createMockCommit({
        column: 2,
        lines: [{ from_column: 2, to_column: 2, is_merge: false, line_type: "pass_through" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const line = container.querySelector("line");
      // Column 2 uses branch-color-3
      expect(line?.getAttribute("stroke")).toContain("var(--branch-color-3)");
    });
  });

  describe("multiple lines", () => {
    it("renders multiple lines for complex graph", () => {
      const commit = createMockCommit({
        column: 0,
        lines: [
          { from_column: 0, to_column: 0, is_merge: false, line_type: "from_above" },
          { from_column: 1, to_column: 1, is_merge: false, line_type: "pass_through" },
          { from_column: 0, to_column: 1, is_merge: true, line_type: "to_parent" },
        ],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const lines = container.querySelectorAll("line");
      const paths = container.querySelectorAll("path");

      expect(lines.length).toBe(2); // from_above and pass_through
      expect(paths.length).toBe(1); // merge
    });
  });

  describe("line properties", () => {
    it("sets stroke width to 2", () => {
      const commit = createMockCommit({
        lines: [{ from_column: 0, to_column: 0, is_merge: false, line_type: "pass_through" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const line = container.querySelector("line");
      expect(line).toHaveAttribute("stroke-width", "2");
    });

    it("sets stroke width to 2 for paths", () => {
      const commit = createMockCommit({
        column: 0,
        lines: [{ from_column: 0, to_column: 1, is_merge: true, line_type: "to_parent" }],
      });

      const { container } = render(<BranchLines commit={commit} />);

      const path = container.querySelector("path");
      expect(path).toHaveAttribute("stroke-width", "2");
    });
  });
});

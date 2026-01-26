import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ColumnResizer } from "./ColumnResizer";

describe("ColumnResizer", () => {
  const mockOnResize = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
    // Reset body styles
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  describe("rendering", () => {
    it("renders a div element", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      expect(container.querySelector("div")).toBeInTheDocument();
    });

    it("has column-resizer CSS class", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      expect(container.querySelector(".column-resizer")).toBeInTheDocument();
    });

    it("applies position as left style", () => {
      const { container } = render(<ColumnResizer position={150} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");
      expect(resizer).toHaveStyle({ left: "150px" });
    });

    it("updates position when prop changes", () => {
      const { container, rerender } = render(
        <ColumnResizer position={100} onResize={mockOnResize} />
      );

      rerender(<ColumnResizer position={200} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");
      expect(resizer).toHaveStyle({ left: "200px" });
    });
  });

  describe("drag behavior", () => {
    it("sets col-resize cursor on mousedown", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");
      fireEvent.mouseDown(resizer!, { clientX: 100 });

      expect(document.body.style.cursor).toBe("col-resize");
    });

    it("disables user select on mousedown", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");
      fireEvent.mouseDown(resizer!, { clientX: 100 });

      expect(document.body.style.userSelect).toBe("none");
    });

    it("calls onResize with delta during mousemove", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      // Start drag at x=100
      fireEvent.mouseDown(resizer!, { clientX: 100 });

      // Move to x=120 (delta = 20)
      fireEvent.mouseMove(document, { clientX: 120 });

      expect(mockOnResize).toHaveBeenCalledWith(20);
    });

    it("calls onResize with cumulative delta for multiple moves", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      // Start drag at x=100
      fireEvent.mouseDown(resizer!, { clientX: 100 });

      // First move: 100 -> 120 (delta = 20)
      fireEvent.mouseMove(document, { clientX: 120 });
      expect(mockOnResize).toHaveBeenCalledWith(20);

      // Second move: 120 -> 130 (delta = 10)
      fireEvent.mouseMove(document, { clientX: 130 });
      expect(mockOnResize).toHaveBeenCalledWith(10);
    });

    it("handles negative deltas (moving left)", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      // Start drag at x=100
      fireEvent.mouseDown(resizer!, { clientX: 100 });

      // Move to x=80 (delta = -20)
      fireEvent.mouseMove(document, { clientX: 80 });

      expect(mockOnResize).toHaveBeenCalledWith(-20);
    });

    it("resets cursor on mouseup", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      fireEvent.mouseDown(resizer!, { clientX: 100 });
      expect(document.body.style.cursor).toBe("col-resize");

      fireEvent.mouseUp(document);
      expect(document.body.style.cursor).toBe("");
    });

    it("resets user select on mouseup", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      fireEvent.mouseDown(resizer!, { clientX: 100 });
      expect(document.body.style.userSelect).toBe("none");

      fireEvent.mouseUp(document);
      expect(document.body.style.userSelect).toBe("");
    });

    it("stops calling onResize after mouseup", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      // Start drag
      fireEvent.mouseDown(resizer!, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 120 });
      expect(mockOnResize).toHaveBeenCalledTimes(1);

      // End drag
      fireEvent.mouseUp(document);
      mockOnResize.mockClear();

      // Move again - should not call onResize
      fireEvent.mouseMove(document, { clientX: 150 });
      expect(mockOnResize).not.toHaveBeenCalled();
    });

    it("prevents default on mousedown", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");
      const event = new MouseEvent("mousedown", {
        clientX: 100,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      resizer!.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("multiple drag sessions", () => {
    it("handles multiple drag sessions independently", () => {
      const { container } = render(<ColumnResizer position={100} onResize={mockOnResize} />);

      const resizer = container.querySelector(".column-resizer");

      // First session
      fireEvent.mouseDown(resizer!, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 120 });
      fireEvent.mouseUp(document);

      expect(mockOnResize).toHaveBeenLastCalledWith(20);
      mockOnResize.mockClear();

      // Second session - should start fresh
      fireEvent.mouseDown(resizer!, { clientX: 200 });
      fireEvent.mouseMove(document, { clientX: 250 });

      expect(mockOnResize).toHaveBeenCalledWith(50);
    });
  });
});

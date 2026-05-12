import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ColumnResizer } from "./ColumnResizer";

function setupPointerCapture() {
  // jsdom doesn't implement pointer capture; stub it on every Element
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
}

describe("ColumnResizer", () => {
  const mockOnResize = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders a separator with aria attributes", () => {
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="Resize col" />
      );
      const el = container.querySelector('[role="separator"]');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute("aria-orientation", "vertical");
      expect(el).toHaveAttribute("aria-label", "Resize col");
    });

    it("applies position as left style", () => {
      const { container } = render(
        <ColumnResizer position={150} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer");
      expect(resizer).toHaveStyle({ left: "150px" });
    });

    it("is focusable via tabIndex", () => {
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      expect(container.querySelector(".column-resizer")).toHaveAttribute("tabindex", "0");
    });
  });

  describe("keyboard", () => {
    it("ArrowRight calls onResize with positive step", () => {
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" step={8} />
      );
      const resizer = container.querySelector(".column-resizer")!;
      fireEvent.keyDown(resizer, { key: "ArrowRight" });
      expect(mockOnResize).toHaveBeenCalledWith(8);
    });

    it("ArrowLeft calls onResize with negative step", () => {
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" step={8} />
      );
      const resizer = container.querySelector(".column-resizer")!;
      fireEvent.keyDown(resizer, { key: "ArrowLeft" });
      expect(mockOnResize).toHaveBeenCalledWith(-8);
    });

    it("Shift+ArrowRight uses largeStep", () => {
      const { container } = render(
        <ColumnResizer
          position={100}
          onResize={mockOnResize}
          ariaLabel="x"
          step={8}
          largeStep={32}
        />
      );
      const resizer = container.querySelector(".column-resizer")!;
      fireEvent.keyDown(resizer, { key: "ArrowRight", shiftKey: true });
      expect(mockOnResize).toHaveBeenCalledWith(32);
    });

    it("ignores unrelated keys", () => {
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer")!;
      fireEvent.keyDown(resizer, { key: "Enter" });
      expect(mockOnResize).not.toHaveBeenCalled();
    });
  });

  describe("pointer drag", () => {
    it("calls onResize with delta on pointermove after pointerdown", async () => {
      setupPointerCapture();
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer")! as HTMLElement;

      fireEvent.pointerDown(resizer, { clientX: 100, pointerId: 1 });

      // Dispatch native pointermove on the element (listener attached there)
      const move = new Event("pointermove");
      Object.assign(move, { clientX: 120 });
      resizer.dispatchEvent(move);

      // Wait for rAF to flush
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      expect(mockOnResize).toHaveBeenCalledWith(20);
    });

    it("calls setPointerCapture on pointerdown", () => {
      setupPointerCapture();
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer")! as HTMLElement;
      fireEvent.pointerDown(resizer, { clientX: 100, pointerId: 7 });
      expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(7);
    });

    it("pointerup flushes pending delta and cancels rAF", () => {
      setupPointerCapture();
      const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
      const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");

      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer")! as HTMLElement;

      fireEvent.pointerDown(resizer, { clientX: 100, pointerId: 1 });

      const move = new Event("pointermove");
      Object.assign(move, { clientX: 115 });
      resizer.dispatchEvent(move);

      // Don't flush rAF — fire pointerup while rAF is still scheduled
      const up = new Event("pointerup");
      resizer.dispatchEvent(up);

      expect(cancelSpy).toHaveBeenCalled();
      expect(mockOnResize).toHaveBeenCalledWith(15);

      rafSpy.mockRestore();
      cancelSpy.mockRestore();
    });

    it("pointercancel flushes pending delta", () => {
      setupPointerCapture();
      const { container } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer")! as HTMLElement;

      fireEvent.pointerDown(resizer, { clientX: 50, pointerId: 2 });

      const move = new Event("pointermove");
      Object.assign(move, { clientX: 75 });
      resizer.dispatchEvent(move);

      const cancel = new Event("pointercancel");
      resizer.dispatchEvent(cancel);

      expect(mockOnResize).toHaveBeenCalledWith(25);
    });

    it("pointerdown with no ref no-ops (defensive early return)", () => {
      const { container, unmount } = render(
        <ColumnResizer position={100} onResize={mockOnResize} ariaLabel="x" />
      );
      const resizer = container.querySelector(".column-resizer")! as HTMLElement;
      unmount();
      // After unmount, ref should be null — firing pointerDown should not crash
      expect(() => fireEvent.pointerDown(resizer, { clientX: 0, pointerId: 9 })).not.toThrow();
    });
  });
});

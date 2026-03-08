import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { KeyboardListVirtualized, useVirtualizedFocus } from "./KeyboardListVirtualized";
import type { ListImperativeAPI } from "react-window";

const mockScrollToRow = vi.fn();

function TestWrapper({
  itemCount = 5,
  onActivate = vi.fn(),
  onSecondaryActivate = vi.fn(),
  onDelete,
}: {
  itemCount?: number;
  onActivate?: (i: number) => void;
  onSecondaryActivate?: (i: number) => void;
  onDelete?: (i: number) => void;
}) {
  const listRef = useRef<ListImperativeAPI | null>({
    scrollToRow: mockScrollToRow,
  } as unknown as ListImperativeAPI);

  return (
    <KeyboardListVirtualized
      aria-label="Test virtualized list"
      itemCount={itemCount}
      listRef={listRef}
      onActivate={onActivate}
      onSecondaryActivate={onSecondaryActivate}
      onDelete={onDelete}
    >
      <FocusReader />
    </KeyboardListVirtualized>
  );
}

function FocusReader() {
  const { focusedIndex } = useVirtualizedFocus();
  return <span data-testid="focused-index">{focusedIndex}</span>;
}

describe("KeyboardListVirtualized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with role=listbox and aria-label", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox", { name: "Test virtualized list" });
    expect(listbox).toBeInTheDocument();
  });

  it("has tabIndex=0 for keyboard focus", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("tabindex", "0");
  });

  it("sets focusedIndex to 0 on focus when no item is focused", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");

    expect(screen.getByTestId("focused-index").textContent).toBe("-1");

    fireEvent.focus(listbox);

    expect(screen.getByTestId("focused-index").textContent).toBe("0");
  });

  it("ArrowDown increments focusedIndex and scrolls", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(screen.getByTestId("focused-index").textContent).toBe("1");
    expect(mockScrollToRow).toHaveBeenCalledWith({ index: 1, align: "center" });
  });

  it("ArrowUp decrements focusedIndex", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    expect(screen.getByTestId("focused-index").textContent).toBe("1");
  });

  it("ArrowDown wraps from last to first", () => {
    render(<TestWrapper itemCount={3} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" }); // 1
    fireEvent.keyDown(listbox, { key: "ArrowDown" }); // 2
    fireEvent.keyDown(listbox, { key: "ArrowDown" }); // 0

    expect(screen.getByTestId("focused-index").textContent).toBe("0");
  });

  it("ArrowUp wraps from first to last", () => {
    render(<TestWrapper itemCount={3} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    expect(screen.getByTestId("focused-index").textContent).toBe("2");
  });

  it("Home jumps to first item", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Home" });

    expect(screen.getByTestId("focused-index").textContent).toBe("0");
  });

  it("End jumps to last item", () => {
    render(<TestWrapper itemCount={5} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "End" });

    expect(screen.getByTestId("focused-index").textContent).toBe("4");
  });

  it("Enter calls onActivate with focused index", () => {
    const onActivate = vi.fn();
    render(<TestWrapper onActivate={onActivate} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(onActivate).toHaveBeenCalledWith(1);
  });

  it("Space calls onSecondaryActivate with focused index", () => {
    const onSecondaryActivate = vi.fn();
    render(<TestWrapper onSecondaryActivate={onSecondaryActivate} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: " " });

    expect(onSecondaryActivate).toHaveBeenCalledWith(1);
  });

  it("navigation keys call preventDefault", () => {
    const onDelete = vi.fn();
    render(<TestWrapper onDelete={onDelete} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);

    for (const key of [
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
      "Enter",
      " ",
      "Delete",
      "Backspace",
    ]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      listbox.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    }
  });

  it("Delete calls onDelete with focused index", () => {
    const onDelete = vi.fn();
    render(<TestWrapper onDelete={onDelete} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Delete" });

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("Backspace calls onDelete with focused index", () => {
    const onDelete = vi.fn();
    render(<TestWrapper onDelete={onDelete} />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Backspace" });

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("Delete does not call onDelete when focusedIndex is -1", () => {
    const onDelete = vi.fn();
    render(<TestWrapper onDelete={onDelete} />);
    const listbox = screen.getByRole("listbox");

    // Don't focus first, so focusedIndex stays -1
    fireEvent.keyDown(listbox, { key: "Delete" });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("Delete does nothing when onDelete not provided", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");

    fireEvent.focus(listbox);
    // Should not throw
    fireEvent.keyDown(listbox, { key: "Delete" });
    fireEvent.keyDown(listbox, { key: "Backspace" });
  });

  it("adds aria-keyshortcuts=Delete when onDelete provided", () => {
    const onDelete = vi.fn();
    render(<TestWrapper onDelete={onDelete} />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-keyshortcuts", "Delete");
  });

  it("no aria-keyshortcuts when onDelete not provided", () => {
    render(<TestWrapper />);
    const listbox = screen.getByRole("listbox");
    expect(listbox).not.toHaveAttribute("aria-keyshortcuts");
  });
});

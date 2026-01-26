import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextMenu } from "./ContextMenu";

describe("ContextMenu", () => {
  const mockOnClose = vi.fn();
  const mockItemClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultItems = [
    { label: "Item 1", onClick: mockItemClick },
    { label: "Item 2", onClick: mockItemClick },
  ];

  function renderContextMenu(props: Partial<Parameters<typeof ContextMenu>[0]> = {}) {
    return render(
      <ContextMenu x={100} y={200} items={defaultItems} onClose={mockOnClose} {...props} />
    );
  }

  it("renders menu items", () => {
    renderContextMenu();

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("positions menu at specified coordinates", () => {
    renderContextMenu({ x: 150, y: 250 });

    const menu = screen.getByText("Item 1").closest(".context-menu");
    expect(menu).toHaveStyle({ left: "150px", top: "250px" });
  });

  it("calls item onClick when item is clicked", () => {
    const itemHandler = vi.fn();
    renderContextMenu({
      items: [{ label: "Test Item", onClick: itemHandler }],
    });

    fireEvent.click(screen.getByText("Test Item"));

    expect(itemHandler).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when item is clicked", () => {
    renderContextMenu();

    fireEvent.click(screen.getByText("Item 1"));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside the menu", () => {
    renderContextMenu();

    // Simulate click outside by triggering mousedown on document
    fireEvent.mouseDown(document.body);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    renderContextMenu();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick for disabled items", () => {
    const itemHandler = vi.fn();
    renderContextMenu({
      items: [{ label: "Disabled Item", onClick: itemHandler, disabled: true }],
    });

    fireEvent.click(screen.getByText("Disabled Item"));

    expect(itemHandler).not.toHaveBeenCalled();
  });

  it("applies disabled class to disabled items", () => {
    renderContextMenu({
      items: [{ label: "Disabled Item", onClick: mockItemClick, disabled: true }],
    });

    const item = screen.getByText("Disabled Item");
    expect(item).toHaveClass("disabled");
  });

  it("does not call onClose for disabled items", () => {
    renderContextMenu({
      items: [{ label: "Disabled Item", onClick: mockItemClick, disabled: true }],
    });

    fireEvent.click(screen.getByText("Disabled Item"));

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("renders menu inside portal", () => {
    renderContextMenu();

    const menu = screen.getByText("Item 1").closest(".context-menu");
    // Portal renders directly in document.body
    expect(menu?.parentElement).toBe(document.body);
  });

  it("does not close when clicking inside the menu (on non-item)", () => {
    renderContextMenu();

    const menu = screen.getByText("Item 1").closest(".context-menu");
    fireEvent.mouseDown(menu!);

    // Should not have been called because click was inside menu
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it("renders multiple items correctly", () => {
    renderContextMenu({
      items: [
        { label: "Action 1", onClick: vi.fn() },
        { label: "Action 2", onClick: vi.fn() },
        { label: "Action 3", onClick: vi.fn() },
      ],
    });

    expect(screen.getByText("Action 1")).toBeInTheDocument();
    expect(screen.getByText("Action 2")).toBeInTheDocument();
    expect(screen.getByText("Action 3")).toBeInTheDocument();
  });

  it("cleans up event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderContextMenu();
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});

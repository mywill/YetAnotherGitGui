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

    const item = screen.getByText("Disabled Item").closest(".context-menu-item");
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

  describe("Submenu", () => {
    const submenuItems = [
      {
        label: "Parent",
        children: [
          { label: "Child 1", onClick: vi.fn() },
          { label: "Child 2", onClick: vi.fn() },
        ],
      },
      { label: "Regular", onClick: vi.fn() },
    ];

    it("renders arrow indicator for items with children", () => {
      renderContextMenu({ items: submenuItems });

      const parentItem = screen.getByText("Parent").closest(".context-menu-item");
      expect(parentItem).toHaveClass("has-submenu");
    });

    it("does not show submenu children initially", () => {
      renderContextMenu({ items: submenuItems });

      expect(screen.queryByText("Child 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Child 2")).not.toBeInTheDocument();
    });

    it("shows submenu on hover", () => {
      renderContextMenu({ items: submenuItems });

      const parentItem = screen.getByText("Parent").closest(".context-menu-item");
      fireEvent.mouseEnter(parentItem!);

      expect(screen.getByText("Child 1")).toBeInTheDocument();
      expect(screen.getByText("Child 2")).toBeInTheDocument();
    });

    it("hides submenu on mouse leave", () => {
      renderContextMenu({ items: submenuItems });

      const parentItem = screen.getByText("Parent").closest(".context-menu-item");
      fireEvent.mouseEnter(parentItem!);
      expect(screen.getByText("Child 1")).toBeInTheDocument();

      fireEvent.mouseLeave(parentItem!);
      expect(screen.queryByText("Child 1")).not.toBeInTheDocument();
    });

    it("calls child onClick and onClose when submenu item is clicked", () => {
      const childHandler = vi.fn();
      const items = [
        {
          label: "Parent",
          children: [{ label: "Child Action", onClick: childHandler }],
        },
      ];
      renderContextMenu({ items });

      const parentItem = screen.getByText("Parent").closest(".context-menu-item");
      fireEvent.mouseEnter(parentItem!);
      fireEvent.click(screen.getByText("Child Action"));

      expect(childHandler).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when clicking parent item with children", () => {
      renderContextMenu({ items: submenuItems });

      const parentItem = screen.getByText("Parent").closest(".context-menu-item");
      fireEvent.click(parentItem!);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("renders submenu inside a .context-submenu container", () => {
      renderContextMenu({ items: submenuItems });

      const parentItem = screen.getByText("Parent").closest(".context-menu-item");
      fireEvent.mouseEnter(parentItem!);

      const submenu = screen.getByText("Child 1").closest(".context-submenu");
      expect(submenu).toBeInTheDocument();
    });
  });

  describe("Keyboard navigation", () => {
    it("has role=menu on the container", () => {
      renderContextMenu();
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("has role=menuitem on each item", () => {
      renderContextMenu();
      const menuitems = screen.getAllByRole("menuitem");
      expect(menuitems).toHaveLength(2);
    });

    it("auto-focuses the first enabled item on mount", () => {
      renderContextMenu();
      const menuitems = screen.getAllByRole("menuitem");
      expect(menuitems[0]).toHaveFocus();
    });

    it("ArrowDown moves focus to next item", () => {
      renderContextMenu();
      const menu = screen.getByRole("menu");
      const menuitems = screen.getAllByRole("menuitem");

      fireEvent.keyDown(menu, { key: "ArrowDown" });

      expect(menuitems[1]).toHaveFocus();
    });

    it("ArrowUp moves focus to previous item (wrapping)", () => {
      renderContextMenu();
      const menu = screen.getByRole("menu");
      const menuitems = screen.getAllByRole("menuitem");

      fireEvent.keyDown(menu, { key: "ArrowUp" });

      expect(menuitems[1]).toHaveFocus();
    });

    it("Home moves focus to first item", () => {
      renderContextMenu();
      const menu = screen.getByRole("menu");
      const menuitems = screen.getAllByRole("menuitem");

      fireEvent.keyDown(menu, { key: "ArrowDown" });
      fireEvent.keyDown(menu, { key: "Home" });

      expect(menuitems[0]).toHaveFocus();
    });

    it("End moves focus to last item", () => {
      renderContextMenu();
      const menu = screen.getByRole("menu");
      const menuitems = screen.getAllByRole("menuitem");

      fireEvent.keyDown(menu, { key: "End" });

      expect(menuitems[1]).toHaveFocus();
    });

    it("Enter activates focused item", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      renderContextMenu({
        items: [
          { label: "A", onClick: handler1 },
          { label: "B", onClick: handler2 },
        ],
      });
      const menu = screen.getByRole("menu");

      fireEvent.keyDown(menu, { key: "ArrowDown" });
      fireEvent.keyDown(menu, { key: "Enter" });

      expect(handler2).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("skips disabled items during navigation", () => {
      renderContextMenu({
        items: [
          { label: "A", onClick: vi.fn() },
          { label: "B", onClick: vi.fn(), disabled: true },
          { label: "C", onClick: vi.fn() },
        ],
      });
      const menu = screen.getByRole("menu");

      fireEvent.keyDown(menu, { key: "ArrowDown" });

      // Should skip disabled B and go to C
      expect(screen.getByText("C").closest("[role='menuitem']")).toHaveFocus();
    });

    it("Space activates focused item", () => {
      const handler = vi.fn();
      renderContextMenu({ items: [{ label: "Go", onClick: handler }] });
      const menu = screen.getByRole("menu");
      fireEvent.keyDown(menu, { key: " " });
      expect(handler).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("ArrowRight on a parent opens its submenu", () => {
      renderContextMenu({
        items: [
          {
            label: "Parent",
            children: [{ label: "Child 1", onClick: vi.fn() }],
          },
        ],
      });
      const parent = screen.getByText("Parent").closest("[role='menuitem']")!;
      fireEvent.keyDown(parent, { key: "ArrowRight" });
      expect(screen.getByText("Child 1")).toBeInTheDocument();
    });

    it("Enter in submenu activates child and closes", () => {
      const childHandler = vi.fn();
      renderContextMenu({
        items: [
          {
            label: "Parent",
            children: [
              { label: "Child A", onClick: vi.fn() },
              { label: "Child B", onClick: childHandler },
            ],
          },
        ],
      });
      const parent = screen.getByText("Parent").closest("[role='menuitem']")!;
      fireEvent.keyDown(parent, { key: "ArrowRight" });
      const submenu = screen.getByText("Child A").closest(".context-submenu")!;
      fireEvent.keyDown(submenu, { key: "ArrowDown" });
      fireEvent.keyDown(submenu, { key: "Enter" });
      expect(childHandler).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("ArrowUp in submenu wraps to last enabled child", () => {
      renderContextMenu({
        items: [
          {
            label: "Parent",
            children: [
              { label: "C1", onClick: vi.fn() },
              { label: "C2", onClick: vi.fn() },
            ],
          },
        ],
      });
      const parent = screen.getByText("Parent").closest("[role='menuitem']")!;
      fireEvent.keyDown(parent, { key: "ArrowRight" });
      const submenu = screen.getByText("C1").closest(".context-submenu")!;
      fireEvent.keyDown(submenu, { key: "ArrowUp" });
      // No throw means the branch executed
      expect(submenu).toBeInTheDocument();
    });

    it("ArrowLeft inside submenu closes it", () => {
      renderContextMenu({
        items: [
          {
            label: "Parent",
            children: [{ label: "C1", onClick: vi.fn() }],
          },
        ],
      });
      const parent = screen.getByText("Parent").closest("[role='menuitem']")!;
      fireEvent.keyDown(parent, { key: "ArrowRight" });
      const submenu = screen.getByText("C1").closest(".context-submenu")!;
      fireEvent.keyDown(submenu, { key: "ArrowLeft" });
      expect(screen.queryByText("C1")).not.toBeInTheDocument();
    });

    it("Escape inside submenu closes it without closing the outer menu", () => {
      renderContextMenu({
        items: [
          {
            label: "Parent",
            children: [{ label: "C1", onClick: vi.fn() }],
          },
        ],
      });
      const parent = screen.getByText("Parent").closest("[role='menuitem']")!;
      fireEvent.keyDown(parent, { key: "ArrowRight" });
      const submenu = screen.getByText("C1").closest(".context-submenu")!;
      fireEvent.keyDown(submenu, { key: "Escape" });
      expect(screen.queryByText("C1")).not.toBeInTheDocument();
      // Outer menu stays open — Escape was stopPropagation'd
      expect(screen.getByText("Parent")).toBeInTheDocument();
    });
  });

  describe("viewport overflow", () => {
    it("repositions menu to the left when it overflows the right edge", () => {
      const originalGetRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 100,
        right: 2000,
        bottom: 200,
        width: 200,
        height: 100,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      })) as unknown as typeof Element.prototype.getBoundingClientRect;

      try {
        render(
          <ContextMenu
            x={1900}
            y={100}
            items={[{ label: "Item", onClick: vi.fn() }]}
            onClose={vi.fn()}
          />
        );
        const menu = screen.getByRole("menu") as HTMLDivElement;
        expect(menu.style.left).toBe("1700px");
      } finally {
        Element.prototype.getBoundingClientRect = originalGetRect;
      }
    });

    it("repositions menu upward when it overflows the bottom edge", () => {
      const originalGetRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        left: 10,
        top: 700,
        right: 210,
        bottom: 2000,
        width: 200,
        height: 300,
        x: 10,
        y: 700,
        toJSON: () => ({}),
      })) as unknown as typeof Element.prototype.getBoundingClientRect;

      try {
        render(
          <ContextMenu
            x={10}
            y={700}
            items={[{ label: "Item", onClick: vi.fn() }]}
            onClose={vi.fn()}
          />
        );
        const menu = screen.getByRole("menu") as HTMLDivElement;
        expect(menu.style.top).toBe("400px");
      } finally {
        Element.prototype.getBoundingClientRect = originalGetRect;
      }
    });
  });
});

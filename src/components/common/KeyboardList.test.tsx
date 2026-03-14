import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeyboardList } from "./KeyboardList";

describe("KeyboardList", () => {
  const mockActivate = vi.fn();
  const mockSecondaryActivate = vi.fn();
  const mockActiveChange = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderList(
    itemCount = 3,
    {
      onActiveChange,
      onDelete,
    }: { onActiveChange?: typeof mockActiveChange; onDelete?: typeof mockDelete } = {}
  ) {
    const items = Array.from({ length: itemCount }, (_, i) => `Item ${i}`);
    return render(
      <KeyboardList
        aria-label="Test list"
        onActivate={mockActivate}
        onSecondaryActivate={mockSecondaryActivate}
        onActiveChange={onActiveChange}
        onDelete={onDelete}
      >
        {items.map((label, i) => (
          <KeyboardList.Item key={i} index={i}>
            {label}
          </KeyboardList.Item>
        ))}
      </KeyboardList>
    );
  }

  it("renders with role=listbox and aria-label", () => {
    renderList();
    const listbox = screen.getByRole("listbox", { name: "Test list" });
    expect(listbox).toBeInTheDocument();
  });

  it("renders items with role=option", () => {
    renderList();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
  });

  it("listbox has tabIndex=0", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("tabindex", "0");
  });

  it("all items have tabIndex=-1", () => {
    renderList();
    const options = screen.getAllByRole("option");
    for (const option of options) {
      expect(option).toHaveAttribute("tabindex", "-1");
    }
  });

  it("listbox has aria-activedescendant pointing to active item", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");
    expect(listbox).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("each item has a unique id", () => {
    renderList();
    const options = screen.getAllByRole("option");
    const ids = options.map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toBeTruthy();
    }
  });

  it("focus stays on listbox wrapper, not delegated to items", () => {
    renderList();
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    expect(listbox).toHaveFocus();
  });

  it("ArrowDown updates aria-selected and aria-activedescendant", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(listbox).toHaveAttribute("aria-activedescendant", options[1].id);
  });

  it("ArrowUp updates aria-selected and aria-activedescendant", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(listbox).toHaveAttribute("aria-activedescendant", options[0].id);
  });

  it("ArrowDown wraps from last to first", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowUp wraps from first to last", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowUp" });

    expect(options[2]).toHaveAttribute("aria-selected", "true");
  });

  it("Home jumps to first item", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Home" });

    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("End jumps to last item", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "End" });

    expect(options[2]).toHaveAttribute("aria-selected", "true");
  });

  it("Enter calls onActivate with correct index", () => {
    renderList();
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(mockActivate).toHaveBeenCalledWith(1);
  });

  it("Space calls onSecondaryActivate with correct index", () => {
    renderList();
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: " " });

    expect(mockSecondaryActivate).toHaveBeenCalledWith(1);
  });

  it("navigation keys call preventDefault to stop scrolling", () => {
    renderList(3, { onDelete: mockDelete });
    const listbox = screen.getByRole("listbox");

    listbox.focus();

    const keys = ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Delete", "Backspace"];
    for (const key of keys) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      const spy = vi.spyOn(event, "preventDefault");
      listbox.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    }
  });

  it("Delete calls onDelete with correct index", () => {
    renderList(3, { onDelete: mockDelete });
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Delete" });

    expect(mockDelete).toHaveBeenCalledWith(1);
  });

  it("Backspace calls onDelete with correct index", () => {
    renderList(3, { onDelete: mockDelete });
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Backspace" });

    expect(mockDelete).toHaveBeenCalledWith(1);
  });

  it("Delete does nothing when onDelete not provided", () => {
    renderList();
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    // Should not throw
    fireEvent.keyDown(listbox, { key: "Delete" });
    fireEvent.keyDown(listbox, { key: "Backspace" });
  });

  it("adds aria-keyshortcuts=Delete when onDelete provided", () => {
    renderList(3, { onDelete: mockDelete });
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-keyshortcuts", "Delete");
  });

  it("no aria-keyshortcuts when onDelete not provided", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    expect(listbox).not.toHaveAttribute("aria-keyshortcuts");
  });

  it("clicking an item sets it active and returns focus to listbox", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    fireEvent.click(options[2]);

    expect(options[2]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(listbox).toHaveFocus();
  });

  it("clicking an item then using ArrowDown navigates from clicked position", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");

    fireEvent.click(options[2]);
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(options[0]).toHaveAttribute("aria-selected", "true");
  });

  it("items always have tabIndex=-1 even after navigation", () => {
    renderList();
    const listbox = screen.getByRole("listbox");

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    for (const option of options) {
      expect(option).toHaveAttribute("tabindex", "-1");
    }
  });

  it("calls scrollIntoView on active item during navigation", () => {
    renderList();
    const listbox = screen.getByRole("listbox");
    const options = screen.getAllByRole("option");
    const scrollSpy = vi.fn();
    options[1].scrollIntoView = scrollSpy;

    listbox.focus();
    fireEvent.keyDown(listbox, { key: "ArrowDown" });

    expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
  });

  describe("onActiveChange callback", () => {
    it("fires onActiveChange on ArrowDown", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      fireEvent.keyDown(listbox, { key: "ArrowDown" });

      expect(mockActiveChange).toHaveBeenCalledWith(1, false);
    });

    it("fires onActiveChange on ArrowDown with shift", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      fireEvent.keyDown(listbox, { key: "ArrowDown", shiftKey: true });

      expect(mockActiveChange).toHaveBeenCalledWith(1, true);
    });

    it("fires onActiveChange on ArrowUp", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      fireEvent.keyDown(listbox, { key: "ArrowUp" });

      expect(mockActiveChange).toHaveBeenCalledWith(2, false);
    });

    it("fires onActiveChange on ArrowUp with shift", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      fireEvent.keyDown(listbox, { key: "ArrowUp", shiftKey: true });

      expect(mockActiveChange).toHaveBeenCalledWith(2, true);
    });

    it("fires onActiveChange on Home", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      mockActiveChange.mockClear();
      fireEvent.keyDown(listbox, { key: "Home" });

      expect(mockActiveChange).toHaveBeenCalledWith(0, false);
    });

    it("fires onActiveChange on End", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      fireEvent.keyDown(listbox, { key: "End" });

      expect(mockActiveChange).toHaveBeenCalledWith(2, false);
    });

    it("click does not directly fire onActiveChange", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      // First focus the list so onFocus fires
      listbox.focus();
      mockActiveChange.mockClear();

      // Now click — should not fire onActiveChange (mouse clicks go through FileItem.onSelectWithModifiers)
      const options = screen.getAllByRole("option");
      fireEvent.click(options[2]);

      expect(mockActiveChange).not.toHaveBeenCalled();
    });

    it("does not fire onActiveChange when not provided", () => {
      renderList(3);
      const listbox = screen.getByRole("listbox");

      listbox.focus();
      // Should not throw
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
    });

    it("fires onActiveChange on focus", () => {
      renderList(3, { onActiveChange: mockActiveChange });
      const listbox = screen.getByRole("listbox");

      listbox.focus();

      expect(mockActiveChange).toHaveBeenCalledWith(0, false);
    });

    it("clamps activeIndex when items are removed", () => {
      const { rerender } = render(
        <KeyboardList
          aria-label="Test list"
          onActivate={mockActivate}
          onSecondaryActivate={mockSecondaryActivate}
          onActiveChange={mockActiveChange}
        >
          {[0, 1, 2].map((i) => (
            <KeyboardList.Item key={i} index={i}>
              Item {i}
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      );

      const listbox = screen.getByRole("listbox");
      listbox.focus();
      fireEvent.keyDown(listbox, { key: "End" }); // go to index 2

      // Re-render with only 2 items
      rerender(
        <KeyboardList
          aria-label="Test list"
          onActivate={mockActivate}
          onSecondaryActivate={mockSecondaryActivate}
          onActiveChange={mockActiveChange}
        >
          {[0, 1].map((i) => (
            <KeyboardList.Item key={i} index={i}>
              Item {i}
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      );

      const options = screen.getAllByRole("option");
      expect(options[1]).toHaveAttribute("aria-selected", "true");
    });

    it("fires onActiveChange when items shrink but activeIndex stays valid", () => {
      const { rerender } = render(
        <KeyboardList
          aria-label="Test list"
          onActivate={mockActivate}
          onSecondaryActivate={mockSecondaryActivate}
          onActiveChange={mockActiveChange}
        >
          {[0, 1, 2].map((i) => (
            <KeyboardList.Item key={i} index={i}>
              Item {i}
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      );

      const listbox = screen.getByRole("listbox");
      listbox.focus();
      mockActiveChange.mockClear();

      // Re-render with 2 items (removing item at index 0 shifts items)
      rerender(
        <KeyboardList
          aria-label="Test list"
          onActivate={mockActivate}
          onSecondaryActivate={mockSecondaryActivate}
          onActiveChange={mockActiveChange}
        >
          {[0, 1].map((i) => (
            <KeyboardList.Item key={i} index={i}>
              Item {i}
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      );

      expect(mockActiveChange).toHaveBeenCalledWith(0, false);
    });

    it("fires onActiveChange with clamped index when items are removed", () => {
      const { rerender } = render(
        <KeyboardList
          aria-label="Test list"
          onActivate={mockActivate}
          onSecondaryActivate={mockSecondaryActivate}
          onActiveChange={mockActiveChange}
        >
          {[0, 1, 2].map((i) => (
            <KeyboardList.Item key={i} index={i}>
              Item {i}
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      );

      const listbox = screen.getByRole("listbox");
      listbox.focus();
      fireEvent.keyDown(listbox, { key: "End" }); // go to index 2
      mockActiveChange.mockClear();

      // Re-render with only 2 items
      rerender(
        <KeyboardList
          aria-label="Test list"
          onActivate={mockActivate}
          onSecondaryActivate={mockSecondaryActivate}
          onActiveChange={mockActiveChange}
        >
          {[0, 1].map((i) => (
            <KeyboardList.Item key={i} index={i}>
              Item {i}
            </KeyboardList.Item>
          ))}
        </KeyboardList>
      );

      expect(mockActiveChange).toHaveBeenCalledWith(1, false);
    });
  });
});

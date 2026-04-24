import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YaggResizer } from "./YaggResizer";
import { useSettingsStore } from "../../stores/settingsStore";

// Mock the settings service (required by settingsStore)
vi.mock("../../services/settings", () => ({
  readSettings: vi.fn().mockResolvedValue({}),
  writeSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("YaggResizer", () => {
  const defaultProps = {
    orientation: "vertical" as const,
    size: 300,
    onSizeChange: vi.fn(),
    min: 200,
    max: 600,
    defaultSize: 300,
    ariaLabel: "Resize panel",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      layoutSizes: {},
      density: "compact",
      theme: "dark",
      inspectorVisible: true,
      loaded: true,
    });
  });

  describe("rendering", () => {
    it("renders with correct ARIA attributes", () => {
      render(<YaggResizer {...defaultProps} panelId="test-panel" />);
      const separator = screen.getByRole("separator");

      expect(separator).toBeInTheDocument();
      expect(separator).toHaveAttribute("aria-orientation", "vertical");
      expect(separator).toHaveAttribute("aria-valuenow", "300");
      expect(separator).toHaveAttribute("aria-valuemin", "200");
      expect(separator).toHaveAttribute("aria-valuemax", "600");
      expect(separator).toHaveAttribute("aria-label", "Resize panel");
      expect(separator).toHaveAttribute("aria-controls", "test-panel");
      expect(separator).toHaveAttribute("tabindex", "0");
    });

    it("renders vertical orientation with col-resize cursor", () => {
      render(<YaggResizer {...defaultProps} />);
      const separator = screen.getByRole("separator");
      expect(separator.className).toContain("cursor-col-resize");
    });

    it("renders horizontal orientation with row-resize cursor", () => {
      render(<YaggResizer {...defaultProps} orientation="horizontal" />);
      const separator = screen.getByRole("separator");
      expect(separator.className).toContain("cursor-row-resize");
    });

    it("sets aria-valuemin to 0 when collapsible", () => {
      render(<YaggResizer {...defaultProps} collapsible />);
      const separator = screen.getByRole("separator");
      expect(separator).toHaveAttribute("aria-valuemin", "0");
    });
  });

  describe("keyboard interaction", () => {
    it("grows size with ArrowRight for vertical", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight" });
      expect(onSizeChange).toHaveBeenCalledWith(308); // 300 + 8 (default step)
    });

    it("shrinks size with ArrowLeft for vertical", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowLeft" });
      expect(onSizeChange).toHaveBeenCalledWith(292); // 300 - 8
    });

    it("uses largeStep with Shift+Arrow", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
      expect(onSizeChange).toHaveBeenCalledWith(332); // 300 + 32
    });

    it("grows with ArrowDown for horizontal (panel above)", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer {...defaultProps} orientation="horizontal" onSizeChange={onSizeChange} />
      );
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowDown" });
      expect(onSizeChange).toHaveBeenCalledWith(308);
    });

    it("shrinks with ArrowUp for horizontal (panel above)", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer {...defaultProps} orientation="horizontal" onSizeChange={onSizeChange} />
      );
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowUp" });
      expect(onSizeChange).toHaveBeenCalledWith(292);
    });

    it("resets to defaultSize on Home", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} size={500} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "Home" });
      expect(onSizeChange).toHaveBeenCalledWith(300); // defaultSize
    });

    it("maximizes on End", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "End" });
      expect(onSizeChange).toHaveBeenCalledWith(600); // max
    });

    it("clamps to min on shrink", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} size={205} step={10} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowLeft" });
      expect(onSizeChange).toHaveBeenCalledWith(200); // clamped to min
    });

    it("clamps to max on grow", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} size={595} step={10} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight" });
      expect(onSizeChange).toHaveBeenCalledWith(600); // clamped to max
    });

    it("toggles collapse on Space when collapsible", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} collapsible onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      // Collapse
      fireEvent.keyDown(separator, { key: " " });
      expect(onSizeChange).toHaveBeenCalledWith(0);
    });

    it("does not toggle collapse on Space when not collapsible", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: " " });
      expect(onSizeChange).not.toHaveBeenCalled();
    });
  });

  describe("double click", () => {
    it("resets to defaultSize on double click", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} size={500} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.doubleClick(separator);
      expect(onSizeChange).toHaveBeenCalledWith(300); // defaultSize
    });
  });

  describe("storage integration", () => {
    it("reads initial size from settingsStore when storageKey is set", () => {
      useSettingsStore.setState({
        layoutSizes: { "test.panel": 400 },
      });
      const onSizeChange = vi.fn();

      render(<YaggResizer {...defaultProps} storageKey="test.panel" onSizeChange={onSizeChange} />);

      expect(onSizeChange).toHaveBeenCalledWith(400);
    });

    it("does not read from store when no storageKey", () => {
      useSettingsStore.setState({
        layoutSizes: { "test.panel": 400 },
      });
      const onSizeChange = vi.fn();

      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);

      expect(onSizeChange).not.toHaveBeenCalled();
    });

    it("persists to settingsStore on keyboard resize", () => {
      const setLayoutSize = vi.fn();
      useSettingsStore.setState({ setLayoutSize } as never);

      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} storageKey="test.panel" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight" });
      expect(setLayoutSize).toHaveBeenCalledWith("test.panel", 308);
    });
  });

  describe("panelSide direction inversion", () => {
    it("inverts keyboard direction when panelSide is right", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} panelSide="right" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      // ArrowLeft should grow (panel is to the right, so left = toward the panel = grow)
      fireEvent.keyDown(separator, { key: "ArrowLeft" });
      expect(onSizeChange).toHaveBeenCalledWith(308); // 300 + 8
    });

    it("inverts shrink direction when panelSide is right", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} panelSide="right" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      // ArrowRight should shrink (away from the panel)
      fireEvent.keyDown(separator, { key: "ArrowRight" });
      expect(onSizeChange).toHaveBeenCalledWith(292); // 300 - 8
    });

    it("inverts keyboard direction when panelSide is down", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer
          {...defaultProps}
          orientation="horizontal"
          panelSide="down"
          onSizeChange={onSizeChange}
        />
      );
      const separator = screen.getByRole("separator");

      // Panel is below the resizer: dragging/pressing UP gives it more room.
      fireEvent.keyDown(separator, { key: "ArrowUp" });
      expect(onSizeChange).toHaveBeenCalledWith(308);
    });

    it("shrinks panel below with ArrowDown when panelSide is down", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer
          {...defaultProps}
          orientation="horizontal"
          panelSide="down"
          onSizeChange={onSizeChange}
        />
      );
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowDown" });
      expect(onSizeChange).toHaveBeenCalledWith(292);
    });

    it("does not invert when panelSide is left (default behavior)", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} panelSide="left" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight" });
      expect(onSizeChange).toHaveBeenCalledWith(308); // normal: right = grow
    });

    it("does not invert when panelSide is up (default behavior)", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer
          {...defaultProps}
          orientation="horizontal"
          panelSide="up"
          onSizeChange={onSizeChange}
        />
      );
      const separator = screen.getByRole("separator");

      // Panel is above the resizer: dragging/pressing DOWN gives it more room.
      fireEvent.keyDown(separator, { key: "ArrowDown" });
      expect(onSizeChange).toHaveBeenCalledWith(308);
    });
  });

  describe("custom step values", () => {
    it("uses custom step", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} step={16} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight" });
      expect(onSizeChange).toHaveBeenCalledWith(316);
    });

    it("uses custom largeStep", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} largeStep={64} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
      expect(onSizeChange).toHaveBeenCalledWith(364);
    });
  });

  describe("pointer drag", () => {
    beforeEach(() => {
      // jsdom doesn't implement setPointerCapture — stub it on HTMLElement.
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
        value: vi.fn(),
        configurable: true,
      });
      // Force synchronous rAF so pointer moves apply immediately.
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      });
      vi.stubGlobal("cancelAnimationFrame", vi.fn());
    });

    it("updates size on pointer move for a vertical resizer", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.pointerDown(separator, { clientX: 400, clientY: 0, pointerId: 1 });
      separator.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 420, clientY: 0, pointerId: 1, bubbles: true })
      );

      expect(onSizeChange).toHaveBeenCalledWith(320); // 300 + 20
    });

    it("commits and persists final size on pointer up", () => {
      const setLayoutSize = vi.fn();
      useSettingsStore.setState({ setLayoutSize } as never);
      const onSizeChange = vi.fn();

      render(<YaggResizer {...defaultProps} storageKey="test.drag" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.pointerDown(separator, { clientX: 400, clientY: 0, pointerId: 1 });
      separator.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 440, clientY: 0, pointerId: 1, bubbles: true })
      );
      separator.dispatchEvent(
        new PointerEvent("pointerup", { clientX: 440, clientY: 0, pointerId: 1, bubbles: true })
      );

      expect(setLayoutSize).toHaveBeenCalledWith("test.drag", 340);
    });

    it("inverts drag direction when panelSide is right", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} panelSide="right" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.pointerDown(separator, { clientX: 400, clientY: 0, pointerId: 1 });
      // Dragging right by 30 should shrink when panel is on the right.
      separator.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 430, clientY: 0, pointerId: 1, bubbles: true })
      );

      expect(onSizeChange).toHaveBeenCalledWith(270); // 300 - 30
    });

    it("uses clientY delta for horizontal orientation", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer {...defaultProps} orientation="horizontal" onSizeChange={onSizeChange} />
      );
      const separator = screen.getByRole("separator");

      fireEvent.pointerDown(separator, { clientX: 0, clientY: 200, pointerId: 1 });
      separator.dispatchEvent(
        new PointerEvent("pointermove", { clientX: 0, clientY: 215, pointerId: 1, bubbles: true })
      );

      expect(onSizeChange).toHaveBeenCalledWith(315);
    });

    it("cancels the drag on pointercancel without persisting a partial move", () => {
      const setLayoutSize = vi.fn();
      useSettingsStore.setState({ setLayoutSize } as never);
      const onSizeChange = vi.fn();

      render(<YaggResizer {...defaultProps} storageKey="test.drag" onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      fireEvent.pointerDown(separator, { clientX: 400, clientY: 0, pointerId: 1 });
      separator.dispatchEvent(
        new PointerEvent("pointercancel", { clientX: 400, clientY: 0, pointerId: 1, bubbles: true })
      );

      // No move dispatched, so the final commit just writes back the current size.
      expect(setLayoutSize).toHaveBeenCalledWith("test.drag", 300);
    });
  });

  describe("collapsible behaviour", () => {
    it("collapses to 0 below min/2 when collapsible", () => {
      const onSizeChange = vi.fn();
      render(
        <YaggResizer
          {...defaultProps}
          size={120}
          collapsible
          step={30}
          onSizeChange={onSizeChange}
        />
      );
      const separator = screen.getByRole("separator");

      // 120 - 30 = 90 which is below min (200) * 0.5 = 100 → collapses to 0
      fireEvent.keyDown(separator, { key: "ArrowLeft" });
      expect(onSizeChange).toHaveBeenCalledWith(0);
    });

    it("re-expands to defaultSize from collapsed on Enter", () => {
      const onSizeChange = vi.fn();
      render(<YaggResizer {...defaultProps} size={0} collapsible onSizeChange={onSizeChange} />);
      const separator = screen.getByRole("separator");

      // First press reads isCollapsedRef which mirrors the last commit (still false).
      fireEvent.keyDown(separator, { key: "Enter" });
      // After collapse, Enter again re-opens.
      fireEvent.keyDown(separator, { key: "Enter" });
      expect(onSizeChange).toHaveBeenLastCalledWith(300);
    });
  });
});

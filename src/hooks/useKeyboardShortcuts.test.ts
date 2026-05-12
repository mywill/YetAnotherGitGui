import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, type ShortcutHandler } from "./useKeyboardShortcuts";

const dispatch = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keydown", init));

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes handler for plain key match (case-insensitive)", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "k", handler }]));

    dispatch({ key: "K" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("requires the modifier when mod=true (mac Cmd or other Ctrl)", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "k", mod: true, handler }]));

    dispatch({ key: "k" });
    expect(handler).not.toHaveBeenCalled();

    dispatch({ key: "k", ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    dispatch({ key: "k", metaKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("rejects modifier presence when mod=false (default)", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "F5", handler }]));

    dispatch({ key: "F5", ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();

    dispatch({ key: "F5" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("requires shift to match when shift=true and rejects when shift=false", () => {
    const handlerWithShift = vi.fn();
    const handlerNoShift = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "n", shift: true, handler: handlerWithShift }]));
    renderHook(() => useKeyboardShortcuts([{ key: "m", handler: handlerNoShift }]));

    dispatch({ key: "n" });
    expect(handlerWithShift).not.toHaveBeenCalled();
    dispatch({ key: "n", shiftKey: true });
    expect(handlerWithShift).toHaveBeenCalledTimes(1);

    dispatch({ key: "m", shiftKey: true });
    expect(handlerNoShift).not.toHaveBeenCalled();
    dispatch({ key: "m" });
    expect(handlerNoShift).toHaveBeenCalledTimes(1);
  });

  it("requires alt to match when alt=true", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "p", alt: true, handler }]));

    dispatch({ key: "p" });
    expect(handler).not.toHaveBeenCalled();
    dispatch({ key: "p", altKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls preventDefault on a matched key event", () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "F5", handler }]));

    const ev = new KeyboardEvent("keydown", { key: "F5", cancelable: true });
    window.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
  });

  it("stops at the first matching shortcut", () => {
    const first = vi.fn();
    const second = vi.fn();
    const shortcuts: ShortcutHandler[] = [
      { key: "k", handler: first },
      { key: "k", handler: second },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));

    dispatch({ key: "k" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("suppresses shortcut when focus is inside .xterm and suppressInTerminal is unset", () => {
    const handler = vi.fn();
    const term = document.createElement("div");
    term.className = "xterm";
    const inner = document.createElement("input");
    term.appendChild(inner);
    document.body.appendChild(term);
    inner.focus();

    renderHook(() => useKeyboardShortcuts([{ key: "k", handler }]));

    dispatch({ key: "k" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("fires shortcut even inside terminal when suppressInTerminal=false", () => {
    const handler = vi.fn();
    const term = document.createElement("div");
    term.className = "xterm";
    const inner = document.createElement("input");
    term.appendChild(inner);
    document.body.appendChild(term);
    inner.focus();

    renderHook(() => useKeyboardShortcuts([{ key: "k", handler, suppressInTerminal: false }]));

    dispatch({ key: "k" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts([{ key: "k", handler }]));
    unmount();

    dispatch({ key: "k" });

    expect(handler).not.toHaveBeenCalled();
  });
});

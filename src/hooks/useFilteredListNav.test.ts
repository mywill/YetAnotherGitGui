import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { useFilteredListNav } from "./useFilteredListNav";

const items = ["alpha", "beta", "gamma", "delta"];

const fakeKey = (key: string) =>
  ({
    key,
    preventDefault: vi.fn(),
  }) as unknown as KeyboardEvent<HTMLInputElement>;

describe("useFilteredListNav", () => {
  it("returns all items when query is empty", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    expect(result.current.filtered).toEqual(items);
    expect(result.current.activeIndex).toBe(0);
  });

  it("filters items via matchesQuery", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.setQuery("bet"));
    expect(result.current.filtered).toEqual(["beta"]);
  });

  it("ArrowDown advances active index but stops at last item", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.handleKeyDown(fakeKey("ArrowDown")));
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.handleKeyDown(fakeKey("ArrowDown")));
    act(() => result.current.handleKeyDown(fakeKey("ArrowDown")));
    act(() => result.current.handleKeyDown(fakeKey("ArrowDown")));
    expect(result.current.activeIndex).toBe(3);
  });

  it("ArrowUp decrements but never goes below 0", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.setActiveIndex(2));
    act(() => result.current.handleKeyDown(fakeKey("ArrowUp")));
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.handleKeyDown(fakeKey("ArrowUp")));
    act(() => result.current.handleKeyDown(fakeKey("ArrowUp")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("Home jumps to first item, End jumps to last", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.handleKeyDown(fakeKey("End")));
    expect(result.current.activeIndex).toBe(items.length - 1);
    act(() => result.current.handleKeyDown(fakeKey("Home")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("End on an empty filtered list does not change index", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.setQuery("zzznomatch"));
    expect(result.current.filtered).toEqual([]);
    act(() => result.current.handleKeyDown(fakeKey("End")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("ArrowDown on empty filtered list keeps index at 0", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.setQuery("zzznomatch"));
    act(() => result.current.handleKeyDown(fakeKey("ArrowDown")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("Enter calls onActivate with the focused item", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate,
      })
    );
    act(() => result.current.setActiveIndex(2));
    act(() => result.current.handleKeyDown(fakeKey("Enter")));
    expect(onActivate).toHaveBeenCalledWith("gamma", 2);
  });

  it("Enter is a no-op when filtered list is empty", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate,
      })
    );
    act(() => result.current.setQuery("zzznomatch"));
    act(() => result.current.handleKeyDown(fakeKey("Enter")));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("Escape calls onEscape if provided", () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
        onEscape,
      })
    );
    act(() => result.current.handleKeyDown(fakeKey("Escape")));
    expect(onEscape).toHaveBeenCalled();
  });

  it("Escape without onEscape handler is a safe no-op", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    expect(() => {
      act(() => result.current.handleKeyDown(fakeKey("Escape")));
    }).not.toThrow();
  });

  it("resets active index when query changes", () => {
    const { result } = renderHook(() =>
      useFilteredListNav({
        items,
        getLabel: (s) => s,
        open: true,
        onActivate: vi.fn(),
      })
    );
    act(() => result.current.setActiveIndex(3));
    act(() => result.current.setQuery("a"));
    expect(result.current.activeIndex).toBe(0);
  });
});

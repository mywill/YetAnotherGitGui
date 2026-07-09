import { describe, it, expect, vi } from "vitest";
import type { RefInfo } from "../../types";
import { buildRefMenuItems } from "./refMenuItems";

describe("buildRefMenuItems", () => {
  const makeRef = (name: string, ref_type: RefInfo["ref_type"], is_head = false): RefInfo => ({
    name,
    ref_type,
    is_head,
  });

  const makeOnCopy = () =>
    vi.fn((name: string) => {
      const fn = vi.fn();
      Object.defineProperty(fn, "name", { value: `copy-${name}` });
      return fn;
    });

  it("returns no items when refs is empty", () => {
    const items = buildRefMenuItems([], makeOnCopy());
    expect(items).toEqual([]);
  });

  describe("branch names", () => {
    it("returns a single 'Copy branch name' item when one branch", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("main", "branch")], onCopy);

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Copy branch name");
      expect(items[0].children).toBeUndefined();
      expect(onCopy).toHaveBeenCalledWith("main");
    });

    it("invokes the onClick handler to copy the branch name", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("main", "branch")], onCopy);

      items[0].onClick?.();

      expect(onCopy.mock.calls[0][0]).toBe("main");
      expect(onCopy.mock.results[0].value).toHaveBeenCalled();
    });

    it("returns a 'Copy branch name' submenu when multiple branches", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems(
        [makeRef("main", "branch"), makeRef("feature", "branch")],
        onCopy
      );

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Copy branch name");
      expect(items[0].children).toHaveLength(2);
      expect(items[0].children!.map((c) => c.label)).toEqual(["main", "feature"]);
    });

    it("wires each submenu child to its own branch name", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems(
        [makeRef("main", "branch"), makeRef("feature", "branch")],
        onCopy
      );

      items[0].children![1].onClick?.();

      expect(onCopy).toHaveBeenNthCalledWith(2, "feature");
      expect(onCopy.mock.results[1].value).toHaveBeenCalled();
    });

    it("includes remote branches as branch names", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("origin/main", "remotebranch")], onCopy);

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Copy branch name");
      expect(onCopy).toHaveBeenCalledWith("origin/main");
    });
  });

  describe("tag names", () => {
    it("returns a single 'Copy tag name' item when one tag", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("v1.0.0", "tag")], onCopy);

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Copy tag name");
      expect(items[0].children).toBeUndefined();
      expect(onCopy).toHaveBeenCalledWith("v1.0.0");
    });

    it("invokes the onClick handler to copy the tag name", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("v1.0.0", "tag")], onCopy);

      items[0].onClick?.();

      expect(onCopy.mock.results[0].value).toHaveBeenCalled();
    });

    it("returns a 'Copy tag name' submenu when multiple tags", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("v1.0.0", "tag"), makeRef("v2.0.0", "tag")], onCopy);

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe("Copy tag name");
      expect(items[0].children).toHaveLength(2);
      expect(items[0].children!.map((c) => c.label)).toEqual(["v1.0.0", "v2.0.0"]);
    });

    it("wires each submenu child to its own tag name", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("v1.0.0", "tag"), makeRef("v2.0.0", "tag")], onCopy);

      items[0].children![0].onClick?.();

      expect(onCopy).toHaveBeenNthCalledWith(1, "v1.0.0");
      expect(onCopy.mock.results[0].value).toHaveBeenCalled();
    });
  });

  describe("mixed refs", () => {
    it("returns branch item first, then tag item", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems(
        [makeRef("main", "branch"), makeRef("v1.0.0", "tag")],
        onCopy
      );

      expect(items.map((i) => i.label)).toEqual(["Copy branch name", "Copy tag name"]);
    });

    it("returns both submenus when multiple branches and tags", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems(
        [
          makeRef("main", "branch"),
          makeRef("feature", "branch"),
          makeRef("v1.0.0", "tag"),
          makeRef("v2.0.0", "tag"),
        ],
        onCopy
      );

      expect(items).toHaveLength(2);
      expect(items[0].label).toBe("Copy branch name");
      expect(items[0].children).toHaveLength(2);
      expect(items[1].label).toBe("Copy tag name");
      expect(items[1].children).toHaveLength(2);
    });

    it("does not return a branch item when only tags present", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("v1.0.0", "tag")], onCopy);

      expect(items.map((i) => i.label)).toEqual(["Copy tag name"]);
    });

    it("does not return a tag item when only branches present", () => {
      const onCopy = makeOnCopy();
      const items = buildRefMenuItems([makeRef("main", "branch")], onCopy);

      expect(items.map((i) => i.label)).toEqual(["Copy branch name"]);
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { getConflictMenuItems, getUnstagedFileMenuItems } from "./unstagedMenuItems";

describe("getConflictMenuItems", () => {
  it("returns 4 conflict resolution items", () => {
    const items = getConflictMenuItems("a.ts", {
      stageFile: vi.fn(),
      resolveConflict: vi.fn(),
    });
    expect(items.map((i) => i.label)).toEqual([
      "Accept Ours",
      "Accept Theirs",
      "Accept Both",
      "Mark Resolved (stage)",
    ]);
  });

  it("Accept Ours wires to resolveConflict with 'ours'", () => {
    const resolveConflict = vi.fn();
    const items = getConflictMenuItems("a.ts", {
      stageFile: vi.fn(),
      resolveConflict,
    });
    items[0].onClick?.();
    expect(resolveConflict).toHaveBeenCalledWith("a.ts", "ours");
  });

  it("Accept Theirs wires to resolveConflict with 'theirs'", () => {
    const resolveConflict = vi.fn();
    const items = getConflictMenuItems("a.ts", {
      stageFile: vi.fn(),
      resolveConflict,
    });
    items[1].onClick?.();
    expect(resolveConflict).toHaveBeenCalledWith("a.ts", "theirs");
  });

  it("Accept Both wires to resolveConflict with 'both'", () => {
    const resolveConflict = vi.fn();
    const items = getConflictMenuItems("a.ts", {
      stageFile: vi.fn(),
      resolveConflict,
    });
    items[2].onClick?.();
    expect(resolveConflict).toHaveBeenCalledWith("a.ts", "both");
  });

  it("Mark Resolved wires to stageFile", () => {
    const stageFile = vi.fn();
    const items = getConflictMenuItems("a.ts", {
      stageFile,
      resolveConflict: vi.fn(),
    });
    items[3].onClick?.();
    expect(stageFile).toHaveBeenCalledWith("a.ts");
  });
});

describe("getUnstagedFileMenuItems", () => {
  const handlers = {
    revertFile: vi.fn(),
    deleteFile: vi.fn(),
    deleteFiles: vi.fn(),
  };

  it("returns single-file menu when nothing else is selected", () => {
    const items = getUnstagedFileMenuItems("a.ts", [], handlers);
    expect(items.map((i) => i.label)).toEqual(["Discard changes", "Delete file"]);
  });

  it("returns single-file menu when only this file is in selection", () => {
    const items = getUnstagedFileMenuItems("a.ts", ["a.ts"], handlers);
    expect(items.map((i) => i.label)).toEqual(["Discard changes", "Delete file"]);
  });

  it("returns multi-file menu when this file is in a multi-selection", () => {
    const items = getUnstagedFileMenuItems("a.ts", ["a.ts", "b.ts", "c.ts"], handlers);
    expect(items.map((i) => i.label)).toEqual(["Discard changes", "Delete 3 files"]);
  });

  it("returns single-file menu when this file is not in the multi-selection", () => {
    const items = getUnstagedFileMenuItems("d.ts", ["a.ts", "b.ts"], handlers);
    expect(items.map((i) => i.label)).toEqual(["Discard changes", "Delete file"]);
  });

  it("Delete N files wires to deleteFiles with selectedPaths", () => {
    const deleteFiles = vi.fn();
    const items = getUnstagedFileMenuItems("a.ts", ["a.ts", "b.ts"], {
      revertFile: vi.fn(),
      deleteFile: vi.fn(),
      deleteFiles,
    });
    items[1].onClick?.();
    expect(deleteFiles).toHaveBeenCalledWith(["a.ts", "b.ts"]);
  });
});

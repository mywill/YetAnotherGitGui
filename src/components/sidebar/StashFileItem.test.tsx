import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StashFileItem } from "./StashFileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { mockStore } from "../../test/mockStores";
import type { CommitFileChange, FileDiff } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../history/CommitFileDiff", () => ({
  CommitFileDiff: ({ diff }: { diff: FileDiff }) => (
    <div data-testid="commit-file-diff">{diff.hunks.length} hunks</div>
  ),
}));

const toggleStashFileExpanded = vi.fn();
const loadStashFileDiff = vi.fn();

function setup(
  file: CommitFileChange,
  opts: {
    expandedStashFiles?: Set<string>;
    stashFileDiffs?: Map<string, FileDiff>;
  } = {}
) {
  mockStore(useRepositoryStore, {
    expandedStashFiles: opts.expandedStashFiles ?? new Set<string>(),
    stashFileDiffs: opts.stashFileDiffs ?? new Map<string, FileDiff>(),
    toggleStashFileExpanded,
    loadStashFileDiff,
  });
  return render(<StashFileItem file={file} stashIndex={0} />);
}

const baseFile: CommitFileChange = {
  path: "src/foo.ts",
  old_path: null,
  status: "modified",
  additions: 1,
  deletions: 1,
};

describe("StashFileItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the file path", () => {
    setup(baseFile);
    expect(screen.getByText("src/foo.ts")).toBeInTheDocument();
  });

  it("renders an 'M' status icon for modified files", () => {
    setup(baseFile);
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it.each([
    ["added", "A"],
    ["deleted", "D"],
    ["modified", "M"],
    ["renamed", "R"],
    ["copied", "C"],
  ] as const)("renders %s status as '%s'", (status, icon) => {
    setup({ ...baseFile, status });
    expect(screen.getByText(icon)).toBeInTheDocument();
  });

  it("renders '?' icon for an unknown status", () => {
    setup({ ...baseFile, status: "unknown" as CommitFileChange["status"] });
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("shows old → new path when file was renamed", () => {
    setup({ ...baseFile, old_path: "src/old.ts", path: "src/new.ts", status: "renamed" });
    expect(screen.getByText("src/old.ts → src/new.ts")).toBeInTheDocument();
  });

  it("shows a ▶ marker when collapsed", () => {
    const { container } = setup(baseFile);
    expect(container.querySelector(".expand-icon")?.textContent).toBe("▶");
  });

  it("shows a ▼ marker and 'expanded' class when expanded", () => {
    const { container } = setup(baseFile, {
      expandedStashFiles: new Set([baseFile.path]),
    });
    expect(container.querySelector(".expand-icon")?.textContent).toBe("▼");
    expect(container.querySelector(".stash-file-item")).toHaveClass("expanded");
  });

  it("toggles expansion and loads the diff on click when collapsed", () => {
    const { container } = setup(baseFile);
    fireEvent.click(container.querySelector(".file-header")!);
    expect(toggleStashFileExpanded).toHaveBeenCalledWith(baseFile.path);
    expect(loadStashFileDiff).toHaveBeenCalledWith(0, baseFile.path);
  });

  it("does not re-load the diff when already cached", () => {
    const diff: FileDiff = { hunks: [] };
    const { container } = setup(baseFile, {
      stashFileDiffs: new Map([[baseFile.path, diff]]),
    });
    fireEvent.click(container.querySelector(".file-header")!);
    expect(toggleStashFileExpanded).toHaveBeenCalled();
    expect(loadStashFileDiff).not.toHaveBeenCalled();
  });

  it("collapsing a cached-diff file does not re-fetch", () => {
    const diff: FileDiff = { hunks: [] };
    const { container } = setup(baseFile, {
      expandedStashFiles: new Set([baseFile.path]),
      stashFileDiffs: new Map([[baseFile.path, diff]]),
    });
    fireEvent.click(container.querySelector(".file-header")!);
    expect(toggleStashFileExpanded).toHaveBeenCalled();
    expect(loadStashFileDiff).not.toHaveBeenCalled();
  });

  it("renders the file diff when expanded and diff is available", () => {
    const diff: FileDiff = {
      hunks: [
        {
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          header: "",
          lines: [],
        },
      ],
    };
    setup(baseFile, {
      expandedStashFiles: new Set([baseFile.path]),
      stashFileDiffs: new Map([[baseFile.path, diff]]),
    });
    expect(screen.getByTestId("commit-file-diff")).toBeInTheDocument();
  });

  it("shows a loading placeholder when expanded before the diff arrives", () => {
    setup(baseFile, {
      expandedStashFiles: new Set([baseFile.path]),
    });
    expect(screen.getByText("Loading diff...")).toBeInTheDocument();
  });
});

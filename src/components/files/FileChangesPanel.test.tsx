import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FileChangesPanel } from "./FileChangesPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { mockStore } from "../../test/mockStores";
import type { FileStatuses } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

// Mock the selection store
vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
  makeSelectionKey: (path: string, staged: boolean) => `${staged ? "staged" : "unstaged"}:${path}`,
}));

describe("FileChangesPanel", () => {
  const mockStageFile = vi.fn();
  const mockUnstageFile = vi.fn();
  const mockStageFiles = vi.fn();
  const mockUnstageFiles = vi.fn();
  const mockLoadFileDiff = vi.fn();
  const mockRevertFile = vi.fn();
  const mockDeleteFile = vi.fn();

  const mockToggleFileSelection = vi.fn();
  const mockSelectSingleFile = vi.fn();
  const mockClearFileSelection = vi.fn();
  const mockSelectedFilePaths = new Set<string>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedFilePaths.clear();
    setupStore();
    setupSelectionStore();
  });

  function setupStore() {
    mockStore(useRepositoryStore, {
      stageFile: mockStageFile,
      unstageFile: mockUnstageFile,
      stageFiles: mockStageFiles,
      unstageFiles: mockUnstageFiles,
      loadFileDiff: mockLoadFileDiff,
      revertFile: mockRevertFile,
      deleteFile: mockDeleteFile,
    });
  }

  function setupSelectionStore() {
    mockStore(useSelectionStore, {
      selectedFilePaths: mockSelectedFilePaths,
      toggleFileSelection: mockToggleFileSelection,
      selectSingleFile: mockSelectSingleFile,
      clearFileSelection: mockClearFileSelection,
    });
  }

  const emptyStatuses: FileStatuses = {
    staged: [],
    unstaged: [],
    untracked: [],
  };

  const sampleStatuses: FileStatuses = {
    staged: [{ path: "staged-file.ts", status: "modified", is_staged: true }],
    unstaged: [{ path: "unstaged-file.ts", status: "modified", is_staged: false }],
    untracked: [{ path: "new-file.ts", status: "untracked", is_staged: false }],
  };

  it("shows loading state when loading and no statuses", () => {
    render(<FileChangesPanel statuses={null} loading={true} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows 'No repository open' when no statuses and not loading", () => {
    render(<FileChangesPanel statuses={null} loading={false} />);

    expect(screen.getByText("No repository open")).toBeInTheDocument();
  });

  it("renders all three sections", () => {
    render(<FileChangesPanel statuses={emptyStatuses} loading={false} />);

    expect(screen.getByText("Staged")).toBeInTheDocument();
    expect(screen.getByText("Unstaged")).toBeInTheDocument();
    expect(screen.getByText("Untracked")).toBeInTheDocument();
  });

  it("shows file counts in section headers", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    const stagedSection = screen.getByText("Staged").closest(".section-header");
    const unstagedSection = screen.getByText("Unstaged").closest(".section-header");
    const untrackedSection = screen.getByText("Untracked").closest(".section-header");

    expect(stagedSection).toHaveTextContent("1");
    expect(unstagedSection).toHaveTextContent("1");
    expect(untrackedSection).toHaveTextContent("1");
  });

  it("displays staged files", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    expect(screen.getByText("staged-file.ts")).toBeInTheDocument();
  });

  it("displays unstaged files", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    expect(screen.getByText("unstaged-file.ts")).toBeInTheDocument();
  });

  it("displays untracked files", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    expect(screen.getByText("new-file.ts")).toBeInTheDocument();
  });

  it("shows empty message for section with no files", () => {
    render(<FileChangesPanel statuses={emptyStatuses} loading={false} />);

    expect(screen.getByText("No staged changes")).toBeInTheDocument();
    expect(screen.getByText("No unstaged changes")).toBeInTheDocument();
    expect(screen.getByText("No untracked files")).toBeInTheDocument();
  });

  it("collapses section when header is clicked", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    const stagedHeader = screen.getByText("Staged").closest(".section-header");
    fireEvent.click(stagedHeader!);

    // After collapse, the file should not be visible
    expect(screen.queryByText("staged-file.ts")).not.toBeInTheDocument();
  });

  it("expands collapsed section when header is clicked again", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    const stagedHeader = screen.getByText("Staged").closest(".section-header");

    // Collapse
    fireEvent.click(stagedHeader!);
    expect(screen.queryByText("staged-file.ts")).not.toBeInTheDocument();

    // Expand
    fireEvent.click(stagedHeader!);
    expect(screen.getByText("staged-file.ts")).toBeInTheDocument();
  });

  it("shows 'Stage All' button for unstaged section with files", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    const buttons = screen.getAllByRole("button", { name: "Stage All" });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows 'Unstage All' button for staged section with files", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    expect(screen.getByRole("button", { name: "Unstage All" })).toBeInTheDocument();
  });

  it("calls stageFiles with all unstaged file paths when 'Stage All' is clicked", async () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [
        { path: "file1.ts", status: "modified", is_staged: false },
        { path: "file2.ts", status: "modified", is_staged: false },
      ],
      untracked: [],
    };

    render(<FileChangesPanel statuses={statuses} loading={false} />);

    const stageAllBtn = screen.getByRole("button", { name: "Stage All" });
    fireEvent.click(stageAllBtn);

    await waitFor(() => {
      expect(mockStageFiles).toHaveBeenCalledWith(["file1.ts", "file2.ts"]);
      expect(mockStageFiles).toHaveBeenCalledTimes(1);
    });
  });

  it("calls unstageFiles with all staged file paths when 'Unstage All' is clicked", async () => {
    const statuses: FileStatuses = {
      staged: [
        { path: "file1.ts", status: "modified", is_staged: true },
        { path: "file2.ts", status: "added", is_staged: true },
      ],
      unstaged: [],
      untracked: [],
    };

    render(<FileChangesPanel statuses={statuses} loading={false} />);

    const unstageAllBtn = screen.getByRole("button", { name: "Unstage All" });
    fireEvent.click(unstageAllBtn);

    await waitFor(() => {
      expect(mockUnstageFiles).toHaveBeenCalledWith(["file1.ts", "file2.ts"]);
      expect(mockUnstageFiles).toHaveBeenCalledTimes(1);
    });
  });

  it("stages untracked files separately from unstaged files", async () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [{ path: "modified.ts", status: "modified", is_staged: false }],
      untracked: [{ path: "new.ts", status: "untracked", is_staged: false }],
    };

    render(<FileChangesPanel statuses={statuses} loading={false} />);

    // Click Stage All in unstaged section - should NOT include untracked
    const stageAllButtons = screen.getAllByRole("button", { name: "Stage All" });
    // First one should be for unstaged section
    fireEvent.click(stageAllButtons[0]);

    await waitFor(() => {
      expect(mockStageFiles).toHaveBeenCalledWith(["modified.ts"]);
      // Check that new.ts was not included
      expect(mockStageFiles).not.toHaveBeenCalledWith(expect.arrayContaining(["new.ts"]));
    });
  });

  it("does not show 'Stage All' when section is empty", () => {
    const statuses: FileStatuses = {
      staged: [{ path: "file.ts", status: "modified", is_staged: true }],
      unstaged: [],
      untracked: [],
    };

    render(<FileChangesPanel statuses={statuses} loading={false} />);

    // Should only have Unstage All, no Stage All
    expect(screen.queryByRole("button", { name: "Stage All" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unstage All" })).toBeInTheDocument();
  });

  it("does not show 'Unstage All' when staged section is empty", () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [{ path: "file.ts", status: "modified", is_staged: false }],
      untracked: [],
    };

    render(<FileChangesPanel statuses={statuses} loading={false} />);

    expect(screen.queryByRole("button", { name: "Unstage All" })).not.toBeInTheDocument();
  });

  it("calls loadFileDiff when file is selected", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    const fileItem = screen.getByText("unstaged-file.ts").closest(".file-item");
    fireEvent.click(fileItem!);

    expect(mockLoadFileDiff).toHaveBeenCalledWith("unstaged-file.ts", false);
  });

  it("calls loadFileDiff with staged=true for staged files", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);

    const fileItem = screen.getByText("staged-file.ts").closest(".file-item");
    fireEvent.click(fileItem!);

    expect(mockLoadFileDiff).toHaveBeenCalledWith("staged-file.ts", true);
  });

  it("calls stageFiles with untracked paths when untracked 'Stage All' is clicked", async () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [],
      untracked: [
        { path: "a.ts", status: "untracked", is_staged: false },
        { path: "b.ts", status: "untracked", is_staged: false },
      ],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const btn = screen.getByRole("button", { name: "Stage All" });
    fireEvent.click(btn);
    await waitFor(() => expect(mockStageFiles).toHaveBeenCalledWith(["a.ts", "b.ts"]));
  });

  it("dispatches shift-select via keyboard ArrowDown in staged list", () => {
    const statuses: FileStatuses = {
      staged: [
        { path: "s1.ts", status: "modified", is_staged: true },
        { path: "s2.ts", status: "modified", is_staged: true },
      ],
      unstaged: [],
      untracked: [],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Staged files" });
    list.focus();
    fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
    expect(mockToggleFileSelection).toHaveBeenCalledWith("s2.ts", true, false, true, [
      "s1.ts",
      "s2.ts",
    ]);
    expect(mockLoadFileDiff).toHaveBeenCalledWith("s2.ts", true);
  });

  it("selects a single unstaged file via ArrowDown without shift", () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [
        { path: "u1.ts", status: "modified", is_staged: false },
        { path: "u2.ts", status: "modified", is_staged: false },
      ],
      untracked: [],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Unstaged files" });
    list.focus();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(mockSelectSingleFile).toHaveBeenCalledWith("u2.ts", false);
    expect(mockLoadFileDiff).toHaveBeenCalledWith("u2.ts", false);
  });

  it("reverts unstaged file on Delete", () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [{ path: "u1.ts", status: "modified", is_staged: false }],
      untracked: [],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Unstaged files" });
    list.focus();
    fireEvent.keyDown(list, { key: "Delete" });
    expect(mockRevertFile).toHaveBeenCalledWith("u1.ts");
  });

  it("deletes untracked file on Delete", () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [],
      untracked: [{ path: "x.ts", status: "untracked", is_staged: false }],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Untracked files" });
    list.focus();
    fireEvent.keyDown(list, { key: "Delete" });
    expect(mockDeleteFile).toHaveBeenCalledWith("x.ts");
  });

  it("stages a staged file diff on Enter (activate)", () => {
    const statuses: FileStatuses = {
      staged: [{ path: "s.ts", status: "modified", is_staged: true }],
      unstaged: [],
      untracked: [],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Staged files" });
    list.focus();
    mockLoadFileDiff.mockClear();
    fireEvent.keyDown(list, { key: "Enter" });
    expect(mockLoadFileDiff).toHaveBeenCalledWith("s.ts", true);
  });

  it("unstages staged file on Space (secondary activate)", () => {
    const statuses: FileStatuses = {
      staged: [{ path: "s.ts", status: "modified", is_staged: true }],
      unstaged: [],
      untracked: [],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Staged files" });
    list.focus();
    fireEvent.keyDown(list, { key: " " });
    expect(mockUnstageFile).toHaveBeenCalledWith("s.ts");
  });

  it("stages unstaged file on Space (secondary activate)", () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [{ path: "u.ts", status: "modified", is_staged: false }],
      untracked: [],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Unstaged files" });
    list.focus();
    fireEvent.keyDown(list, { key: " " });
    expect(mockStageFile).toHaveBeenCalledWith("u.ts");
  });

  it("stages untracked file on Space", () => {
    const statuses: FileStatuses = {
      staged: [],
      unstaged: [],
      untracked: [{ path: "x.ts", status: "untracked", is_staged: false }],
    };
    render(<FileChangesPanel statuses={statuses} loading={false} />);
    const list = screen.getByRole("listbox", { name: "Untracked files" });
    list.focus();
    fireEvent.keyDown(list, { key: " " });
    expect(mockStageFile).toHaveBeenCalledWith("x.ts");
  });

  it("shows selection action bar when files are selected and stages the selection", async () => {
    mockSelectedFilePaths.add("unstaged:unstaged-file.ts");
    setupSelectionStore();
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);
    expect(screen.getByText(/file selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stage Selected" }));
    await waitFor(() => {
      expect(mockStageFiles).toHaveBeenCalledWith(["unstaged-file.ts"]);
      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });

  it("unstages the selection via 'Unstage Selected'", async () => {
    mockSelectedFilePaths.add("staged:staged-file.ts");
    setupSelectionStore();
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Unstage Selected" }));
    await waitFor(() => {
      expect(mockUnstageFiles).toHaveBeenCalledWith(["staged-file.ts"]);
      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });

  it("clears the selection via 'Clear Selection'", () => {
    mockSelectedFilePaths.add("unstaged:unstaged-file.ts");
    setupSelectionStore();
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear Selection" }));
    expect(mockClearFileSelection).toHaveBeenCalled();
  });

  it("resizes the staged section via mouse drag", () => {
    render(<FileChangesPanel statuses={sampleStatuses} loading={false} />);
    const resizer = document.querySelector(".section-resizer")!;
    fireEvent.mouseDown(resizer, { clientY: 100 });
    fireEvent.mouseMove(document, { clientY: 200 });
    fireEvent.mouseUp(document);
    // Should no longer be resizing - body cursor cleared
    expect(document.body.style.cursor).toBe("");
  });
});

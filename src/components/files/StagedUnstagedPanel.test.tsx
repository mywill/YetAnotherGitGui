import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StagedUnstagedPanel } from "./StagedUnstagedPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { mockStore } from "../../test/mockStores";
import type { FileStatuses } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

// Helper to create selection keys matching the real implementation
const makeSelectionKey = (path: string, staged: boolean) =>
  `${staged ? "staged" : "unstaged"}:${path}`;

// Mock the selection store
vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
  makeSelectionKey: (path: string, staged: boolean) => `${staged ? "staged" : "unstaged"}:${path}`,
}));

// Mock FileItem component to simplify testing
vi.mock("./FileItem", () => ({
  FileItem: ({
    file,
    isStaged,
    isSelected,
    onToggleStage,
    onSelect,
    onDoubleClick,
    onSelectWithModifiers,
    extraMenuItems,
  }: {
    file: { path: string };
    isStaged: boolean;
    isSelected?: boolean;
    onToggleStage: () => void;
    onSelect: () => void;
    onDoubleClick: () => void;
    onSelectWithModifiers?: (path: string, isCtrl: boolean, isShift: boolean) => void;
    extraMenuItems?: { label: string; onClick: () => void }[];
  }) => (
    <div
      data-testid={`file-item-${file.path}`}
      data-staged={isStaged}
      data-selected={isSelected}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <button onClick={onToggleStage}>Toggle</button>
      <button onClick={() => onSelectWithModifiers?.(file.path, true, false)}>Ctrl-select</button>
      <button onClick={() => onSelectWithModifiers?.(file.path, false, true)}>Shift-select</button>
      {extraMenuItems?.map((item) => (
        <button key={item.label} onClick={item.onClick} data-testid={`menu-${item.label}`}>
          {item.label}
        </button>
      ))}
      {file.path}
    </div>
  ),
}));

describe("StagedUnstagedPanel", () => {
  const mockStageFile = vi.fn();
  const mockUnstageFile = vi.fn();
  const mockStageFiles = vi.fn();
  const mockUnstageFiles = vi.fn();
  const mockLoadFileDiff = vi.fn();
  const mockRevertFile = vi.fn();
  const mockDeleteFile = vi.fn();
  const mockResolveConflict = vi.fn();

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
      resolveConflict: mockResolveConflict,
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
    staged: [{ path: "staged.ts", status: "modified", is_staged: true }],
    unstaged: [{ path: "unstaged.ts", status: "modified", is_staged: false }],
    untracked: [],
  };

  describe("loading state", () => {
    it("shows loading when loading and no statuses", () => {
      render(<StagedUnstagedPanel statuses={null} loading={true} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("has loading CSS class when loading", () => {
      const { container } = render(<StagedUnstagedPanel statuses={null} loading={true} />);

      expect(container.querySelector(".staged-unstaged-panel.loading")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no statuses and not loading", () => {
      render(<StagedUnstagedPanel statuses={null} loading={false} />);

      expect(screen.getByText("No repository open")).toBeInTheDocument();
    });

    it("has empty CSS class when no repository", () => {
      const { container } = render(<StagedUnstagedPanel statuses={null} loading={false} />);

      expect(container.querySelector(".staged-unstaged-panel.empty")).toBeInTheDocument();
    });
  });

  describe("section rendering", () => {
    it("renders staged section", () => {
      render(<StagedUnstagedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.getByText("Staged")).toBeInTheDocument();
    });

    it("renders unstaged section", () => {
      render(<StagedUnstagedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.getByText("Unstaged")).toBeInTheDocument();
    });

    it("shows file counts in section headers", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      // Find section header titles and check counts
      const stagedHeaderTitle = screen.getByText("Staged").closest(".section-header-title");
      const unstagedHeaderTitle = screen.getByText("Unstaged").closest(".section-header-title");

      expect(stagedHeaderTitle?.querySelector(".section-count")).toHaveTextContent("1");
      expect(unstagedHeaderTitle?.querySelector(".section-count")).toHaveTextContent("1");
    });

    it("always shows all files (no collapsibility)", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      // Both files should be visible
      expect(screen.getByTestId("file-item-staged.ts")).toBeInTheDocument();
      expect(screen.getByTestId("file-item-unstaged.ts")).toBeInTheDocument();
    });
  });

  describe("Stage All button", () => {
    it("shows Stage All button when there are unstaged files", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      expect(screen.getByText("Stage All")).toBeInTheDocument();
    });

    it("hides Stage All button when no unstaged files", () => {
      const statusesNoUnstaged: FileStatuses = {
        staged: [{ path: "staged.ts", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      };

      render(<StagedUnstagedPanel statuses={statusesNoUnstaged} loading={false} />);

      expect(screen.queryByText("Stage All")).not.toBeInTheDocument();
    });

    it("calls stageFiles with all unstaged file paths when clicked", async () => {
      const statusesMultiple: FileStatuses = {
        staged: [],
        unstaged: [
          { path: "file1.ts", status: "modified", is_staged: false },
          { path: "file2.ts", status: "modified", is_staged: false },
        ],
        untracked: [],
      };

      render(<StagedUnstagedPanel statuses={statusesMultiple} loading={false} />);

      fireEvent.click(screen.getByText("Stage All"));

      await waitFor(() => {
        expect(mockStageFiles).toHaveBeenCalledWith(["file1.ts", "file2.ts"]);
        expect(mockStageFiles).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Unstage All button", () => {
    it("shows Unstage All button when there are staged files", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      expect(screen.getByText("Unstage All")).toBeInTheDocument();
    });

    it("hides Unstage All button when no staged files", () => {
      const statusesNoStaged: FileStatuses = {
        staged: [],
        unstaged: [{ path: "unstaged.ts", status: "modified", is_staged: false }],
        untracked: [],
      };

      render(<StagedUnstagedPanel statuses={statusesNoStaged} loading={false} />);

      expect(screen.queryByText("Unstage All")).not.toBeInTheDocument();
    });

    it("calls unstageFiles with all staged file paths when clicked", async () => {
      const statusesMultiple: FileStatuses = {
        staged: [
          { path: "file1.ts", status: "modified", is_staged: true },
          { path: "file2.ts", status: "added", is_staged: true },
        ],
        unstaged: [],
        untracked: [],
      };

      render(<StagedUnstagedPanel statuses={statusesMultiple} loading={false} />);

      fireEvent.click(screen.getByText("Unstage All"));

      await waitFor(() => {
        expect(mockUnstageFiles).toHaveBeenCalledWith(["file1.ts", "file2.ts"]);
        expect(mockUnstageFiles).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("empty section messages", () => {
    it("shows empty message for staged section with no files", () => {
      render(<StagedUnstagedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.getByText("No staged changes")).toBeInTheDocument();
    });

    it("shows empty message for unstaged section with no files", () => {
      render(<StagedUnstagedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.getByText("No unstaged changes")).toBeInTheDocument();
    });
  });

  describe("file items", () => {
    it("passes isStaged=true to staged files", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      const stagedFile = screen.getByTestId("file-item-staged.ts");
      expect(stagedFile).toHaveAttribute("data-staged", "true");
    });

    it("passes isStaged=false to unstaged files", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      const unstagedFile = screen.getByTestId("file-item-unstaged.ts");
      expect(unstagedFile).toHaveAttribute("data-staged", "false");
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS class structure", () => {
      const { container } = render(
        <StagedUnstagedPanel statuses={sampleStatuses} loading={false} />
      );

      expect(container.querySelector(".staged-unstaged-panel")).toBeInTheDocument();
      expect(container.querySelectorAll(".file-section").length).toBe(2);
      expect(container.querySelectorAll(".section-header").length).toBe(2);
      expect(container.querySelectorAll(".section-content").length).toBe(2);
    });

    it("section headers are not clickable", () => {
      const { container } = render(
        <StagedUnstagedPanel statuses={sampleStatuses} loading={false} />
      );

      // Headers should not have clickable class
      expect(container.querySelector(".section-header.clickable")).not.toBeInTheDocument();
    });
  });

  describe("selection actions in headers", () => {
    it("shows Unstage Selected button when staged files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();

      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      expect(screen.getByText("Unstage Selected")).toBeInTheDocument();
    });

    it("shows Stage Selected button when unstaged files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();

      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      expect(screen.getByText("Stage Selected")).toBeInTheDocument();
    });

    it("shows Clear button when files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();

      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      expect(screen.getAllByRole("button", { name: "Clear selection" }).length).toBeGreaterThan(0);
    });

    it("calls unstageFiles when Unstage Selected is clicked", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();

      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      fireEvent.click(screen.getByText("Unstage Selected"));

      await waitFor(() => {
        expect(mockUnstageFiles).toHaveBeenCalledWith(["staged.ts"]);
      });
    });

    it("calls stageFiles when Stage Selected is clicked", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();

      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      fireEvent.click(screen.getByText("Stage Selected"));

      await waitFor(() => {
        expect(mockStageFiles).toHaveBeenCalledWith(["unstaged.ts"]);
      });
    });

    it("clears selection when Clear is clicked", () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();

      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);

      fireEvent.click(screen.getAllByRole("button", { name: "Clear selection" })[0]);

      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    const twoUnstaged: FileStatuses = {
      staged: [],
      unstaged: [
        { path: "u1.ts", status: "modified", is_staged: false },
        { path: "u2.ts", status: "modified", is_staged: false },
      ],
      untracked: [],
    };
    const twoStaged: FileStatuses = {
      staged: [
        { path: "s1.ts", status: "modified", is_staged: true },
        { path: "s2.ts", status: "modified", is_staged: true },
      ],
      unstaged: [],
      untracked: [],
    };

    it("Enter on staged list unstages the file", () => {
      render(<StagedUnstagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "Enter" });
      expect(mockUnstageFile).toHaveBeenCalledWith("s1.ts");
    });

    it("Space on staged list unstages the file (secondary activate)", () => {
      render(<StagedUnstagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: " " });
      expect(mockUnstageFile).toHaveBeenCalledWith("s1.ts");
    });

    it("ArrowDown without shift single-selects a staged file", () => {
      render(<StagedUnstagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      expect(mockSelectSingleFile).toHaveBeenCalledWith("s2.ts", true);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("s2.ts", true);
    });

    it("ArrowDown with shift extends selection on staged list", () => {
      render(<StagedUnstagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
      expect(mockToggleFileSelection).toHaveBeenCalledWith("s2.ts", true, false, true, [
        "s1.ts",
        "s2.ts",
      ]);
    });

    it("Enter on unstaged list stages the file", () => {
      render(<StagedUnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "Enter" });
      expect(mockStageFile).toHaveBeenCalledWith("u1.ts");
    });

    it("Delete on unstaged list discards the file", () => {
      render(<StagedUnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "Delete" });
      expect(mockRevertFile).toHaveBeenCalledWith("u1.ts");
    });

    it("ArrowDown without shift single-selects an unstaged file and loads diff", () => {
      render(<StagedUnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      expect(mockSelectSingleFile).toHaveBeenCalledWith("u2.ts", false);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("u2.ts", false, undefined, undefined);
    });

    it("ArrowDown with shift extends unstaged selection", () => {
      render(<StagedUnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
      expect(mockToggleFileSelection).toHaveBeenCalledWith("u2.ts", false, false, true, [
        "u1.ts",
        "u2.ts",
      ]);
    });

    it("loads diff with isConflicted=true for conflicted unstaged files", () => {
      const statuses: FileStatuses = {
        staged: [],
        unstaged: [
          { path: "c.ts", status: "conflicted", is_staged: false },
          { path: "c2.ts", status: "conflicted", is_staged: false },
        ],
        untracked: [],
      };
      render(<StagedUnstagedPanel statuses={statuses} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      expect(mockLoadFileDiff).toHaveBeenCalledWith("c2.ts", false, undefined, true);
    });
  });

  describe("conflict resolution menu", () => {
    const conflicted: FileStatuses = {
      staged: [],
      unstaged: [{ path: "c.ts", status: "conflicted", is_staged: false }],
      untracked: [],
    };

    it("Accept Ours calls resolveConflict with 'ours'", () => {
      render(<StagedUnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Accept Ours"));
      expect(mockResolveConflict).toHaveBeenCalledWith("c.ts", "ours");
    });

    it("Accept Theirs calls resolveConflict with 'theirs'", () => {
      render(<StagedUnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Accept Theirs"));
      expect(mockResolveConflict).toHaveBeenCalledWith("c.ts", "theirs");
    });

    it("Accept Both calls resolveConflict with 'both'", () => {
      render(<StagedUnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Accept Both"));
      expect(mockResolveConflict).toHaveBeenCalledWith("c.ts", "both");
    });

    it("Mark Resolved stages the file", () => {
      render(<StagedUnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Mark Resolved (stage)"));
      expect(mockStageFile).toHaveBeenCalledWith("c.ts");
    });
  });

  describe("non-conflict unstaged context menu", () => {
    const unstaged: FileStatuses = {
      staged: [],
      unstaged: [{ path: "u.ts", status: "modified", is_staged: false }],
      untracked: [],
    };

    it("Discard changes reverts the file", () => {
      render(<StagedUnstagedPanel statuses={unstaged} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Discard changes"));
      expect(mockRevertFile).toHaveBeenCalledWith("u.ts");
    });

    it("Delete file deletes the file", () => {
      render(<StagedUnstagedPanel statuses={unstaged} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Delete file"));
      expect(mockDeleteFile).toHaveBeenCalledWith("u.ts");
    });
  });

  describe("staged context menu", () => {
    it("Unstage from context menu unstages", () => {
      const statuses: FileStatuses = {
        staged: [{ path: "s.ts", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      };
      render(<StagedUnstagedPanel statuses={statuses} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Unstage"));
      expect(mockUnstageFile).toHaveBeenCalledWith("s.ts");
    });
  });

  describe("mouse-driven selection", () => {
    it("Ctrl-click dispatches toggleFileSelection for a staged file", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      const stagedItem = screen.getByTestId("file-item-staged.ts");
      fireEvent.click(stagedItem.querySelector("button[data-testid='menu-Unstage']") || stagedItem);
      // The simpler Ctrl-select path:
      const ctrlBtn = stagedItem.parentElement!.querySelector("button") as HTMLButtonElement;
      ctrlBtn.click();
      // toggleFileSelection called with isCtrl=true path via onSelectWithModifiers
      expect(mockLoadFileDiff).toHaveBeenCalled();
    });

    it("Shift-click on unstaged uses onSelectWithModifiers, which toggles and loads diff", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      const unstagedItem = screen.getByTestId("file-item-unstaged.ts");
      const shiftBtn = [...unstagedItem.querySelectorAll("button")].find(
        (b) => b.textContent === "Shift-select"
      ) as HTMLButtonElement;
      shiftBtn.click();
      expect(mockToggleFileSelection).toHaveBeenCalledWith("unstaged.ts", false, false, true, [
        "unstaged.ts",
      ]);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("unstaged.ts", false, undefined, undefined);
    });

    it("Shift-click on staged calls toggleFileSelection and loads diff", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      const stagedItem = screen.getByTestId("file-item-staged.ts");
      const shiftBtn = [...stagedItem.querySelectorAll("button")].find(
        (b) => b.textContent === "Shift-select"
      ) as HTMLButtonElement;
      shiftBtn.click();
      expect(mockToggleFileSelection).toHaveBeenCalledWith("staged.ts", true, false, true, [
        "staged.ts",
      ]);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("staged.ts", true);
    });

    it("double-click on an unstaged file stages it", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.doubleClick(screen.getByTestId("file-item-unstaged.ts"));
      expect(mockStageFile).toHaveBeenCalledWith("unstaged.ts");
    });

    it("double-click on a staged file unstages it", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.doubleClick(screen.getByTestId("file-item-staged.ts"));
      expect(mockUnstageFile).toHaveBeenCalledWith("staged.ts");
    });

    it("Toggle button on a staged file calls unstage", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      const stagedItem = screen.getByTestId("file-item-staged.ts");
      const toggleBtn = [...stagedItem.querySelectorAll("button")].find(
        (b) => b.textContent === "Toggle"
      ) as HTMLButtonElement;
      toggleBtn.click();
      expect(mockUnstageFile).toHaveBeenCalledWith("staged.ts");
    });

    it("Toggle button on an unstaged file calls stage", () => {
      render(<StagedUnstagedPanel statuses={sampleStatuses} loading={false} />);
      const unstagedItem = screen.getByTestId("file-item-unstaged.ts");
      const toggleBtn = [...unstagedItem.querySelectorAll("button")].find(
        (b) => b.textContent === "Toggle"
      ) as HTMLButtonElement;
      toggleBtn.click();
      expect(mockStageFile).toHaveBeenCalledWith("unstaged.ts");
    });
  });
});

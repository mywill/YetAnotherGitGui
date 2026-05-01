import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UnstagedPanel } from "./UnstagedPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { mockStore } from "../../test/mockStores";
import type { FileStatuses } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

const makeSelectionKey = (path: string, staged: boolean) =>
  `${staged ? "staged" : "unstaged"}:${path}`;

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
  makeSelectionKey: (path: string, staged: boolean) => `${staged ? "staged" : "unstaged"}:${path}`,
}));

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

describe("UnstagedPanel", () => {
  const mockStageFile = vi.fn();
  const mockStageFiles = vi.fn();
  const mockLoadFileDiff = vi.fn();
  const mockRevertFile = vi.fn();
  const mockDeleteFile = vi.fn();
  const mockDeleteFiles = vi.fn();
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
      stageFiles: mockStageFiles,
      loadFileDiff: mockLoadFileDiff,
      revertFile: mockRevertFile,
      deleteFile: mockDeleteFile,
      deleteFiles: mockDeleteFiles,
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

  const emptyStatuses: FileStatuses = { staged: [], unstaged: [], untracked: [] };

  const sampleStatuses: FileStatuses = {
    staged: [],
    unstaged: [{ path: "unstaged.ts", status: "modified", is_staged: false }],
    untracked: [],
  };

  describe("loading & empty states", () => {
    it("shows loading when loading and no statuses", () => {
      render(<UnstagedPanel statuses={null} loading={true} />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows empty message when no statuses and not loading", () => {
      render(<UnstagedPanel statuses={null} loading={false} />);
      expect(screen.getByText("No repository open")).toBeInTheDocument();
    });

    it("shows empty section message when no unstaged files", () => {
      render(<UnstagedPanel statuses={emptyStatuses} loading={false} />);
      expect(screen.getByText("No unstaged changes")).toBeInTheDocument();
    });
  });

  describe("section rendering", () => {
    it("renders unstaged section header", () => {
      render(<UnstagedPanel statuses={emptyStatuses} loading={false} />);
      expect(screen.getByText("Unstaged")).toBeInTheDocument();
    });

    it("shows file count in header", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      const header = screen.getByText("Unstaged").closest(".section-header-title");
      expect(header?.querySelector(".section-count")).toHaveTextContent("1");
    });

    it("renders unstaged file items", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByTestId("file-item-unstaged.ts")).toBeInTheDocument();
    });

    it("passes isStaged=false to file items", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByTestId("file-item-unstaged.ts")).toHaveAttribute("data-staged", "false");
    });
  });

  describe("Stage All button", () => {
    it("shows the All button when there are unstaged files", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Stage all unstaged files" })).toBeInTheDocument();
    });

    it("hides the All button when no unstaged files", () => {
      render(<UnstagedPanel statuses={emptyStatuses} loading={false} />);
      expect(screen.queryByRole("button", { name: "Stage all unstaged files" })).toBeNull();
    });

    it("calls stageFiles with all unstaged paths when clicked", async () => {
      const multi: FileStatuses = {
        staged: [],
        unstaged: [
          { path: "a.ts", status: "modified", is_staged: false },
          { path: "b.ts", status: "modified", is_staged: false },
        ],
        untracked: [],
      };
      render(<UnstagedPanel statuses={multi} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Stage all unstaged files" }));
      await waitFor(() => {
        expect(mockStageFiles).toHaveBeenCalledWith(["a.ts", "b.ts"]);
      });
    });
  });

  describe("selection actions", () => {
    it("shows the stage-selected button with the selection count", () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Stage 1 selected file" })).toBeInTheDocument();
    });

    it("shows the delete-selected button", () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Delete 1 selected file" })).toBeInTheDocument();
    });

    it("shows Clear Selection button when files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument();
    });

    it("uses plural in aria-label when multiple files are selected", () => {
      const multi: FileStatuses = {
        staged: [],
        unstaged: [
          { path: "a.ts", status: "modified", is_staged: false },
          { path: "b.ts", status: "modified", is_staged: false },
        ],
        untracked: [],
      };
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("b.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={multi} loading={false} />);
      expect(screen.getByRole("button", { name: "Stage 2 selected files" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete 2 selected files" })).toBeInTheDocument();
    });

    it("calls stageFiles when stage-selected is clicked", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Stage 1 selected file" }));
      await waitFor(() => {
        expect(mockStageFiles).toHaveBeenCalledWith(["unstaged.ts"]);
      });
    });

    it("clears selection when Clear is clicked", () => {
      mockSelectedFilePaths.add(makeSelectionKey("unstaged.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS class structure", () => {
      const { container } = render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      expect(container.querySelector(".unstaged-panel")).toBeInTheDocument();
      expect(container.querySelector(".section-header")).toBeInTheDocument();
      expect(container.querySelector(".section-content")).toBeInTheDocument();
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

    it("Enter on unstaged list stages the file", () => {
      render(<UnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "Enter" });
      expect(mockStageFile).toHaveBeenCalledWith("u1.ts");
    });

    it("Delete on unstaged list discards the file", () => {
      render(<UnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "Delete" });
      expect(mockRevertFile).toHaveBeenCalledWith("u1.ts");
    });

    it("ArrowDown single-selects an unstaged file and loads diff", () => {
      render(<UnstagedPanel statuses={twoUnstaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Unstaged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      expect(mockSelectSingleFile).toHaveBeenCalledWith("u2.ts", false);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("u2.ts", false, undefined, undefined);
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
      render(<UnstagedPanel statuses={statuses} loading={false} />);
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
      render(<UnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Accept Ours"));
      expect(mockResolveConflict).toHaveBeenCalledWith("c.ts", "ours");
    });

    it("Accept Theirs calls resolveConflict with 'theirs'", () => {
      render(<UnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Accept Theirs"));
      expect(mockResolveConflict).toHaveBeenCalledWith("c.ts", "theirs");
    });

    it("Accept Both calls resolveConflict with 'both'", () => {
      render(<UnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Accept Both"));
      expect(mockResolveConflict).toHaveBeenCalledWith("c.ts", "both");
    });

    it("Mark Resolved stages the file", () => {
      render(<UnstagedPanel statuses={conflicted} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Mark Resolved (stage)"));
      expect(mockStageFile).toHaveBeenCalledWith("c.ts");
    });
  });

  describe("non-conflict context menu", () => {
    const unstaged: FileStatuses = {
      staged: [],
      unstaged: [{ path: "u.ts", status: "modified", is_staged: false }],
      untracked: [],
    };

    it("Discard changes reverts the file", () => {
      render(<UnstagedPanel statuses={unstaged} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Discard changes"));
      expect(mockRevertFile).toHaveBeenCalledWith("u.ts");
    });

    it("Delete file deletes the file", () => {
      render(<UnstagedPanel statuses={unstaged} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Delete file"));
      expect(mockDeleteFile).toHaveBeenCalledWith("u.ts");
    });
  });

  describe("batch delete", () => {
    const twoUnstaged: FileStatuses = {
      staged: [],
      unstaged: [
        { path: "u1.ts", status: "modified", is_staged: false },
        { path: "u2.ts", status: "modified", is_staged: false },
      ],
      untracked: [],
    };

    it("does not show delete-selected when nothing is selected", () => {
      render(<UnstagedPanel statuses={twoUnstaged} loading={false} />);
      expect(screen.queryByRole("button", { name: /Delete \d+ selected file/ })).toBeNull();
    });

    it("delete-selected calls deleteFiles with all selected paths", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("u1.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("u2.ts", false));
      setupSelectionStore();
      mockDeleteFiles.mockResolvedValue(undefined);
      render(<UnstagedPanel statuses={twoUnstaged} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Delete 2 selected files" }));
      await waitFor(() => {
        expect(mockDeleteFiles).toHaveBeenCalledWith(["u1.ts", "u2.ts"]);
        expect(mockClearFileSelection).toHaveBeenCalled();
      });
    });

    it("right-click on a multi-selected file shows batch delete entry", () => {
      mockSelectedFilePaths.add(makeSelectionKey("u1.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("u2.ts", false));
      setupSelectionStore();
      render(<UnstagedPanel statuses={twoUnstaged} loading={false} />);
      const batchEntries = screen.getAllByTestId("menu-Delete 2 files");
      expect(batchEntries.length).toBeGreaterThan(0);
      fireEvent.click(batchEntries[0]);
      expect(mockDeleteFiles).toHaveBeenCalledWith(["u1.ts", "u2.ts"]);
    });
  });

  describe("mouse-driven selection", () => {
    it("Shift-click on unstaged uses onSelectWithModifiers", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      const item = screen.getByTestId("file-item-unstaged.ts");
      const shiftBtn = [...item.querySelectorAll("button")].find(
        (b) => b.textContent === "Shift-select"
      ) as HTMLButtonElement;
      shiftBtn.click();
      expect(mockToggleFileSelection).toHaveBeenCalledWith("unstaged.ts", false, false, true, [
        "unstaged.ts",
      ]);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("unstaged.ts", false, undefined, undefined);
    });

    it("double-click on an unstaged file stages it", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.doubleClick(screen.getByTestId("file-item-unstaged.ts"));
      expect(mockStageFile).toHaveBeenCalledWith("unstaged.ts");
    });

    it("Toggle button on an unstaged file calls stage", () => {
      render(<UnstagedPanel statuses={sampleStatuses} loading={false} />);
      const item = screen.getByTestId("file-item-unstaged.ts");
      const toggleBtn = [...item.querySelectorAll("button")].find(
        (b) => b.textContent === "Toggle"
      ) as HTMLButtonElement;
      toggleBtn.click();
      expect(mockStageFile).toHaveBeenCalledWith("unstaged.ts");
    });
  });
});

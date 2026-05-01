import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StagedPanel } from "./StagedPanel";
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

describe("StagedPanel", () => {
  const mockUnstageFile = vi.fn();
  const mockUnstageFiles = vi.fn();
  const mockLoadFileDiff = vi.fn();

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
      unstageFile: mockUnstageFile,
      unstageFiles: mockUnstageFiles,
      loadFileDiff: mockLoadFileDiff,
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
    staged: [{ path: "staged.ts", status: "modified", is_staged: true }],
    unstaged: [],
    untracked: [],
  };

  describe("loading & empty states", () => {
    it("shows loading when loading and no statuses", () => {
      render(<StagedPanel statuses={null} loading={true} />);
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows empty message when no statuses and not loading", () => {
      render(<StagedPanel statuses={null} loading={false} />);
      expect(screen.getByText("No repository open")).toBeInTheDocument();
    });

    it("shows empty section message when no staged files", () => {
      render(<StagedPanel statuses={emptyStatuses} loading={false} />);
      expect(screen.getByText("No staged changes")).toBeInTheDocument();
    });
  });

  describe("section rendering", () => {
    it("renders staged section header", () => {
      render(<StagedPanel statuses={emptyStatuses} loading={false} />);
      expect(screen.getByText("Staged")).toBeInTheDocument();
    });

    it("shows file count in header", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      const header = screen.getByText("Staged").closest(".section-header-title");
      expect(header?.querySelector(".section-count")).toHaveTextContent("1");
    });

    it("renders staged file items", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByTestId("file-item-staged.ts")).toBeInTheDocument();
    });

    it("passes isStaged=true to file items", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByTestId("file-item-staged.ts")).toHaveAttribute("data-staged", "true");
    });
  });

  describe("Unstage All button", () => {
    it("shows the All button when there are staged files", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Unstage all staged files" })).toBeInTheDocument();
    });

    it("hides the All button when no staged files", () => {
      render(<StagedPanel statuses={emptyStatuses} loading={false} />);
      expect(screen.queryByRole("button", { name: "Unstage all staged files" })).toBeNull();
    });

    it("calls unstageFiles with all staged paths when clicked", async () => {
      const multi: FileStatuses = {
        staged: [
          { path: "a.ts", status: "modified", is_staged: true },
          { path: "b.ts", status: "added", is_staged: true },
        ],
        unstaged: [],
        untracked: [],
      };
      render(<StagedPanel statuses={multi} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Unstage all staged files" }));
      await waitFor(() => {
        expect(mockUnstageFiles).toHaveBeenCalledWith(["a.ts", "b.ts"]);
      });
    });
  });

  describe("selection actions", () => {
    it("shows the unstage-selected button with the selection count", () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Unstage 1 selected file" })).toBeInTheDocument();
    });

    it("uses plural in aria-label when multiple files are selected", () => {
      const multi: FileStatuses = {
        staged: [
          { path: "a.ts", status: "modified", is_staged: true },
          { path: "b.ts", status: "modified", is_staged: true },
        ],
        unstaged: [],
        untracked: [],
      };
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", true));
      mockSelectedFilePaths.add(makeSelectionKey("b.ts", true));
      setupSelectionStore();
      render(<StagedPanel statuses={multi} loading={false} />);
      expect(screen.getByRole("button", { name: "Unstage 2 selected files" })).toBeInTheDocument();
    });

    it("shows Clear Selection button when files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument();
    });

    it("calls unstageFiles when unstage-selected is clicked", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Unstage 1 selected file" }));
      await waitFor(() => {
        expect(mockUnstageFiles).toHaveBeenCalledWith(["staged.ts"]);
      });
    });

    it("clears selection when Clear is clicked", () => {
      mockSelectedFilePaths.add(makeSelectionKey("staged.ts", true));
      setupSelectionStore();
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS class structure", () => {
      const { container } = render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      expect(container.querySelector(".staged-panel")).toBeInTheDocument();
      expect(container.querySelector(".section-header")).toBeInTheDocument();
      expect(container.querySelector(".section-content")).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    const twoStaged: FileStatuses = {
      staged: [
        { path: "s1.ts", status: "modified", is_staged: true },
        { path: "s2.ts", status: "modified", is_staged: true },
      ],
      unstaged: [],
      untracked: [],
    };

    it("Enter on staged list unstages the file", () => {
      render(<StagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "Enter" });
      expect(mockUnstageFile).toHaveBeenCalledWith("s1.ts");
    });

    it("Space on staged list unstages the file (secondary activate)", () => {
      render(<StagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: " " });
      expect(mockUnstageFile).toHaveBeenCalledWith("s1.ts");
    });

    it("ArrowDown without shift single-selects a staged file", () => {
      render(<StagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      expect(mockSelectSingleFile).toHaveBeenCalledWith("s2.ts", true);
      expect(mockLoadFileDiff).toHaveBeenCalledWith("s2.ts", true);
    });

    it("ArrowDown with shift extends selection on staged list", () => {
      render(<StagedPanel statuses={twoStaged} loading={false} />);
      const list = screen.getByRole("listbox", { name: "Staged files" });
      list.focus();
      fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
      expect(mockToggleFileSelection).toHaveBeenCalledWith("s2.ts", true, false, true, [
        "s1.ts",
        "s2.ts",
      ]);
    });
  });

  describe("staged context menu", () => {
    it("Unstage from context menu unstages", () => {
      const statuses: FileStatuses = {
        staged: [{ path: "s.ts", status: "modified", is_staged: true }],
        unstaged: [],
        untracked: [],
      };
      render(<StagedPanel statuses={statuses} loading={false} />);
      fireEvent.click(screen.getByTestId("menu-Unstage"));
      expect(mockUnstageFile).toHaveBeenCalledWith("s.ts");
    });
  });

  describe("mouse-driven selection", () => {
    it("Shift-click on staged calls toggleFileSelection and loads diff", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
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

    it("double-click on a staged file unstages it", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      fireEvent.doubleClick(screen.getByTestId("file-item-staged.ts"));
      expect(mockUnstageFile).toHaveBeenCalledWith("staged.ts");
    });

    it("Toggle button on a staged file calls unstage", () => {
      render(<StagedPanel statuses={sampleStatuses} loading={false} />);
      const stagedItem = screen.getByTestId("file-item-staged.ts");
      const toggleBtn = [...stagedItem.querySelectorAll("button")].find(
        (b) => b.textContent === "Toggle"
      ) as HTMLButtonElement;
      toggleBtn.click();
      expect(mockUnstageFile).toHaveBeenCalledWith("staged.ts");
    });
  });
});

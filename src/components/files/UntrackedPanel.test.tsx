import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UntrackedPanel } from "./UntrackedPanel";
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
    isUntracked,
    isSelected,
    onToggleStage,
    onSelect,
    onDoubleClick,
    extraMenuItems,
  }: {
    file: { path: string };
    isUntracked?: boolean;
    isSelected?: boolean;
    onToggleStage: () => void;
    onSelect: () => void;
    onDoubleClick: () => void;
    extraMenuItems?: { label: string; onClick: () => void }[];
  }) => (
    <div
      data-testid={`file-item-${file.path}`}
      data-untracked={isUntracked}
      data-selected={isSelected}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <button onClick={onToggleStage}>Toggle</button>
      {file.path}
      {extraMenuItems?.map((item) => (
        <button
          key={item.label}
          data-testid={`menu-${file.path}-${item.label}`}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

describe("UntrackedPanel", () => {
  const mockStageFile = vi.fn();
  const mockStageFiles = vi.fn();
  const mockLoadFileDiff = vi.fn();
  const mockDeleteFile = vi.fn();
  const mockDeleteFiles = vi.fn();

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
      deleteFile: mockDeleteFile,
      deleteFiles: mockDeleteFiles,
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

  const statusesWithUntracked: FileStatuses = {
    staged: [],
    unstaged: [],
    untracked: [{ path: "new-file.ts", status: "untracked", is_staged: false }],
  };

  describe("rendering conditions", () => {
    it("returns null when loading and no statuses", () => {
      const { container } = render(<UntrackedPanel statuses={null} loading={true} />);

      expect(container.firstChild).toBeNull();
    });

    it("returns null when no statuses and not loading", () => {
      const { container } = render(<UntrackedPanel statuses={null} loading={false} />);

      expect(container.firstChild).toBeNull();
    });

    it("renders when statuses exist", () => {
      render(<UntrackedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.getByText("Untracked")).toBeInTheDocument();
    });

    it("renders when loading but statuses exist", () => {
      render(<UntrackedPanel statuses={emptyStatuses} loading={true} />);

      expect(screen.getByText("Untracked")).toBeInTheDocument();
    });
  });

  describe("section rendering", () => {
    it("renders untracked section header", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      expect(screen.getByText("Untracked")).toBeInTheDocument();
    });

    it("shows file count in section header", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      const header = screen.getByText("Untracked").closest(".section-header");
      expect(header?.querySelector(".section-count")).toHaveTextContent("1");
    });

    it("shows zero count when no untracked files", () => {
      render(<UntrackedPanel statuses={emptyStatuses} loading={false} />);

      const header = screen.getByText("Untracked").closest(".section-header");
      expect(header?.querySelector(".section-count")).toHaveTextContent("0");
    });

    it("always shows all files (no collapsibility)", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      // File should be visible
      expect(screen.getByTestId("file-item-new-file.ts")).toBeInTheDocument();
    });
  });

  describe("Stage All button", () => {
    it("shows Stage All button when there are untracked files", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      expect(screen.getByText("Stage All")).toBeInTheDocument();
    });

    it("hides Stage All button when no untracked files", () => {
      render(<UntrackedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.queryByText("Stage All")).not.toBeInTheDocument();
    });

    it("calls stageFiles with all untracked file paths when clicked", async () => {
      const statusesMultiple: FileStatuses = {
        staged: [],
        unstaged: [],
        untracked: [
          { path: "new1.ts", status: "untracked", is_staged: false },
          { path: "new2.ts", status: "untracked", is_staged: false },
        ],
      };

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      fireEvent.click(screen.getByText("Stage All"));

      await waitFor(() => {
        expect(mockStageFiles).toHaveBeenCalledWith(["new1.ts", "new2.ts"]);
        expect(mockStageFiles).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("empty section", () => {
    it("shows empty message when no untracked files", () => {
      render(<UntrackedPanel statuses={emptyStatuses} loading={false} />);

      expect(screen.getByText("No untracked files")).toBeInTheDocument();
    });
  });

  describe("file items", () => {
    it("passes isUntracked prop to files", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      const fileItem = screen.getByTestId("file-item-new-file.ts");
      expect(fileItem).toHaveAttribute("data-untracked", "true");
    });

    it("renders file name", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      expect(screen.getByText("new-file.ts")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS class", () => {
      const { container } = render(
        <UntrackedPanel statuses={statusesWithUntracked} loading={false} />
      );

      expect(container.querySelector(".untracked-panel")).toBeInTheDocument();
    });

    it("section header is not clickable", () => {
      const { container } = render(
        <UntrackedPanel statuses={statusesWithUntracked} loading={false} />
      );

      // Header should not have clickable class
      expect(container.querySelector(".section-header.clickable")).not.toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("renders a listbox for untracked files", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      expect(screen.getByRole("listbox", { name: "Untracked files" })).toBeInTheDocument();
    });

    it("stages file on Enter key", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      const listbox = screen.getByRole("listbox", { name: "Untracked files" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "Enter" });

      expect(mockStageFile).toHaveBeenCalledWith("new-file.ts");
    });

    it("deletes file on Delete key", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      const listbox = screen.getByRole("listbox", { name: "Untracked files" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "Delete" });

      expect(mockDeleteFile).toHaveBeenCalledWith("new-file.ts");
    });

    it("loads diff on arrow navigation", () => {
      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      const listbox = screen.getByRole("listbox", { name: "Untracked files" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });

      expect(mockLoadFileDiff).toHaveBeenCalledWith("new-file.ts", false, true);
    });
  });

  describe("selection actions in header", () => {
    it("shows Stage Selected button when files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("new-file.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      expect(screen.getByText("Stage Selected")).toBeInTheDocument();
    });

    it("shows Clear button when files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("new-file.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      expect(screen.getByRole("button", { name: "Clear selection" })).toBeInTheDocument();
    });

    it("calls stageFiles when Stage Selected is clicked", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("new-file.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      fireEvent.click(screen.getByText("Stage Selected"));

      await waitFor(() => {
        expect(mockStageFiles).toHaveBeenCalledWith(["new-file.ts"]);
      });
    });

    it("clears selection when Clear is clicked", () => {
      mockSelectedFilePaths.add(makeSelectionKey("new-file.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesWithUntracked} loading={false} />);

      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });

  describe("batch delete", () => {
    const statusesMultiple: FileStatuses = {
      staged: [],
      unstaged: [],
      untracked: [
        { path: "a.ts", status: "untracked", is_staged: false },
        { path: "b.ts", status: "untracked", is_staged: false },
        { path: "c.ts", status: "untracked", is_staged: false },
      ],
    };

    it("does not show Delete Selected when nothing is selected", () => {
      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      expect(screen.queryByText("Delete Selected")).not.toBeInTheDocument();
    });

    it("shows Delete Selected when one or more files are selected", () => {
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      expect(screen.getByText("Delete Selected")).toBeInTheDocument();
    });

    it("calls deleteFiles with all selected paths and clears selection", async () => {
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("c.ts", false));
      setupSelectionStore();
      mockDeleteFiles.mockResolvedValue(undefined);

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      fireEvent.click(screen.getByText("Delete Selected"));

      await waitFor(() => {
        expect(mockDeleteFiles).toHaveBeenCalledWith(["a.ts", "c.ts"]);
        expect(mockClearFileSelection).toHaveBeenCalled();
      });
    });

    it("Delete key on a multi-selected file deletes the entire selection", () => {
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("b.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      const listbox = screen.getByRole("listbox", { name: "Untracked files" });
      // Default activeIndex is 0 (a.ts)
      fireEvent.keyDown(listbox, { key: "Delete" });

      expect(mockDeleteFiles).toHaveBeenCalledWith(["a.ts", "b.ts"]);
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it("Delete key on a non-selected file deletes only that file", () => {
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("b.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      const listbox = screen.getByRole("listbox", { name: "Untracked files" });
      // Move active to c.ts which is NOT in the multi-selection
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "Delete" });

      expect(mockDeleteFile).toHaveBeenCalledWith("c.ts");
      expect(mockDeleteFiles).not.toHaveBeenCalled();
    });

    it("right-click on a multi-selected file uses the batch delete menu entry", () => {
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("b.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      fireEvent.click(screen.getByTestId("menu-a.ts-Delete 2 files"));

      expect(mockDeleteFiles).toHaveBeenCalledWith(["a.ts", "b.ts"]);
    });

    it("right-click on an unselected file uses the single-file delete menu entry", () => {
      mockSelectedFilePaths.add(makeSelectionKey("a.ts", false));
      mockSelectedFilePaths.add(makeSelectionKey("b.ts", false));
      setupSelectionStore();

      render(<UntrackedPanel statuses={statusesMultiple} loading={false} />);

      fireEvent.click(screen.getByTestId("menu-c.ts-Delete file"));

      expect(mockDeleteFile).toHaveBeenCalledWith("c.ts");
      expect(mockDeleteFiles).not.toHaveBeenCalled();
    });
  });
});

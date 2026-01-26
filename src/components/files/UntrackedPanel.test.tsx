import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UntrackedPanel } from "./UntrackedPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
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
  }: {
    file: { path: string };
    isUntracked?: boolean;
    isSelected?: boolean;
    onToggleStage: () => void;
    onSelect: () => void;
    onDoubleClick: () => void;
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
    </div>
  ),
}));

describe("UntrackedPanel", () => {
  const mockStageFile = vi.fn();
  const mockStageFiles = vi.fn();
  const mockLoadFileDiff = vi.fn();
  const mockDeleteFile = vi.fn();

  const mockToggleFileSelection = vi.fn();
  const mockClearFileSelection = vi.fn();
  const mockSelectedFilePaths = new Set<string>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedFilePaths.clear();
    setupStore();
    setupSelectionStore();
  });

  function setupStore() {
    const state = {
      stageFile: mockStageFile,
      stageFiles: mockStageFiles,
      loadFileDiff: mockLoadFileDiff,
      deleteFile: mockDeleteFile,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) => {
      return selector(state);
    });
  }

  function setupSelectionStore() {
    const state = {
      selectedFilePaths: mockSelectedFilePaths,
      toggleFileSelection: mockToggleFileSelection,
      clearFileSelection: mockClearFileSelection,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useSelectionStore).mockImplementation((selector: any) => {
      return selector(state);
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

      expect(screen.getByText("Clear")).toBeInTheDocument();
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

      fireEvent.click(screen.getByText("Clear"));

      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });
});

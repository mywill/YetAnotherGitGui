import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StagedUnstagedPanel } from "./StagedUnstagedPanel";
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
    isStaged,
    isSelected,
    onToggleStage,
    onSelect,
    onDoubleClick,
  }: {
    file: { path: string };
    isStaged: boolean;
    isSelected?: boolean;
    onToggleStage: () => void;
    onSelect: () => void;
    onDoubleClick: () => void;
  }) => (
    <div
      data-testid={`file-item-${file.path}`}
      data-staged={isStaged}
      data-selected={isSelected}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <button onClick={onToggleStage}>Toggle</button>
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
      unstageFile: mockUnstageFile,
      stageFiles: mockStageFiles,
      unstageFiles: mockUnstageFiles,
      loadFileDiff: mockLoadFileDiff,
      revertFile: mockRevertFile,
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

      expect(screen.getByText("Clear")).toBeInTheDocument();
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

      fireEvent.click(screen.getByText("Clear"));

      expect(mockClearFileSelection).toHaveBeenCalled();
    });
  });
});

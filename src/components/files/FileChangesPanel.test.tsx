import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FileChangesPanel } from "./FileChangesPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import type { FileStatuses } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

// Mock the selection store
vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
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
});

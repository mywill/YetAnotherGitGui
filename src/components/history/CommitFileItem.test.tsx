import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitFileItem } from "./CommitFileItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import type { CommitFileChange } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

// Mock dialog store
vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

const mockFile: CommitFileChange = {
  path: "src/main.ts",
  status: "modified",
  old_path: undefined,
};

const mockToggleExpanded = vi.fn();
const mockLoadDiff = vi.fn();
const mockRevertCommitFile = vi.fn().mockResolvedValue(undefined);
const mockShowConfirm = vi.fn().mockResolvedValue(true);

describe("CommitFileItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          expandedCommitFiles: new Set<string>(),
          commitFileDiffs: new Map(),
          toggleCommitFileExpanded: mockToggleExpanded,
          loadCommitFileDiff: mockLoadDiff,
          revertCommitFile: mockRevertCommitFile,
        };
        return selector(state);
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDialogStore).mockImplementation((selector: any) =>
      selector({ showConfirm: mockShowConfirm })
    );
  });

  it("renders file path", () => {
    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
  });

  it("shows M status icon for modified files", () => {
    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows A status icon for added files", () => {
    const addedFile = { ...mockFile, status: "added" as const };
    render(<CommitFileItem file={addedFile} commitHash="abc123" />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows D status icon for deleted files", () => {
    const deletedFile = { ...mockFile, status: "deleted" as const };
    render(<CommitFileItem file={deletedFile} commitHash="abc123" />);

    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("shows R status icon for renamed files", () => {
    const renamedFile: CommitFileChange = {
      path: "src/new-name.ts",
      status: "renamed",
      old_path: "src/old-name.ts",
    };
    render(<CommitFileItem file={renamedFile} commitHash="abc123" />);

    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("displays old path for renamed files", () => {
    const renamedFile: CommitFileChange = {
      path: "src/new-name.ts",
      status: "renamed",
      old_path: "src/old-name.ts",
    };
    render(<CommitFileItem file={renamedFile} commitHash="abc123" />);

    expect(screen.getByText("src/old-name.ts → src/new-name.ts")).toBeInTheDocument();
  });

  it("shows collapsed expand icon by default", () => {
    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    expect(screen.getByText("▶")).toBeInTheDocument();
  });

  it("toggles expanded state on click", () => {
    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    const header = screen.getByText("src/main.ts").closest(".file-header");
    fireEvent.click(header!);

    expect(mockToggleExpanded).toHaveBeenCalledWith("src/main.ts");
  });

  it("loads diff when expanding for the first time", () => {
    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    const header = screen.getByText("src/main.ts").closest(".file-header");
    fireEvent.click(header!);

    expect(mockLoadDiff).toHaveBeenCalledWith("abc123", "src/main.ts");
  });

  it("shows expanded icon when file is expanded", () => {
    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          expandedCommitFiles: new Set(["src/main.ts"]),
          commitFileDiffs: new Map(),
          toggleCommitFileExpanded: mockToggleExpanded,
          loadCommitFileDiff: mockLoadDiff,
        };
        return selector(state);
      }
    );

    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("shows loading message when expanded but diff not loaded", () => {
    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          expandedCommitFiles: new Set(["src/main.ts"]),
          commitFileDiffs: new Map(),
          toggleCommitFileExpanded: mockToggleExpanded,
          loadCommitFileDiff: mockLoadDiff,
        };
        return selector(state);
      }
    );

    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    expect(screen.getByText(/loading diff/i)).toBeInTheDocument();
  });

  it("does not reload diff if already loaded", () => {
    const mockDiff = {
      path: "src/main.ts",
      hunks: [],
      is_binary: false,
    };

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          expandedCommitFiles: new Set<string>(),
          commitFileDiffs: new Map([["src/main.ts", mockDiff]]),
          toggleCommitFileExpanded: mockToggleExpanded,
          loadCommitFileDiff: mockLoadDiff,
          revertCommitFile: mockRevertCommitFile,
        };
        return selector(state);
      }
    );

    render(<CommitFileItem file={mockFile} commitHash="abc123" />);

    const header = screen.getByText("src/main.ts").closest(".file-header");
    fireEvent.click(header!);

    // Should toggle but not reload
    expect(mockToggleExpanded).toHaveBeenCalled();
    expect(mockLoadDiff).not.toHaveBeenCalled();
  });

  describe("revert file button", () => {
    it("renders Revert button on each file", () => {
      render(<CommitFileItem file={mockFile} commitHash="abc123" />);

      expect(screen.getByText("Revert")).toBeInTheDocument();
    });

    it("shows confirmation dialog with correct wording when Revert is clicked", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileItem file={mockFile} commitHash="abc123def456789" />);

      fireEvent.click(screen.getByText("Revert"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith({
          title: "Revert file",
          message: expect.stringContaining('undo changes to "src/main.ts" from commit abc123d'),
          confirmLabel: "Revert",
        });
      });
    });

    it("includes 'stage the result' in dialog message", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileItem file={mockFile} commitHash="abc123def456789" />);

      fireEvent.click(screen.getByText("Revert"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("stage the result"),
          })
        );
      });
    });

    it("calls revertCommitFile on confirm", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<CommitFileItem file={mockFile} commitHash="abc123def456789" />);

      fireEvent.click(screen.getByText("Revert"));

      await waitFor(() => {
        expect(mockRevertCommitFile).toHaveBeenCalledWith("abc123def456789", "src/main.ts");
      });
    });

    it("does not call revertCommitFile when dialog is cancelled", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileItem file={mockFile} commitHash="abc123def456789" />);

      fireEvent.click(screen.getByText("Revert"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
      expect(mockRevertCommitFile).not.toHaveBeenCalled();
    });

    it("stops event propagation to prevent toggling expand", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitFileItem file={mockFile} commitHash="abc123" />);

      fireEvent.click(screen.getByText("Revert"));

      // The toggle should NOT have been called because stopPropagation prevents it
      expect(mockToggleExpanded).not.toHaveBeenCalled();
    });
  });
});

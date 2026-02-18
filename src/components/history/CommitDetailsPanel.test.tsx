import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitDetailsPanel } from "./CommitDetailsPanel";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import type { CommitDetails } from "../../types";

// Mock stores
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

// Mock CommitFileItem to avoid deep dependency chain
vi.mock("./CommitFileItem", () => ({
  CommitFileItem: ({ file }: { file: { path: string }; commitHash: string }) => (
    <div data-testid="commit-file-item">{file.path}</div>
  ),
}));

const mockCommitDetails: CommitDetails = {
  hash: "abc123def456789012345678901234567890abcd",
  message: "Add new feature\n\nThis is a detailed description of the commit.",
  author_name: "Test Author",
  author_email: "test@example.com",
  committer_name: "Test Committer",
  committer_email: "committer@example.com",
  timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  parent_hashes: ["parent123abc"],
  files_changed: [
    { path: "src/main.ts", status: "modified", old_path: undefined },
    { path: "src/new-file.ts", status: "added", old_path: undefined },
    { path: "src/old-file.ts", status: "deleted", old_path: undefined },
  ],
};

describe("CommitDetailsPanel", () => {
  const mockRevertCommit = vi.fn().mockResolvedValue(undefined);
  const mockSetActiveView = vi.fn();
  const mockShowConfirm = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) =>
      selector({ revertCommit: mockRevertCommit })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useSelectionStore).mockImplementation((selector: any) =>
      selector({ setActiveView: mockSetActiveView })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useDialogStore).mockImplementation((selector: any) =>
      selector({ showConfirm: mockShowConfirm })
    );
  });

  it("shows empty state when no commit is selected", () => {
    render(<CommitDetailsPanel details={null} loading={false} />);

    expect(screen.getByText(/select a commit/i)).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<CommitDetailsPanel details={null} loading={true} />);

    expect(screen.getByText(/loading commit details/i)).toBeInTheDocument();
  });

  it("displays commit hash", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("abc123def456")).toBeInTheDocument();
  });

  it("displays commit message", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText(/add new feature/i)).toBeInTheDocument();
  });

  it("displays author information", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText(/test author/i)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
  });

  it("displays relative date", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    // Should show something like "about 1 hour ago"
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it("displays parent hash", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("parent1")).toBeInTheDocument();
  });

  it("displays file count", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // 3 files changed
  });

  it("displays file paths", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();
    expect(screen.getByText("src/old-file.ts")).toBeInTheDocument();
  });

  it("shows files changed header", () => {
    render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

    expect(screen.getByText(/files changed/i)).toBeInTheDocument();
  });

  it("handles commit with no parent (initial commit)", () => {
    const initialCommit = {
      ...mockCommitDetails,
      parent_hashes: [],
    };
    render(<CommitDetailsPanel details={initialCommit} loading={false} />);

    // Should not crash and should not show parent section
    expect(screen.queryByText(/parent/i)).not.toBeInTheDocument();
  });

  it("handles commit with multiple parents (merge commit)", () => {
    const mergeCommit = {
      ...mockCommitDetails,
      parent_hashes: ["parent1abc", "parent2def"],
    };
    render(<CommitDetailsPanel details={mergeCommit} loading={false} />);

    // Parent hashes are shown truncated to 7 chars
    expect(screen.getByText("parent1")).toBeInTheDocument();
    expect(screen.getByText("parent2")).toBeInTheDocument();
  });

  describe("revert commit button", () => {
    it("renders Revert commit button when commit is displayed", () => {
      render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

      expect(screen.getByText("Revert commit")).toBeInTheDocument();
    });

    it("does not render Revert commit button when no commit is selected", () => {
      render(<CommitDetailsPanel details={null} loading={false} />);

      expect(screen.queryByText("Revert commit")).not.toBeInTheDocument();
    });

    it("shows confirmation dialog with correct wording when clicked", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith({
          title: "Revert commit",
          message: expect.stringContaining(
            "This will create new changes that undo this commit and stage them."
          ),
          confirmLabel: "Revert",
        });
      });
    });

    it("includes short hash in dialog message", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("abc123d"),
          })
        );
      });
    });

    it("calls revertCommit and switches to status view on confirm", async () => {
      mockShowConfirm.mockResolvedValue(true);

      render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockRevertCommit).toHaveBeenCalledWith("abc123def456789012345678901234567890abcd");
      });
      expect(mockSetActiveView).toHaveBeenCalledWith("status");
    });

    it("does not call revertCommit when dialog is cancelled", async () => {
      mockShowConfirm.mockResolvedValue(false);

      render(<CommitDetailsPanel details={mockCommitDetails} loading={false} />);

      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
      expect(mockRevertCommit).not.toHaveBeenCalled();
      expect(mockSetActiveView).not.toHaveBeenCalled();
    });
  });
});

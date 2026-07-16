import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchItem } from "./BranchItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { mockStore } from "../../test/mockStores";
import { copyToClipboard } from "../../services/clipboard";
import type { BranchInfo } from "../../types";

// Mock the stores
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(() => vi.fn()),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("../../stores/worktreeStore", () => ({
  useWorktreeStore: vi.fn((selector?: (s: unknown) => unknown) =>
    selector
      ? selector({ openAddDialog: mockOpenWorktreeAddDialog })
      : { openAddDialog: mockOpenWorktreeAddDialog }
  ),
}));

const mockCheckoutBranch = vi.fn();
const mockDeleteBranch = vi.fn();
const mockShowConfirm = vi.fn();
const mockOpenWorktreeAddDialog = vi.fn();

describe("BranchItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowConfirm.mockResolvedValue(true);

    mockStore(useRepositoryStore, {
      checkoutBranch: mockCheckoutBranch,
      deleteBranch: mockDeleteBranch,
    });
    mockStore(useDialogStore, { showConfirm: mockShowConfirm });
  });

  it("renders local branch name", () => {
    const branch: BranchInfo = {
      name: "feature/test",
      is_remote: false,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    expect(screen.getByText("feature/test")).toBeInTheDocument();
  });

  it("renders remote branch without origin prefix", () => {
    const branch: BranchInfo = {
      name: "origin/main",
      is_remote: true,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows current badge for head branch", () => {
    const branch: BranchInfo = {
      name: "main",
      is_remote: false,
      is_head: true,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it("does not show current badge for non-head branch", () => {
    const branch: BranchInfo = {
      name: "feature/test",
      is_remote: false,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    expect(screen.queryByText("current")).not.toBeInTheDocument();
  });

  it("shows confirmation dialog on double-click for local branch", async () => {
    const branch: BranchInfo = {
      name: "feature/test",
      is_remote: false,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("feature/test").closest(".branch-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("feature/test"),
        })
      );
    });
  });

  it("checks out branch when confirmed", async () => {
    const branch: BranchInfo = {
      name: "feature/test",
      is_remote: false,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("feature/test").closest(".branch-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockCheckoutBranch).toHaveBeenCalledWith("feature/test");
    });
  });

  it("does not checkout when confirmation is cancelled", async () => {
    mockShowConfirm.mockResolvedValue(false);

    const branch: BranchInfo = {
      name: "feature/test",
      is_remote: false,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("feature/test").closest(".branch-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });
    expect(mockCheckoutBranch).not.toHaveBeenCalled();
  });

  it("does not checkout if already on branch (is_head)", () => {
    const branch: BranchInfo = {
      name: "main",
      is_remote: false,
      is_head: true,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("main").closest(".branch-item");
    fireEvent.doubleClick(item!);

    expect(mockShowConfirm).not.toHaveBeenCalled();
    expect(mockCheckoutBranch).not.toHaveBeenCalled();
  });

  it("shows dialog for remote branch instead of checkout", async () => {
    const branch: BranchInfo = {
      name: "origin/feature",
      is_remote: true,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("feature").closest(".branch-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Remote Branch",
        })
      );
    });
    expect(mockCheckoutBranch).not.toHaveBeenCalled();
  });

  it("has is-current class when is_head is true", () => {
    const branch: BranchInfo = {
      name: "main",
      is_remote: false,
      is_head: true,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("main").closest(".branch-item");
    expect(item).toHaveClass("is-current");
  });

  it("has is-remote class for remote branches", () => {
    const branch: BranchInfo = {
      name: "origin/main",
      is_remote: true,
      is_head: false,
      target_hash: "abc123",
    };
    render(<BranchItem branch={branch} />);

    const item = screen.getByText("main").closest(".branch-item");
    expect(item).toHaveClass("is-remote");
  });

  describe("context menu", () => {
    it("opens context menu on right-click", async () => {
      const branch: BranchInfo = {
        name: "feature/test",
        is_remote: false,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature/test").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
        expect(screen.getByText("Checkout")).toBeInTheDocument();
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
    });

    it("copy name copies branch name to clipboard", async () => {
      const branch: BranchInfo = {
        name: "feature/test",
        is_remote: false,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature/test").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Copy Name"));

      expect(copyToClipboard).toHaveBeenCalledWith("feature/test");
    });

    it("opens the worktree add dialog with the branch preset", async () => {
      const branch: BranchInfo = {
        name: "feature/test",
        is_remote: false,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature/test").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("New worktree from this branch…")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("New worktree from this branch…"));

      expect(mockOpenWorktreeAddDialog).toHaveBeenCalledWith({ branch: "feature/test" });
    });

    it("copy name copies full remote branch name to clipboard", async () => {
      const branch: BranchInfo = {
        name: "origin/feature",
        is_remote: true,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Copy Name"));

      expect(copyToClipboard).toHaveBeenCalledWith("origin/feature");
    });

    it("checkout menu item triggers checkout confirmation", async () => {
      const branch: BranchInfo = {
        name: "feature/test",
        is_remote: false,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature/test").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Checkout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Checkout"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Switch Branch",
          })
        );
      });
    });

    it("delete menu item shows confirmation dialog", async () => {
      const branch: BranchInfo = {
        name: "feature/test",
        is_remote: false,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature/test").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Delete Branch",
            message: 'Delete branch "feature/test"?',
          })
        );
      });
    });

    it("delete calls deleteBranch when confirmed", async () => {
      const branch: BranchInfo = {
        name: "feature/test",
        is_remote: false,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature/test").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockDeleteBranch).toHaveBeenCalledWith("feature/test", false);
      });
    });

    it("delete shows origin mention for remote branches", async () => {
      const branch: BranchInfo = {
        name: "origin/feature",
        is_remote: true,
        is_head: false,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("feature").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Delete branch "origin/feature" from origin?',
          })
        );
      });
    });

    it("checkout and delete are disabled for HEAD branch", async () => {
      const branch: BranchInfo = {
        name: "main",
        is_remote: false,
        is_head: true,
        target_hash: "abc123",
      };
      render(<BranchItem branch={branch} />);

      const item = screen.getByText("main").closest(".branch-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Checkout")).toBeInTheDocument();
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      const checkoutItem = screen.getByText("Checkout").closest(".context-menu-item");
      const deleteItem = screen.getByText("Delete").closest(".context-menu-item");

      expect(checkoutItem).toHaveClass("disabled");
      expect(deleteItem).toHaveClass("disabled");
    });
  });

  describe("secondary line", () => {
    it("shows upstream tracking info on a local branch with upstream", () => {
      const branch: BranchInfo = {
        name: "main",
        is_remote: false,
        is_head: true,
        target_hash: "abc",
        upstream: "origin/main",
      };
      const { container } = render(<BranchItem branch={branch} />);
      expect(container.querySelector(".branch-item-upstream")).toHaveTextContent(/origin\/main/);
    });

    it("renders ahead and behind counts when both are present", () => {
      const branch: BranchInfo = {
        name: "main",
        is_remote: false,
        is_head: true,
        target_hash: "abc",
        upstream: "origin/main",
        ahead: 3,
        behind: 1,
      };
      render(<BranchItem branch={branch} />);
      expect(screen.getByLabelText("3 ahead, 1 behind")).toBeInTheDocument();
      expect(screen.getByText("+3")).toBeInTheDocument();
      expect(screen.getByText("-1")).toBeInTheDocument();
    });

    it("does not render ahead/behind for remote branches", () => {
      const branch: BranchInfo = {
        name: "origin/main",
        is_remote: true,
        is_head: false,
        target_hash: "abc",
        ahead: 5,
        behind: 2,
      };
      const { container } = render(<BranchItem branch={branch} />);
      expect(container.querySelector(".ahead-behind")).toBeNull();
    });

    it("falls back to last commit time when no upstream is set", () => {
      const branch: BranchInfo = {
        name: "feature/x",
        is_remote: false,
        is_head: false,
        target_hash: "abc",
        upstream: null,
        last_commit_time: Math.floor(Date.now() / 1000) - 7200,
      };
      const { container } = render(<BranchItem branch={branch} />);
      expect(container.querySelector(".branch-item-date")).toHaveTextContent(/ago/);
      expect(container.querySelector(".branch-item-upstream")).toBeNull();
    });

    it("renders no secondary metadata when no upstream and no last_commit_time", () => {
      const branch: BranchInfo = {
        name: "stale",
        is_remote: false,
        is_head: false,
        target_hash: "abc",
      };
      const { container } = render(<BranchItem branch={branch} />);
      expect(container.querySelector(".branch-item-upstream")).toBeNull();
      expect(container.querySelector(".branch-item-date")).toBeNull();
    });
  });
});

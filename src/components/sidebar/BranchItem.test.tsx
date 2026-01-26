import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BranchItem } from "./BranchItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
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

const mockCheckoutBranch = vi.fn();
const mockDeleteBranch = vi.fn();
const mockShowConfirm = vi.fn();

describe("BranchItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowConfirm.mockResolvedValue(true);

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          checkoutBranch: mockCheckoutBranch,
          deleteBranch: mockDeleteBranch,
        };
        return selector(state);
      }
    );

    (useDialogStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          showConfirm: mockShowConfirm,
        };
        return selector(state);
      }
    );
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
});

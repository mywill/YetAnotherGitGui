import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StashItem } from "./StashItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { copyToClipboard } from "../../services/clipboard";
import type { StashInfo, StashDetails } from "../../types";

// Mock the stores
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

const mockLoadStashDetails = vi.fn();
const mockApplyStash = vi.fn();
const mockDropStash = vi.fn();
const mockSetActiveView = vi.fn();
const mockShowConfirm = vi.fn();

let mockSelectedStashDetails: StashDetails | null = null;

describe("StashItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowConfirm.mockResolvedValue(true);
    mockSelectedStashDetails = null;

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          loadStashDetails: mockLoadStashDetails,
          applyStash: mockApplyStash,
          dropStash: mockDropStash,
          selectedStashDetails: mockSelectedStashDetails,
        };
        return selector(state);
      }
    );

    (useSelectionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          setActiveView: mockSetActiveView,
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

  it("renders stash name", () => {
    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash message",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    expect(screen.getByText("stash@{0}")).toBeInTheDocument();
  });

  it("renders shortened message", () => {
    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash message",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    expect(screen.getByText("Test stash message")).toBeInTheDocument();
  });

  it("truncates long messages", () => {
    const stash: StashInfo = {
      index: 0,
      message:
        "WIP on main: abc123 This is a very long stash message that should be truncated after forty characters",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    // Check that the message is truncated with ellipsis
    const messageElement = screen.getByText(/This is a very long stash message that/);
    expect(messageElement.textContent).toContain("...");
  });

  it("calls loadStashDetails on click", () => {
    const stash: StashInfo = {
      index: 2,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{2}").closest(".stash-item");
    fireEvent.click(item!);

    expect(mockLoadStashDetails).toHaveBeenCalledWith(2);
  });

  it("switches to status view on click", () => {
    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{0}").closest(".stash-item");
    fireEvent.click(item!);

    expect(mockSetActiveView).toHaveBeenCalledWith("status");
  });

  it("has is-selected class when stash is selected", () => {
    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };

    mockSelectedStashDetails = {
      index: 0,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
      files_changed: [],
    };

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          loadStashDetails: mockLoadStashDetails,
          applyStash: mockApplyStash,
          dropStash: mockDropStash,
          selectedStashDetails: mockSelectedStashDetails,
        };
        return selector(state);
      }
    );

    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{0}").closest(".stash-item");
    expect(item).toHaveClass("is-selected");
  });

  it("does not have is-selected class when different stash is selected", () => {
    const stash: StashInfo = {
      index: 1,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };

    mockSelectedStashDetails = {
      index: 0,
      message: "WIP on main: abc123 Different stash",
      commit_hash: "different123",
      timestamp: 1700000000,
      branch_name: "main",
      files_changed: [],
    };

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          loadStashDetails: mockLoadStashDetails,
          applyStash: mockApplyStash,
          dropStash: mockDropStash,
          selectedStashDetails: mockSelectedStashDetails,
        };
        return selector(state);
      }
    );

    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{1}").closest(".stash-item");
    expect(item).not.toHaveClass("is-selected");
  });

  it("shows confirmation dialog on double-click", async () => {
    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{0}").closest(".stash-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Apply Stash",
          message: expect.stringContaining("stash@{0}"),
        })
      );
    });
  });

  it("applies stash when confirmed", async () => {
    const stash: StashInfo = {
      index: 1,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{1}").closest(".stash-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockApplyStash).toHaveBeenCalledWith(1);
    });
  });

  it("does not apply stash when confirmation is cancelled", async () => {
    mockShowConfirm.mockResolvedValue(false);

    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{0}").closest(".stash-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });
    expect(mockApplyStash).not.toHaveBeenCalled();
  });

  it("has title attribute with full message", () => {
    const stash: StashInfo = {
      index: 0,
      message: "WIP on main: abc123 Test stash message",
      commit_hash: "abc123def456",
      timestamp: 1700000000,
      branch_name: "main",
    };
    render(<StashItem stash={stash} />);

    const item = screen.getByText("stash@{0}").closest(".stash-item");
    expect(item).toHaveAttribute("title", "WIP on main: abc123 Test stash message");
  });

  describe("context menu", () => {
    it("opens context menu on right-click", async () => {
      const stash: StashInfo = {
        index: 0,
        message: "WIP on main: abc123 Test stash",
        commit_hash: "abc123def456",
        timestamp: 1700000000,
        branch_name: "main",
      };
      render(<StashItem stash={stash} />);

      const item = screen.getByText("stash@{0}").closest(".stash-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
        expect(screen.getByText("Apply")).toBeInTheDocument();
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
    });

    it("copy name copies stash name to clipboard", async () => {
      const stash: StashInfo = {
        index: 2,
        message: "WIP on main: abc123 Test stash",
        commit_hash: "abc123def456",
        timestamp: 1700000000,
        branch_name: "main",
      };
      render(<StashItem stash={stash} />);

      const item = screen.getByText("stash@{2}").closest(".stash-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Copy Name"));

      expect(copyToClipboard).toHaveBeenCalledWith("stash@{2}");
    });

    it("apply menu item triggers apply confirmation", async () => {
      const stash: StashInfo = {
        index: 0,
        message: "WIP on main: abc123 Test stash",
        commit_hash: "abc123def456",
        timestamp: 1700000000,
        branch_name: "main",
      };
      render(<StashItem stash={stash} />);

      const item = screen.getByText("stash@{0}").closest(".stash-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Apply")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Apply"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Apply Stash",
          })
        );
      });
    });

    it("delete menu item shows confirmation dialog", async () => {
      const stash: StashInfo = {
        index: 0,
        message: "WIP on main: abc123 Test stash",
        commit_hash: "abc123def456",
        timestamp: 1700000000,
        branch_name: "main",
      };
      render(<StashItem stash={stash} />);

      const item = screen.getByText("stash@{0}").closest(".stash-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Delete Stash",
            message: expect.stringContaining("stash@{0}"),
          })
        );
      });
    });

    it("delete calls dropStash when confirmed", async () => {
      const stash: StashInfo = {
        index: 1,
        message: "WIP on main: abc123 Test stash",
        commit_hash: "abc123def456",
        timestamp: 1700000000,
        branch_name: "main",
      };
      render(<StashItem stash={stash} />);

      const item = screen.getByText("stash@{1}").closest(".stash-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockDropStash).toHaveBeenCalledWith(1);
      });
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TagItem } from "./TagItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { copyToClipboard } from "../../services/clipboard";
import type { TagInfo } from "../../types";

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

const mockCheckoutCommit = vi.fn();
const mockDeleteTag = vi.fn();
const mockShowConfirm = vi.fn();

describe("TagItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowConfirm.mockResolvedValue(true);

    (useRepositoryStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: unknown) => unknown) => {
        const state = {
          checkoutCommit: mockCheckoutCommit,
          deleteTag: mockDeleteTag,
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

  it("renders tag name", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("shows annotated badge for annotated tags", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123",
      is_annotated: true,
      message: "Release v1.0.0",
    };
    render(<TagItem tag={tag} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("does not show annotated badge for lightweight tags", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("shows confirmation dialog on double-click", async () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123def",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    const item = screen.getByText("v1.0.0").closest(".tag-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("v1.0.0"),
        })
      );
    });
  });

  it("checks out commit when confirmed", async () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123def",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    const item = screen.getByText("v1.0.0").closest(".tag-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockCheckoutCommit).toHaveBeenCalledWith("abc123def");
    });
  });

  it("does not checkout when confirmation is cancelled", async () => {
    mockShowConfirm.mockResolvedValue(false);

    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123def",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    const item = screen.getByText("v1.0.0").closest(".tag-item");
    fireEvent.doubleClick(item!);

    await waitFor(() => {
      expect(mockShowConfirm).toHaveBeenCalled();
    });
    expect(mockCheckoutCommit).not.toHaveBeenCalled();
  });

  it("has title attribute with tag message for annotated tags", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123",
      is_annotated: true,
      message: "Release v1.0.0",
    };
    render(<TagItem tag={tag} />);

    const item = screen.getByText("v1.0.0").closest(".tag-item");
    expect(item).toHaveAttribute("title", "Release v1.0.0");
  });

  it("has title attribute with tag name for lightweight tags", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    const item = screen.getByText("v1.0.0").closest(".tag-item");
    expect(item).toHaveAttribute("title", "v1.0.0");
  });

  describe("context menu", () => {
    it("opens context menu on right-click", async () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc123",
        is_annotated: false,
        message: undefined,
      };
      render(<TagItem tag={tag} />);

      const item = screen.getByText("v1.0.0").closest(".tag-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
        expect(screen.getByText("Checkout")).toBeInTheDocument();
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });
    });

    it("copy name copies tag name to clipboard", async () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc123",
        is_annotated: false,
        message: undefined,
      };
      render(<TagItem tag={tag} />);

      const item = screen.getByText("v1.0.0").closest(".tag-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Copy Name")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Copy Name"));

      expect(copyToClipboard).toHaveBeenCalledWith("v1.0.0");
    });

    it("checkout menu item triggers checkout confirmation", async () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc123",
        is_annotated: false,
        message: undefined,
      };
      render(<TagItem tag={tag} />);

      const item = screen.getByText("v1.0.0").closest(".tag-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Checkout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Checkout"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Checkout Tag",
          })
        );
      });
    });

    it("delete menu item shows confirmation dialog", async () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc123",
        is_annotated: false,
        message: undefined,
      };
      render(<TagItem tag={tag} />);

      const item = screen.getByText("v1.0.0").closest(".tag-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Delete Tag",
            message: 'Delete tag "v1.0.0"?',
          })
        );
      });
    });

    it("delete calls deleteTag when confirmed", async () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc123",
        is_annotated: false,
        message: undefined,
      };
      render(<TagItem tag={tag} />);

      const item = screen.getByText("v1.0.0").closest(".tag-item");
      fireEvent.contextMenu(item!);

      await waitFor(() => {
        expect(screen.getByText("Delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(mockDeleteTag).toHaveBeenCalledWith("v1.0.0");
      });
    });
  });
});

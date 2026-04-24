import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TagItem } from "./TagItem";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { mockStore } from "../../test/mockStores";
import { copyToClipboard } from "../../services/clipboard";
import type { TagInfo } from "../../types";

// Mock the stores
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

const mockSelectAndScrollToCommit = vi.fn();
vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ selectAndScrollToCommit: mockSelectAndScrollToCommit })
  ),
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

    mockStore(useRepositoryStore, {
      checkoutCommit: mockCheckoutCommit,
      deleteTag: mockDeleteTag,
    });
    mockStore(useDialogStore, { showConfirm: mockShowConfirm });
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

  it("click on tag with target_hash scrolls to its target commit", () => {
    const tag: TagInfo = {
      name: "v1.0.0",
      target_hash: "abc123",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    fireEvent.click(screen.getByText("v1.0.0"));
    expect(mockSelectAndScrollToCommit).toHaveBeenCalledWith("abc123");
  });

  it("click on tag with no target_hash does not scroll", () => {
    const tag: TagInfo = {
      name: "dangling-tag",
      target_hash: "",
      is_annotated: false,
      message: undefined,
    };
    render(<TagItem tag={tag} />);

    fireEvent.click(screen.getByText("dangling-tag"));
    expect(mockSelectAndScrollToCommit).not.toHaveBeenCalled();
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

  describe("secondary line", () => {
    it("shows tagger name and relative time for annotated tag with full metadata", () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc",
        is_annotated: true,
        message: "Release",
        tagger_name: "Alice",
        tagger_time: Math.floor(Date.now() / 1000) - 86400 * 7,
      };
      const { container } = render(<TagItem tag={tag} />);
      expect(container.querySelector(".tag-item-tagger")).toHaveTextContent("Alice");
      expect(container.querySelector(".tag-item-date")).toHaveTextContent(/ago/);
    });

    it("shows just the tagger name when no tagger_time is present", () => {
      const tag: TagInfo = {
        name: "v1.0.0",
        target_hash: "abc",
        is_annotated: true,
        tagger_name: "Bob",
        tagger_time: null,
      };
      const { container } = render(<TagItem tag={tag} />);
      expect(container.querySelector(".tag-item-tagger")).toHaveTextContent("Bob");
      expect(container.querySelector(".tag-item-date")).toBeNull();
    });

    it("renders no secondary metadata for lightweight (non-annotated) tags", () => {
      const tag: TagInfo = {
        name: "v0.9.0",
        target_hash: "abc",
        is_annotated: false,
        last_commit_summary: "Initial commit",
      };
      const { container } = render(<TagItem tag={tag} />);
      // Single-line layout: lightweight tags only show name + (no badge, no
      // tagger). The last_commit_summary still surfaces via the title attribute.
      expect(container.querySelector(".tag-item-tagger")).toBeNull();
      expect(container.querySelector(".tag-item-date")).toBeNull();
    });

    it("renders no tagger or date metadata when annotated tag has no tagger info", () => {
      const tag: TagInfo = {
        name: "bare",
        target_hash: "abc",
        is_annotated: true,
      };
      const { container } = render(<TagItem tag={tag} />);
      expect(container.querySelector(".tag-item-tagger")).toBeNull();
      expect(container.querySelector(".tag-item-date")).toBeNull();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommitRow } from "./CommitRow";
import type { GraphCommit } from "../../types";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";

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

// Mock BranchLines component
vi.mock("./BranchLines", () => ({
  BranchLines: ({ commit }: { commit: GraphCommit }) => (
    <div data-testid="branch-lines" data-column={commit.column}>
      BranchLines
    </div>
  ),
}));

// Mock ContextMenu component
vi.mock("../common/ContextMenu", () => ({
  ContextMenu: ({
    items,
    onClose,
  }: {
    x: number;
    y: number;
    items: Array<{ label: string; onClick: () => void }>;
    onClose: () => void;
  }) => (
    <div data-testid="context-menu">
      {items.map((item) => (
        <button key={item.label} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock clipboard service
vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

describe("CommitRow", () => {
  const mockOnSelect = vi.fn();
  const mockOnDoubleClick = vi.fn();
  const mockRevertCommit = vi.fn().mockResolvedValue(undefined);
  const mockSetActiveView = vi.fn();
  const mockShowConfirm = vi.fn().mockResolvedValue(true);

  const createMockCommit = (overrides: Partial<GraphCommit> = {}): GraphCommit => ({
    hash: "abc123def456789",
    short_hash: "abc123d",
    message: "Test commit message",
    author_name: "Test Author",
    author_email: "test@example.com",
    timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    parent_hashes: [],
    column: 0,
    lines: [],
    refs: [],
    is_tip: false,
    ...overrides,
  });

  const defaultProps = {
    style: { top: 0, position: "absolute" as const },
    commit: createMockCommit(),
    isSelected: false,
    isHead: false,
    onSelect: mockOnSelect,
    onDoubleClick: mockOnDoubleClick,
  };

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

  describe("rendering", () => {
    it("renders commit message", () => {
      render(<CommitRow {...defaultProps} />);

      expect(screen.getByText("Test commit message")).toBeInTheDocument();
    });

    it("renders author name", () => {
      render(<CommitRow {...defaultProps} />);

      expect(screen.getByText("Test Author")).toBeInTheDocument();
    });

    it("renders relative time", () => {
      render(<CommitRow {...defaultProps} />);

      // Should show "1 hour ago" or similar
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it("renders BranchLines component", () => {
      render(<CommitRow {...defaultProps} />);

      expect(screen.getByTestId("branch-lines")).toBeInTheDocument();
    });

    it("applies style prop", () => {
      const { container } = render(
        <CommitRow {...defaultProps} style={{ top: 100, position: "absolute" as const }} />
      );

      const row = container.querySelector(".commit-row");
      expect(row).toHaveStyle({ top: "100px", position: "absolute" });
    });
  });

  describe("selected state", () => {
    it("applies selected class when isSelected is true", () => {
      const { container } = render(<CommitRow {...defaultProps} isSelected={true} />);

      expect(container.querySelector(".commit-row.selected")).toBeInTheDocument();
    });

    it("does not apply selected class when isSelected is false", () => {
      const { container } = render(<CommitRow {...defaultProps} isSelected={false} />);

      expect(container.querySelector(".commit-row.selected")).not.toBeInTheDocument();
    });
  });

  describe("HEAD badge", () => {
    it("shows HEAD badge when isHead is true", () => {
      render(<CommitRow {...defaultProps} isHead={true} />);

      expect(screen.getByText("HEAD")).toBeInTheDocument();
    });

    it("hides HEAD badge when isHead is false", () => {
      render(<CommitRow {...defaultProps} isHead={false} />);

      expect(screen.queryByText("HEAD")).not.toBeInTheDocument();
    });

    it("HEAD badge has correct CSS class", () => {
      const { container } = render(<CommitRow {...defaultProps} isHead={true} />);

      expect(container.querySelector(".head-badge")).toBeInTheDocument();
    });

    it("applies is-head class to row when isHead is true", () => {
      const { container } = render(<CommitRow {...defaultProps} isHead={true} />);

      expect(container.querySelector(".commit-row.is-head")).toBeInTheDocument();
    });
  });

  describe("ref badges", () => {
    it("renders branch ref badges", () => {
      const commit = createMockCommit({
        refs: [{ name: "main", ref_type: "branch", is_head: false }],
      });

      render(<CommitRow {...defaultProps} commit={commit} />);

      expect(screen.getByText("main")).toBeInTheDocument();
    });

    it("renders multiple ref badges", () => {
      const commit = createMockCommit({
        refs: [
          { name: "main", ref_type: "branch", is_head: true },
          { name: "feature", ref_type: "branch", is_head: false },
        ],
      });

      render(<CommitRow {...defaultProps} commit={commit} />);

      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("feature")).toBeInTheDocument();
    });

    it("applies correct CSS class for ref type", () => {
      const commit = createMockCommit({
        refs: [
          { name: "main", ref_type: "branch", is_head: false },
          { name: "v1.0.0", ref_type: "tag", is_head: false },
        ],
      });

      const { container } = render(<CommitRow {...defaultProps} commit={commit} />);

      expect(container.querySelector(".ref-badge.ref-branch")).toBeInTheDocument();
      expect(container.querySelector(".ref-badge.ref-tag")).toBeInTheDocument();
    });

    it("applies is-head class to head branch ref", () => {
      const commit = createMockCommit({
        refs: [{ name: "main", ref_type: "branch", is_head: true }],
      });

      const { container } = render(<CommitRow {...defaultProps} commit={commit} />);

      expect(container.querySelector(".ref-badge.is-head")).toBeInTheDocument();
    });
  });

  describe("click handling", () => {
    it("calls onSelect when row is clicked", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.click(row!);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it("calls onDoubleClick on double click", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      // Simulate double click via mouseDown with detail=2
      fireEvent.mouseDown(row!, { detail: 2 });

      expect(mockOnDoubleClick).toHaveBeenCalledTimes(1);
    });

    it("prevents default on double click", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");

      const event = new MouseEvent("mousedown", {
        detail: 2,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      row!.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("context menu", () => {
    it("shows context menu on right click", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    });

    it("shows copy hash option in context menu", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      expect(screen.getByText("Copy commit hash")).toBeInTheDocument();
    });

    it("shows checkout option in context menu", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      expect(screen.getByText("Checkout commit")).toBeInTheDocument();
    });

    it("calls onDoubleClick when checkout is clicked", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      fireEvent.click(screen.getByText("Checkout commit"));

      expect(mockOnDoubleClick).toHaveBeenCalledTimes(1);
    });

    it("closes context menu after checkout", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      expect(screen.getByTestId("context-menu")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Checkout commit"));

      // After clicking, context menu should close
      expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
    });

    it("closes context menu when close is clicked", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      fireEvent.click(screen.getByText("Close"));

      expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS classes", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      expect(container.querySelector(".commit-row")).toBeInTheDocument();
      expect(container.querySelector(".graph-col")).toBeInTheDocument();
      expect(container.querySelector(".message-col")).toBeInTheDocument();
      expect(container.querySelector(".author-col")).toBeInTheDocument();
      expect(container.querySelector(".date-col")).toBeInTheDocument();
    });

    it("commit message has correct CSS class", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      expect(container.querySelector(".commit-message")).toBeInTheDocument();
    });
  });

  describe("date tooltip", () => {
    it("shows full date in title attribute", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const dateCol = container.querySelector(".date-col");
      expect(dateCol).toHaveAttribute("title");
      // The title should contain a locale-formatted date
      expect(dateCol?.getAttribute("title")).toBeTruthy();
    });
  });

  describe("revert commit", () => {
    it("shows Revert commit option in context menu", () => {
      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);

      expect(screen.getByText("Revert commit")).toBeInTheDocument();
    });

    it("shows confirmation dialog with correct wording when Revert commit is clicked", async () => {
      mockShowConfirm.mockResolvedValue(false);

      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);
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

    it("includes short hash and message in confirmation dialog", async () => {
      mockShowConfirm.mockResolvedValue(false);

      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);
      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('abc123d: "Test commit message"'),
          })
        );
      });
    });

    it("calls revertCommit and switches to status view on confirm", async () => {
      mockShowConfirm.mockResolvedValue(true);

      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);
      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockRevertCommit).toHaveBeenCalledWith("abc123def456789");
      });
      expect(mockSetActiveView).toHaveBeenCalledWith("status");
    });

    it("does not call revertCommit when dialog is cancelled", async () => {
      mockShowConfirm.mockResolvedValue(false);

      const { container } = render(<CommitRow {...defaultProps} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);
      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalled();
      });
      expect(mockRevertCommit).not.toHaveBeenCalled();
      expect(mockSetActiveView).not.toHaveBeenCalled();
    });

    it("truncates long commit messages in dialog", async () => {
      const longMessage = "A".repeat(70);
      const commit = createMockCommit({ message: longMessage });
      mockShowConfirm.mockResolvedValue(false);

      const { container } = render(<CommitRow {...defaultProps} commit={commit} />);

      const row = container.querySelector(".commit-row");
      fireEvent.contextMenu(row!);
      fireEvent.click(screen.getByText("Revert commit"));

      await waitFor(() => {
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining("..."),
          })
        );
      });
    });
  });
});

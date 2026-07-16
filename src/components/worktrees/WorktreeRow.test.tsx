import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorktreeRow } from "./WorktreeRow";
import { useWorktreeStore } from "../../stores/worktreeStore";
import type { WorktreeInfo } from "../../types";

const {
  mockRevealItemInDir,
  mockOpenPath,
  mockDialogOpen,
  mockOpenRepository,
  mockSetActiveView,
  mockOpenInCwd,
  mockRemoveWorktree,
  mockMoveWorktree,
  mockLockWorktree,
  mockUnlockWorktree,
} = vi.hoisted(() => ({
  mockRevealItemInDir: vi.fn().mockResolvedValue(undefined),
  mockOpenPath: vi.fn().mockResolvedValue(undefined),
  mockDialogOpen: vi.fn().mockResolvedValue(null),
  mockOpenRepository: vi.fn(),
  mockSetActiveView: vi.fn(),
  mockOpenInCwd: vi.fn(),
  mockRemoveWorktree: vi.fn(),
  mockMoveWorktree: vi.fn(),
  mockLockWorktree: vi.fn(),
  mockUnlockWorktree: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: mockRevealItemInDir,
  openPath: mockOpenPath,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mockDialogOpen,
}));

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn((selector?: (s: unknown) => unknown) =>
    selector
      ? selector({ openRepository: mockOpenRepository })
      : { openRepository: mockOpenRepository }
  ),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn((selector?: (s: unknown) => unknown) =>
    selector ? selector({ setActiveView: mockSetActiveView }) : { setActiveView: mockSetActiveView }
  ),
}));

vi.mock("../../stores/terminalStore", () => ({
  useTerminalStore: vi.fn((selector?: (s: unknown) => unknown) =>
    selector ? selector({ openInCwd: mockOpenInCwd }) : { openInCwd: mockOpenInCwd }
  ),
}));

vi.mock("../common/ContextMenu", () => ({
  ContextMenu: ({ items }: { items: { label: string; onClick: () => void }[] }) => (
    <div data-testid="ctx-menu">
      {items.map((it) => (
        <button key={it.label} onClick={it.onClick} data-testid={`ctx-${it.label}`}>
          {it.label}
        </button>
      ))}
    </div>
  ),
}));

const linkedWt: WorktreeInfo = {
  name: "feature",
  path: "/repo-wt",
  is_main: false,
  branch: "feature",
  head_hash: "def",
  is_valid: true,
  is_locked: false,
  lock_reason: null,
  is_prunable: false,
  dirty_count: 3,
  ahead: 2,
  behind: 1,
  last_commit_summary: "feat",
  last_commit_author: "you",
  last_commit_time: 2000,
};

describe("WorktreeRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorktreeStore.setState({
      worktrees: [],
      loading: false,
      addDialogOpen: false,
      addDialogPreset: null,
      removeWorktree: mockRemoveWorktree,
      moveWorktree: mockMoveWorktree,
      lockWorktree: mockLockWorktree,
      unlockWorktree: mockUnlockWorktree,
    });
  });

  it("renders the worktree name, branch, and dirty count", () => {
    render(<WorktreeRow worktree={linkedWt} />);
    expect(screen.getAllByText("feature").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("↑2")).toBeInTheDocument();
    expect(screen.getByText("↓1")).toBeInTheDocument();
  });

  it("opens the worktree in-app on double-click", async () => {
    mockOpenRepository.mockResolvedValue(undefined);
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.doubleClick(screen.getAllByText("feature")[0]);
    await waitFor(() => expect(mockOpenRepository).toHaveBeenCalledWith("/repo-wt"));
    expect(mockSetActiveView).toHaveBeenCalledWith("status");
  });

  it("opens a terminal at the worktree path via the terminal button", () => {
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.click(screen.getByRole("button", { name: /Open feature in terminal/i }));
    expect(mockOpenInCwd).toHaveBeenCalledWith("/repo-wt");
  });

  it("calls revealItemInDir for the reveal button", async () => {
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.click(screen.getByRole("button", { name: /Reveal feature in file manager/i }));
    await waitFor(() => expect(mockRevealItemInDir).toHaveBeenCalledWith("/repo-wt"));
  });

  it("shows a locked indicator and lock reason title", () => {
    render(<WorktreeRow worktree={{ ...linkedWt, is_locked: true, lock_reason: "wip" }} />);
    expect(screen.getByTitle("Locked: wip")).toBeInTheDocument();
  });

  it("shows an invalid/prunable indicator when the worktree dir is gone", () => {
    render(<WorktreeRow worktree={{ ...linkedWt, is_valid: false }} />);
    expect(screen.getByTitle("Worktree directory missing — prunable")).toBeInTheDocument();
  });

  it("opens the context menu and triggers remove", () => {
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.contextMenu(screen.getAllByText("feature")[0]);
    fireEvent.click(screen.getByTestId("ctx-Remove…"));
    expect(mockRemoveWorktree).toHaveBeenCalledWith("feature", false);
  });

  it("opens the context menu and triggers lock", () => {
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.contextMenu(screen.getAllByText("feature")[0]);
    fireEvent.click(screen.getByTestId("ctx-Lock"));
    expect(mockLockWorktree).toHaveBeenCalledWith("feature", "locked via yagg");
  });

  it("opens the context menu and triggers unlock for a locked worktree", () => {
    render(<WorktreeRow worktree={{ ...linkedWt, is_locked: true }} />);
    fireEvent.contextMenu(screen.getAllByText("feature")[0]);
    fireEvent.click(screen.getByTestId("ctx-Unlock"));
    expect(mockUnlockWorktree).toHaveBeenCalledWith("feature");
  });

  it("opens the context menu and triggers move, choosing a new dir", async () => {
    mockDialogOpen.mockResolvedValueOnce("/chosen");
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.contextMenu(screen.getAllByText("feature")[0]);
    fireEvent.click(screen.getByTestId("ctx-Move…"));
    await waitFor(() => expect(mockDialogOpen).toHaveBeenCalled());
    expect(mockMoveWorktree).toHaveBeenCalledWith("feature", "/chosen/feature");
  });

  it("triggers openPath from the Open Folder context menu item", async () => {
    render(<WorktreeRow worktree={linkedWt} />);
    fireEvent.contextMenu(screen.getAllByText("feature")[0]);
    fireEvent.click(screen.getByTestId("ctx-Open Folder"));
    await waitFor(() => expect(mockOpenPath).toHaveBeenCalledWith("/repo-wt"));
  });
});

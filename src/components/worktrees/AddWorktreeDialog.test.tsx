import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddWorktreeDialog } from "./AddWorktreeDialog";

const mockAddWorktree = vi.fn().mockResolvedValue(true);
const mockCloseAddDialog = vi.fn();

vi.mock("../../stores/worktreeStore", () => ({
  useWorktreeStore: Object.assign(
    vi.fn((selector?: (s: unknown) => unknown) =>
      selector
        ? selector({
            addDialogPreset: null,
            addWorktree: mockAddWorktree,
            closeAddDialog: mockCloseAddDialog,
          })
        : {
            addDialogPreset: null,
            addWorktree: mockAddWorktree,
            closeAddDialog: mockCloseAddDialog,
          }
    ),
    { setState: vi.fn(), getState: vi.fn() }
  ),
}));

const mockBranches = [
  { name: "main", is_remote: false },
  { name: "feature", is_remote: false },
];

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn((selector?: (s: unknown) => unknown) =>
    selector
      ? selector({ branches: mockBranches, repositoryInfo: { path: "/repo" } })
      : { branches: mockBranches, repositoryInfo: { path: "/repo" } }
  ),
}));

const mockSetWorktreesDefaultParentDir = vi.fn();

vi.mock("../../stores/settingsStore", () => ({
  useSettingsStore: vi.fn((selector?: (s: unknown) => unknown) =>
    selector
      ? selector({
          worktreesDefaultParentDir: null,
          setWorktreesDefaultParentDir: mockSetWorktreesDefaultParentDir,
        })
      : {
          worktreesDefaultParentDir: null,
          setWorktreesDefaultParentDir: mockSetWorktreesDefaultParentDir,
        }
  ),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue("/chosen"),
}));

vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

describe("AddWorktreeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddWorktree.mockResolvedValue(true);
  });

  it("renders the dialog title and mode buttons", () => {
    render(<AddWorktreeDialog />);
    expect(screen.getByText("Add Worktree")).toBeInTheDocument();
    expect(screen.getByText("Existing branch")).toBeInTheDocument();
    expect(screen.getByText("New branch")).toBeInTheDocument();
    expect(screen.getByText("Detached")).toBeInTheDocument();
  });

  it("closes on Cancel", () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockCloseAddDialog).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    render(<AddWorktreeDialog />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockCloseAddDialog).toHaveBeenCalled();
  });

  it("switches to new-branch mode and shows the new-branch input", () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("New branch"));
    expect(screen.getByPlaceholderText("e.g. feature/login")).toBeInTheDocument();
  });

  it("switches to detached mode and shows the commit-hash input", () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("Detached"));
    expect(screen.getByPlaceholderText("HEAD")).toBeInTheDocument();
  });

  it("submits with the new-branch mode", async () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("New branch"));
    const input = screen.getByPlaceholderText("e.g. feature/login");
    fireEvent.change(input, { target: { value: "feat/x" } });
    fireEvent.click(screen.getByText("Create worktree"));
    await waitFor(() => expect(mockAddWorktree).toHaveBeenCalled());
    const args = mockAddWorktree.mock.calls[0][0];
    expect(args.newBranch).toBe("feat/x");
    expect(args.branch).toBeNull();
  });

  it("disables Create when the new-branch name is empty in new-branch mode", () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("New branch"));
    const createBtn = screen.getByText("Create worktree").closest("button");
    expect(createBtn).toBeDisabled();
  });

  it("browse sets the parent dir and persists it", async () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("Browse…"));
    await waitFor(() => expect(mockSetWorktreesDefaultParentDir).toHaveBeenCalledWith("/chosen"));
  });

  it("copies the destination path to the clipboard", async () => {
    const { copyToClipboard } = await import("../../services/clipboard");
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalled());
  });

  it("submits in existing-branch mode with the selected branch", async () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("Existing branch"));
    fireEvent.click(screen.getByText("Create worktree"));
    await waitFor(() => expect(mockAddWorktree).toHaveBeenCalled());
    const args = mockAddWorktree.mock.calls[0][0];
    expect(args.branch).toBe("main");
    expect(args.newBranch).toBeNull();
  });

  it("shows the single-checkout hint in existing-branch mode", () => {
    render(<AddWorktreeDialog />);
    fireEvent.click(screen.getByText("Existing branch"));
    expect(screen.getByText(/one worktree at a time/i)).toBeInTheDocument();
  });

  it("updates name, parent dir, and detached commit hash via inputs", () => {
    render(<AddWorktreeDialog />);
    // Detached commit hash
    fireEvent.click(screen.getByText("Detached"));
    const hashInput = screen.getByPlaceholderText("HEAD");
    fireEvent.change(hashInput, { target: { value: "abc1234" } });
    expect((hashInput as HTMLInputElement).value).toBe("abc1234");

    // Worktree name
    const nameInput = screen.getByLabelText("Worktree name");
    fireEvent.change(nameInput, { target: { value: "custom-name" } });
    expect((nameInput as HTMLInputElement).value).toBe("custom-name");

    // Parent dir
    const parentInput = screen.getByLabelText("Parent directory");
    fireEvent.change(parentInput, { target: { value: "/tmp/wts" } });
    expect((parentInput as HTMLInputElement).value).toBe("/tmp/wts");
  });
});

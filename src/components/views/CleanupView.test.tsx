import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { CleanupView } from "./CleanupView";
import { useCleanupStore } from "../../stores/cleanupStore";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";

/** Force every cleanup section open so we can probe their inner controls. */
function expandAllSections() {
  useSettingsStore.setState({
    sectionExpanded: {
      "cleanup.prune": true,
      "cleanup.gone": true,
      "cleanup.merged": true,
      "cleanup.stashes": true,
      "cleanup.untracked": true,
    },
  });
}

vi.mock("../../services/git", () => ({
  listGoneBranches: vi.fn().mockResolvedValue([]),
  listMergedBranches: vi.fn().mockResolvedValue([]),
  listOldStashes: vi.fn().mockResolvedValue([]),
  listUntrackedFiles: vi.fn().mockResolvedValue([]),
  deleteBranches: vi.fn().mockResolvedValue([]),
  dropStashes: vi.fn().mockResolvedValue([]),
  cleanUntrackedFiles: vi.fn().mockResolvedValue([]),
  pruneRemote: vi.fn().mockResolvedValue([]),
}));

// Wait one microtask cycle so the on-mount refreshAll resolves before tests
// overwrite candidate state.
async function flushMount() {
  await act(async () => {
    await Promise.resolve();
  });
}

const showConfirmMock = vi.fn();

function resetStores() {
  useCleanupStore.setState({
    gone: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
    merged: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
    stashes: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
    untracked: {
      candidates: [],
      selected: new Set(),
      loading: false,
      lastResult: null,
      lastSelectedId: null,
    },
  });
  useRepositoryStore.setState({
    repositoryInfo: {
      path: "/test",
      current_branch: "main",
      is_detached: false,
      remotes: ["origin"],
      head_hash: "abc",
      repo_state: "clean",
    },
  });
  useDialogStore.setState({ showConfirm: showConfirmMock });
}

describe("CleanupView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showConfirmMock.mockReset();
    resetStores();
    expandAllSections();
  });

  it("renders all four sections plus prune remote", async () => {
    render(<CleanupView />);
    expect(screen.getByText("Cleanup")).toBeInTheDocument();
    expect(screen.getByText("Branches with deleted remote")).toBeInTheDocument();
    expect(screen.getByText("Merged branches")).toBeInTheDocument();
    expect(screen.getByText("Stashes older than 30 days")).toBeInTheDocument();
    expect(screen.getByText("Untracked files")).toBeInTheDocument();
    expect(screen.getByText("Prune remote refs")).toBeInTheDocument();
    expect(screen.getByText("origin")).toBeInTheDocument();
  });

  it("starts with all sections collapsed by default", () => {
    // Reset settings so sectionExpanded is empty.
    useSettingsStore.setState({ sectionExpanded: {} });
    render(<CleanupView />);
    // Headers are visible (always rendered)
    expect(screen.getByText("Branches with deleted remote")).toBeInTheDocument();
    // ...but inner descriptions are hidden when collapsed
    expect(screen.queryByText("Local branches whose remote was deleted.")).not.toBeInTheDocument();
  });

  it("clicking the section header toggles expanded state", () => {
    useSettingsStore.setState({ sectionExpanded: {} });
    render(<CleanupView />);
    const toggle = screen.getByRole("button", {
      name: "Toggle Branches with deleted remote",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Local branches whose remote was deleted.")).toBeInTheDocument();
  });

  it("hides the prune section when no remotes are configured", () => {
    useRepositoryStore.setState({
      repositoryInfo: {
        path: "/test",
        current_branch: "main",
        is_detached: false,
        remotes: [],
        head_hash: "abc",
        repo_state: "clean",
      },
    });
    render(<CleanupView />);
    expect(screen.queryByText("Prune remote refs")).not.toBeInTheDocument();
  });

  it("shows '(N selected)' badge in collapsed header when items are selected", async () => {
    useSettingsStore.setState({ sectionExpanded: {} });
    render(<CleanupView />);
    await flushMount();
    act(() => {
      useCleanupStore.setState({
        gone: {
          candidates: [{ name: "feature/x", is_remote: false, is_head: false, target_hash: "" }],
          selected: new Set(["feature/x"]),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
    });
    expect(screen.getByText("(1 selected)")).toBeInTheDocument();
  });

  it("disables the run button when nothing is selected", async () => {
    render(<CleanupView />);
    await flushMount();
    act(() => {
      useCleanupStore.setState({
        gone: {
          candidates: [{ name: "feature/x", is_remote: false, is_head: false, target_hash: "" }],
          selected: new Set(),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
    });
    // 0-selected: button label is "Delete 0 selected"
    const runBtn = screen.getAllByRole("button", { name: /Delete 0 selected/i })[0];
    expect(runBtn).toBeDisabled();
  });

  it("enables the run button when something is selected", async () => {
    render(<CleanupView />);
    await flushMount();
    act(() => {
      useCleanupStore.setState({
        gone: {
          candidates: [{ name: "feature/x", is_remote: false, is_head: false, target_hash: "" }],
          selected: new Set(["feature/x"]),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
    });
    const runBtn = screen.getAllByRole("button", { name: /Delete\s+\d+\s+selected/i })[0];
    expect(runBtn).not.toBeDisabled();
  });

  it("shows a confirm dialog before running, and aborts on cancel", async () => {
    showConfirmMock.mockResolvedValue(false);
    render(<CleanupView />);
    await flushMount();
    act(() => {
      useCleanupStore.setState({
        gone: {
          candidates: [{ name: "feature/x", is_remote: false, is_head: false, target_hash: "" }],
          selected: new Set(["feature/x"]),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Delete\s+\d+\s+selected/i })[0]);
    await waitFor(() => expect(showConfirmMock).toHaveBeenCalled());
    // No delete call should fire when the dialog returns false.
    const git = await import("../../services/git");
    expect(git.deleteBranches).not.toHaveBeenCalled();
  });

  it("surfaces per-item failures from lastResult", async () => {
    render(<CleanupView />);
    await flushMount();
    act(() => {
      useCleanupStore.setState({
        gone: {
          candidates: [],
          selected: new Set(),
          loading: false,
          lastResult: [
            { item: "feature/x", success: false, error: "ref locked" },
            { item: "feature/y", success: true, error: null },
          ],
          lastSelectedId: null,
        },
      });
    });
    expect(screen.getByText(/Last run: 1 succeeded, 1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/ref locked/)).toBeInTheDocument();
  });

  it("toggles select-all / select-none on the header button", async () => {
    render(<CleanupView />);
    await flushMount();
    act(() => {
      useCleanupStore.setState({
        merged: {
          candidates: [
            { name: "a", is_remote: false, is_head: false, target_hash: "" },
            { name: "b", is_remote: false, is_head: false, target_hash: "" },
          ],
          selected: new Set(),
          loading: false,
          lastResult: null,
          lastSelectedId: null,
        },
      });
    });
    const selectAllBtn = screen.getAllByRole("button", { name: /Select all/i })[0];
    fireEvent.click(selectAllBtn);
    expect(useCleanupStore.getState().merged.selected.size).toBe(2);
  });

  describe("row selection (plain/Ctrl/Shift)", () => {
    async function setupThreeRows() {
      render(<CleanupView />);
      await flushMount();
      act(() => {
        useCleanupStore.setState({
          gone: {
            candidates: [
              { name: "a", is_remote: false, is_head: false, target_hash: "" },
              { name: "b", is_remote: false, is_head: false, target_hash: "" },
              { name: "c", is_remote: false, is_head: false, target_hash: "" },
            ],
            selected: new Set(),
            loading: false,
            lastResult: null,
            lastSelectedId: null,
          },
        });
      });
    }

    it("plain click selects a single row", async () => {
      await setupThreeRows();
      fireEvent.click(screen.getByRole("option", { name: /^a/ }));
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a"]));
    });

    it("plain click on the only-selected row deselects it", async () => {
      await setupThreeRows();
      const rowA = screen.getByRole("option", { name: /^a/ });
      fireEvent.click(rowA);
      fireEvent.click(rowA);
      expect(useCleanupStore.getState().gone.selected.size).toBe(0);
    });

    it("ctrl-click toggles a row in/out of the selection", async () => {
      await setupThreeRows();
      const rowA = screen.getByRole("option", { name: /^a/ });
      const rowB = screen.getByRole("option", { name: /^b/ });
      fireEvent.click(rowA);
      fireEvent.click(rowB, { ctrlKey: true });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a", "b"]));
      fireEvent.click(rowA, { ctrlKey: true });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["b"]));
    });

    it("shift-click selects a range from the anchor", async () => {
      await setupThreeRows();
      fireEvent.click(screen.getByRole("option", { name: /^a/ }));
      fireEvent.click(screen.getByRole("option", { name: /^c/ }), { shiftKey: true });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a", "b", "c"]));
    });

    it("shift-click below-up reverses range correctly", async () => {
      await setupThreeRows();
      fireEvent.click(screen.getByRole("option", { name: /^c/ }));
      fireEvent.click(screen.getByRole("option", { name: /^a/ }), { shiftKey: true });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a", "b", "c"]));
    });
  });

  describe("keyboard navigation", () => {
    async function setupThreeRowsAndGetListbox() {
      render(<CleanupView />);
      await flushMount();
      act(() => {
        useCleanupStore.setState({
          gone: {
            candidates: [
              { name: "a", is_remote: false, is_head: false, target_hash: "" },
              { name: "b", is_remote: false, is_head: false, target_hash: "" },
              { name: "c", is_remote: false, is_head: false, target_hash: "" },
            ],
            selected: new Set(),
            loading: false,
            lastResult: null,
            lastSelectedId: null,
          },
        });
      });
      // The "gone" section's listbox is the first one rendered with role=listbox.
      return screen.getAllByRole("listbox")[0];
    }

    it("Space toggles selection on the active row", async () => {
      const list = await setupThreeRowsAndGetListbox();
      fireEvent.keyDown(list, { key: " " });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a"]));
      fireEvent.keyDown(list, { key: " " });
      expect(useCleanupStore.getState().gone.selected.size).toBe(0);
    });

    it("ArrowDown moves the active row, Space then selects it", async () => {
      const list = await setupThreeRowsAndGetListbox();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      fireEvent.keyDown(list, { key: " " });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["b"]));
    });

    it("Shift+ArrowDown extends selection from the anchor", async () => {
      const list = await setupThreeRowsAndGetListbox();
      // Set an anchor at row 'a' first (Space sets lastSelectedId via toggleSelection).
      fireEvent.keyDown(list, { key: " " });
      fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
      fireEvent.keyDown(list, { key: "ArrowDown", shiftKey: true });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a", "b", "c"]));
    });

    it("End jumps to the last row", async () => {
      const list = await setupThreeRowsAndGetListbox();
      fireEvent.keyDown(list, { key: "End" });
      fireEvent.keyDown(list, { key: " " });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["c"]));
    });

    it("Home jumps to the first row", async () => {
      const list = await setupThreeRowsAndGetListbox();
      fireEvent.keyDown(list, { key: "End" });
      fireEvent.keyDown(list, { key: "Home" });
      fireEvent.keyDown(list, { key: " " });
      expect(useCleanupStore.getState().gone.selected).toEqual(new Set(["a"]));
    });
  });
});

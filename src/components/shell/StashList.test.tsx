import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StashList } from "./StashList";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { mockStore } from "../../test/mockStores";
import type { StashInfo } from "../../types";
import { runQuickCleanup } from "../../utils/cleanupActions";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));
vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));
vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
}));
vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));
vi.mock("../../utils/cleanupActions", () => ({
  runQuickCleanup: vi.fn(),
}));

const loadStashDetails = vi.fn();
const applyStash = vi.fn();
const dropStash = vi.fn();
const loadStashes = vi.fn();
const showConfirm = vi.fn();
const setActiveView = vi.fn();

const stashes: StashInfo[] = [
  {
    index: 0,
    message: "WIP on main: first",
    commit_hash: "aaa",
    timestamp: Math.floor(Date.now() / 1000),
    branch_name: "main",
  },
  {
    index: 1,
    message: "WIP on main: second",
    commit_hash: "bbb",
    timestamp: Math.floor(Date.now() / 1000),
    branch_name: "main",
  },
];

describe("StashList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore(useRepositoryStore, {
      stashes,
      loadStashDetails,
      applyStash,
      dropStash,
      loadStashes,
      selectedStashDetails: null,
    });
    mockStore(useDialogStore, { showConfirm });
    mockStore(useSelectionStore, { setActiveView });
  });

  it("renders empty state when there are no stashes", () => {
    mockStore(useRepositoryStore, {
      stashes: [],
      loadStashDetails,
      applyStash,
      dropStash,
      selectedStashDetails: null,
    });
    render(<StashList />);
    expect(screen.getByText(/no stashes/i)).toBeInTheDocument();
  });

  it("renders one row per stash", () => {
    render(<StashList />);
    expect(screen.getByText("stash@{0}")).toBeInTheDocument();
    expect(screen.getByText("stash@{1}")).toBeInTheDocument();
  });

  it("loads stash details when a row is activated via Enter", () => {
    render(<StashList />);
    const list = screen.getByRole("listbox", { name: "Stashes" });
    list.focus();
    fireEvent.keyDown(list, { key: "Enter" });
    expect(loadStashDetails).toHaveBeenCalledWith(0);
  });

  it("prompts and applies on secondary activate (Space) when confirmed", async () => {
    showConfirm.mockResolvedValueOnce(true);
    render(<StashList />);
    const list = screen.getByRole("listbox", { name: "Stashes" });
    list.focus();
    fireEvent.keyDown(list, { key: " " });
    await waitFor(() => expect(showConfirm).toHaveBeenCalled());
    await waitFor(() => expect(applyStash).toHaveBeenCalledWith(0));
  });

  it("does not apply when user cancels the confirm", async () => {
    showConfirm.mockResolvedValueOnce(false);
    render(<StashList />);
    const list = screen.getByRole("listbox", { name: "Stashes" });
    list.focus();
    fireEvent.keyDown(list, { key: " " });
    await waitFor(() => expect(showConfirm).toHaveBeenCalled());
    await Promise.resolve();
    expect(applyStash).not.toHaveBeenCalled();
  });

  it("clicking drop old stashes triggers runQuickCleanup", async () => {
    render(<StashList />);
    const dropButton = screen.getByRole("button", {
      name: /drop stashes older than/i,
    });
    fireEvent.click(dropButton);
    expect(runQuickCleanup).toHaveBeenCalledTimes(1);
  });

  it("shows Dropping… and disables button while running", async () => {
    vi.mocked(runQuickCleanup).mockImplementation(
      ({ setRunning, fetchCandidates, confirmMessage, formatItemForDialog, runBulk, refresh }) => {
        fetchCandidates();
        confirmMessage([]);
        formatItemForDialog({ index: 0, message: "test" });
        runBulk([]);
        refresh();
        setRunning(true);
        return Promise.resolve();
      }
    );
    render(<StashList />);
    const dropButton = screen.getByRole("button", {
      name: /drop stashes older than/i,
    });
    fireEvent.click(dropButton);
    await vi.waitFor(() => {
      const btn = screen.getByRole("button", {
        name: /drop stashes older than/i,
      });
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent(/Dropping…/);
    });
  });
});

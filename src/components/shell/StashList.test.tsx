import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StashList } from "./StashList";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useDialogStore } from "../../stores/dialogStore";
import { mockStore } from "../../test/mockStores";
import type { StashInfo } from "../../types";

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));
vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));
vi.mock("../../services/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

const loadStashDetails = vi.fn();
const applyStash = vi.fn();
const dropStash = vi.fn();
const showConfirm = vi.fn();

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
      selectedStashDetails: null,
    });
    mockStore(useDialogStore, { showConfirm });
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
});

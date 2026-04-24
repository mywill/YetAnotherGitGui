import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { BranchTagList } from "./BranchTagList";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useSelectionStore } from "../../stores/selectionStore";
import { useDialogStore } from "../../stores/dialogStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBranchFilterStore } from "../../stores/branchFilterStore";
import { mockStore } from "../../test/mockStores";
import type { BranchInfo, TagInfo } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

vi.mock("../../stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
}));

vi.mock("../../stores/dialogStore", () => ({
  useDialogStore: vi.fn(),
}));

// Mock the settings service so expansion writes don't hit Tauri
vi.mock("../../services/settings", () => ({
  readSettings: vi.fn().mockResolvedValue({}),
  writeSettings: vi.fn().mockResolvedValue(undefined),
}));

// Mock child components
vi.mock("./BranchItem", () => ({
  BranchItem: ({ branch }: { branch: BranchInfo }) => (
    <div data-testid={`branch-item-${branch.name}`}>{branch.name}</div>
  ),
}));

vi.mock("./TagItem", () => ({
  TagItem: ({ tag }: { tag: TagInfo }) => (
    <div data-testid={`tag-item-${tag.name}`}>{tag.name}</div>
  ),
}));

function getSection(title: string) {
  return screen.getByText(title).closest(".collapsible-section") as HTMLElement;
}

function getToggleButton(title: string) {
  const section = getSection(title);
  return section.querySelector<HTMLButtonElement>(".section-chevron")!;
}

const mockCheckoutBranch = vi.fn();
const mockCheckoutCommit = vi.fn();
const mockSelectAndScrollToCommit = vi.fn();
const mockShowConfirm = vi.fn();

describe("BranchTagList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset real settings store — sectionExpanded persists across tests otherwise.
    useSettingsStore.setState({ sectionExpanded: {} });
    useBranchFilterStore.setState({ query: "" });
    mockStore(useSelectionStore, { selectAndScrollToCommit: mockSelectAndScrollToCommit });
    mockStore(useDialogStore, { showConfirm: mockShowConfirm });
  });

  function setupStore(branches: BranchInfo[] = [], tags: TagInfo[] = []) {
    mockStore(useRepositoryStore, {
      branches,
      tags,
      checkoutBranch: mockCheckoutBranch,
      checkoutCommit: mockCheckoutCommit,
    });
  }

  describe("section rendering", () => {
    it("renders Local Branches section", () => {
      setupStore();
      render(<BranchTagList />);
      expect(screen.getByText("Local Branches")).toBeInTheDocument();
    });

    it("renders Remote Branches section", () => {
      setupStore();
      render(<BranchTagList />);
      expect(screen.getByText("Remote Branches")).toBeInTheDocument();
    });

    it("renders Tags section", () => {
      setupStore();
      render(<BranchTagList />);
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });
  });

  describe("counts", () => {
    it("shows local branch count", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "feature", is_remote: false, is_head: false, target_hash: "def" },
      ]);

      render(<BranchTagList />);
      expect(getSection("Local Branches").querySelector(".section-count")).toHaveTextContent("2");
    });

    it("shows remote branch count", () => {
      setupStore([{ name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" }]);

      render(<BranchTagList />);
      expect(getSection("Remote Branches").querySelector(".section-count")).toHaveTextContent("1");
    });

    it("shows tag count", () => {
      setupStore(
        [],
        [
          { name: "v1.0.0", target_hash: "abc", is_annotated: true },
          { name: "v0.9.0", target_hash: "def", is_annotated: false },
        ]
      );

      render(<BranchTagList />);
      expect(getSection("Tags").querySelector(".section-count")).toHaveTextContent("2");
    });
  });

  describe("collapsible sections", () => {
    it("sections are collapsed by default", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);
      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();
    });

    it("expands section when chevron is clicked", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));

      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();
    });

    it("re-collapses section when clicked again", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);
      const btn = getToggleButton("Local Branches");

      fireEvent.click(btn);
      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();

      fireEvent.click(btn);
      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();
    });

    it("has aria-expanded=false by default", () => {
      setupStore();

      render(<BranchTagList />);
      expect(getToggleButton("Local Branches")).toHaveAttribute("aria-expanded", "false");
      expect(getToggleButton("Remote Branches")).toHaveAttribute("aria-expanded", "false");
      expect(getToggleButton("Tags")).toHaveAttribute("aria-expanded", "false");
    });

    it("updates aria-expanded when expanded", () => {
      setupStore();
      render(<BranchTagList />);

      const btn = getToggleButton("Local Branches");
      fireEvent.click(btn);
      expect(btn).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("branch filtering", () => {
    it("separates local and remote branches", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" },
      ]);

      render(<BranchTagList />);
      expect(getSection("Local Branches").querySelector(".section-count")).toHaveTextContent("1");
      expect(getSection("Remote Branches").querySelector(".section-count")).toHaveTextContent("1");
    });

    it("renders local branch in correct section when expanded", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));

      expect(
        getSection("Local Branches").querySelector("[data-testid='branch-item-main']")
      ).toBeInTheDocument();
    });

    it("renders remote branch in correct section when expanded", () => {
      setupStore([{ name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" }]);

      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Remote Branches"));

      expect(
        getSection("Remote Branches").querySelector("[data-testid='branch-item-origin/main']")
      ).toBeInTheDocument();
    });
  });

  describe("items rendering", () => {
    it("renders BranchItem for each local branch when expanded", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "feature", is_remote: false, is_head: false, target_hash: "def" },
      ]);

      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));

      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();
      expect(screen.getByTestId("branch-item-feature")).toBeInTheDocument();
    });

    it("renders TagItem for each tag when expanded", () => {
      setupStore(
        [],
        [
          { name: "v1.0.0", target_hash: "abc", is_annotated: true },
          { name: "v0.9.0", target_hash: "def", is_annotated: false },
        ]
      );

      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Tags"));

      expect(screen.getByTestId("tag-item-v1.0.0")).toBeInTheDocument();
      expect(screen.getByTestId("tag-item-v0.9.0")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has branch-tag-list CSS class", () => {
      setupStore();
      const { container } = render(<BranchTagList />);
      expect(container.querySelector(".branch-tag-list")).toBeInTheDocument();
    });

    it("has three collapsible sections", () => {
      setupStore();
      const { container } = render(<BranchTagList />);

      const sections = container.querySelectorAll(".collapsible-section");
      expect(sections.length).toBe(3);
    });

    it("has no per-section filter input — filter lives in the CurrentBranch header", () => {
      setupStore();
      render(<BranchTagList />);

      // The previous design had three "Filter X" inputs inside each section.
      // The new unified-filter design moves the input into CurrentBranch, so
      // BranchTagList itself should render zero inputs.
      expect(screen.queryAllByLabelText(/Filter/).length).toBe(0);
    });
  });

  describe("unified filter (driven by useBranchFilterStore)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function setQueryAndAdvance(value: string) {
      act(() => {
        useBranchFilterStore.getState().setQuery(value);
      });
      act(() => {
        // Wait past SEARCH_DEBOUNCE_MS so the debounced query inside the list updates.
        vi.advanceTimersByTime(200);
      });
    }

    it("filters all three sections in lockstep", () => {
      setupStore(
        [
          { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
          { name: "feature/search", is_remote: false, is_head: false, target_hash: "def" },
          { name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" },
        ],
        [
          { name: "v1.0.0", target_hash: "abc", is_annotated: true },
          { name: "search-tag", target_hash: "def", is_annotated: false },
        ]
      );
      render(<BranchTagList />);

      setQueryAndAdvance("search");

      // All three sections should have auto-expanded and filtered together.
      expect(screen.getByTestId("branch-item-feature/search")).toBeInTheDocument();
      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();
      expect(screen.queryByTestId("branch-item-origin/main")).not.toBeInTheDocument();
      expect(screen.getByTestId("tag-item-search-tag")).toBeInTheDocument();
      expect(screen.queryByTestId("tag-item-v1.0.0")).not.toBeInTheDocument();
    });

    it("auto-expands collapsed sections when the unified filter has a query", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "feature", is_remote: false, is_head: false, target_hash: "def" },
      ]);
      render(<BranchTagList />);

      // Section is collapsed by default.
      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();

      setQueryAndAdvance("feat");

      expect(screen.getByTestId("branch-item-feature")).toBeInTheDocument();
      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();
    });

    it("shows 'No matches' inside a section when nothing matches the unified filter", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);
      render(<BranchTagList />);

      setQueryAndAdvance("zzznope");

      const localSection = getSection("Local Branches");
      expect(within(localSection).getByText("No matches")).toBeInTheDocument();
    });

    it("updates the section count to the match count while the filter is active", () => {
      setupStore(
        [
          { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
          { name: "feature/auth", is_remote: false, is_head: false, target_hash: "def" },
          { name: "feature/search", is_remote: false, is_head: false, target_hash: "ghi" },
        ],
        []
      );
      render(<BranchTagList />);

      setQueryAndAdvance("feature");
      expect(getSection("Local Branches").querySelector(".section-count")).toHaveTextContent("2");
    });
  });

  describe("chevron icon", () => {
    it("chevrons are not rotated when collapsed (default)", () => {
      setupStore();
      const { container } = render(<BranchTagList />);

      const expandIcons = container.querySelectorAll(".expand-icon");
      expandIcons.forEach((icon) => {
        expect(icon).not.toHaveClass("expanded");
      });
    });

    it("adds expanded class when section is expanded", () => {
      setupStore();
      render(<BranchTagList />);

      const btn = getToggleButton("Local Branches");
      fireEvent.click(btn);

      expect(btn.querySelector(".expand-icon")).toHaveClass("expanded");
    });
  });

  describe("branch activation", () => {
    function focusListInside(section: HTMLElement) {
      const list = section.querySelector('[role="listbox"]') as HTMLElement;
      list.focus();
      return list;
    }

    it("confirms and checks out a local branch on Enter", async () => {
      mockShowConfirm.mockResolvedValueOnce(true);
      setupStore([{ name: "main", is_remote: false, is_head: false, target_hash: "abc" }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));
      const list = focusListInside(getSection("Local Branches"));
      fireEvent.keyDown(list, { key: "Enter" });
      await vi.waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
      await vi.waitFor(() => expect(mockCheckoutBranch).toHaveBeenCalledWith("main"));
      expect(mockSelectAndScrollToCommit).toHaveBeenCalledWith("abc");
    });

    it("does not checkout when user cancels", async () => {
      mockShowConfirm.mockResolvedValueOnce(false);
      setupStore([{ name: "main", is_remote: false, is_head: false, target_hash: "abc" }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));
      const list = focusListInside(getSection("Local Branches"));
      fireEvent.keyDown(list, { key: "Enter" });
      await vi.waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
      await Promise.resolve();
      expect(mockCheckoutBranch).not.toHaveBeenCalled();
    });

    it("does not try to checkout when branch is already HEAD", async () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));
      const list = focusListInside(getSection("Local Branches"));
      fireEvent.keyDown(list, { key: "Enter" });
      await Promise.resolve();
      expect(mockShowConfirm).not.toHaveBeenCalled();
      expect(mockCheckoutBranch).not.toHaveBeenCalled();
    });

    it("shows 'Remote Branch' dialog without checking out on a remote branch", async () => {
      mockShowConfirm.mockResolvedValueOnce(true);
      setupStore([{ name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Remote Branches"));
      const list = focusListInside(getSection("Remote Branches"));
      fireEvent.keyDown(list, { key: "Enter" });
      await vi.waitFor(() =>
        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Remote Branch" })
        )
      );
      expect(mockCheckoutBranch).not.toHaveBeenCalled();
    });

    it("Space also confirms and checks out a local branch", async () => {
      mockShowConfirm.mockResolvedValueOnce(true);
      setupStore([{ name: "feature", is_remote: false, is_head: false, target_hash: "def" }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));
      const list = focusListInside(getSection("Local Branches"));
      fireEvent.keyDown(list, { key: " " });
      await vi.waitFor(() => expect(mockCheckoutBranch).toHaveBeenCalledWith("feature"));
    });
  });

  describe("tag activation", () => {
    function focusListInside(section: HTMLElement) {
      const list = section.querySelector('[role="listbox"]') as HTMLElement;
      list.focus();
      return list;
    }

    it("confirms and checks out a tag on Enter", async () => {
      mockShowConfirm.mockResolvedValueOnce(true);
      setupStore([], [{ name: "v1.0.0", target_hash: "abc", is_annotated: true }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Tags"));
      const list = focusListInside(getSection("Tags"));
      fireEvent.keyDown(list, { key: "Enter" });
      await vi.waitFor(() => expect(mockCheckoutCommit).toHaveBeenCalledWith("abc"));
      expect(mockSelectAndScrollToCommit).toHaveBeenCalledWith("abc");
    });

    it("does not checkout a tag when user cancels", async () => {
      mockShowConfirm.mockResolvedValueOnce(false);
      setupStore([], [{ name: "v1.0.0", target_hash: "abc", is_annotated: true }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Tags"));
      const list = focusListInside(getSection("Tags"));
      fireEvent.keyDown(list, { key: "Enter" });
      await vi.waitFor(() => expect(mockShowConfirm).toHaveBeenCalled());
      await Promise.resolve();
      expect(mockCheckoutCommit).not.toHaveBeenCalled();
    });

    it("Space on a tag also confirms checkout", async () => {
      mockShowConfirm.mockResolvedValueOnce(true);
      setupStore([], [{ name: "v1.0.0", target_hash: "abc", is_annotated: true }]);
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Tags"));
      const list = focusListInside(getSection("Tags"));
      fireEvent.keyDown(list, { key: " " });
      await vi.waitFor(() => expect(mockCheckoutCommit).toHaveBeenCalledWith("abc"));
    });
  });

  describe("settingsStore persistence", () => {
    it("writes to sectionExpanded when Local Branches is toggled", () => {
      setupStore();
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Local Branches"));
      expect(useSettingsStore.getState().sectionExpanded["sidebar.branches.local"]).toBe(true);
    });

    it("writes to sectionExpanded when Remote Branches is toggled", () => {
      setupStore();
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Remote Branches"));
      expect(useSettingsStore.getState().sectionExpanded["sidebar.branches.remote"]).toBe(true);
    });

    it("writes to sectionExpanded when Tags is toggled", () => {
      setupStore();
      render(<BranchTagList />);
      fireEvent.click(getToggleButton("Tags"));
      expect(useSettingsStore.getState().sectionExpanded["sidebar.tags"]).toBe(true);
    });

    it("reflects previously stored expanded state on mount", () => {
      useSettingsStore.setState({
        sectionExpanded: { "sidebar.branches.local": true },
      });
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);
      render(<BranchTagList />);
      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();
    });
  });
});

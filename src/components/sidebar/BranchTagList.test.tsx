import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BranchTagList } from "./BranchTagList";
import { useRepositoryStore } from "../../stores/repositoryStore";
import type { BranchInfo, TagInfo, StashInfo } from "../../types";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
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

vi.mock("./StashItem", () => ({
  StashItem: ({ stash }: { stash: StashInfo }) => (
    <div data-testid={`stash-item-${stash.index}`}>{stash.message}</div>
  ),
}));

describe("BranchTagList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupStore(
    branches: BranchInfo[] = [],
    tags: TagInfo[] = [],
    stashes: StashInfo[] = []
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) =>
      selector({ branches, tags, stashes })
    );
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

    it("renders Stashes section", () => {
      setupStore();

      render(<BranchTagList />);

      expect(screen.getByText("Stashes")).toBeInTheDocument();
    });
  });

  describe("counts", () => {
    it("shows local branch count", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "feature", is_remote: false, is_head: false, target_hash: "def" },
      ]);

      render(<BranchTagList />);

      const localSection = screen.getByText("Local Branches").closest(".collapsible-section");
      expect(localSection?.querySelector(".section-count")).toHaveTextContent("2");
    });

    it("shows remote branch count", () => {
      setupStore([{ name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" }]);

      render(<BranchTagList />);

      const remoteSection = screen.getByText("Remote Branches").closest(".collapsible-section");
      expect(remoteSection?.querySelector(".section-count")).toHaveTextContent("1");
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

      const tagSection = screen.getByText("Tags").closest(".collapsible-section");
      expect(tagSection?.querySelector(".section-count")).toHaveTextContent("2");
    });

    it("shows stash count", () => {
      setupStore(
        [],
        [],
        [{ index: 0, message: "WIP", commit_hash: "abc", timestamp: 123, branch_name: "main" }]
      );

      render(<BranchTagList />);

      const stashSection = screen.getByText("Stashes").closest(".collapsible-section");
      expect(stashSection?.querySelector(".section-count")).toHaveTextContent("1");
    });
  });

  describe("collapsible sections", () => {
    it("sections are expanded by default", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);

      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();
    });

    it("collapses section when header is clicked", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);

      const localHeader = screen.getByText("Local Branches").closest("button");
      fireEvent.click(localHeader!);

      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();
    });

    it("expands section when clicked again", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);

      const localHeader = screen.getByText("Local Branches").closest("button");

      // Collapse
      fireEvent.click(localHeader!);
      expect(screen.queryByTestId("branch-item-main")).not.toBeInTheDocument();

      // Expand
      fireEvent.click(localHeader!);
      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();
    });

    it("has aria-expanded attribute", () => {
      setupStore();

      render(<BranchTagList />);

      const headers = screen.getAllByRole("button");
      headers.forEach((header) => {
        expect(header).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("updates aria-expanded when collapsed", () => {
      setupStore();

      render(<BranchTagList />);

      const localHeader = screen.getByText("Local Branches").closest("button");
      fireEvent.click(localHeader!);

      expect(localHeader).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("branch filtering", () => {
    it("separates local and remote branches", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" },
      ]);

      render(<BranchTagList />);

      const localSection = screen.getByText("Local Branches").closest(".collapsible-section");
      const remoteSection = screen.getByText("Remote Branches").closest(".collapsible-section");

      expect(localSection?.querySelector(".section-count")).toHaveTextContent("1");
      expect(remoteSection?.querySelector(".section-count")).toHaveTextContent("1");
    });

    it("renders local branch in correct section", () => {
      setupStore([{ name: "main", is_remote: false, is_head: true, target_hash: "abc" }]);

      render(<BranchTagList />);

      const localSection = screen.getByText("Local Branches").closest(".collapsible-section");
      expect(localSection?.querySelector("[data-testid='branch-item-main']")).toBeInTheDocument();
    });

    it("renders remote branch in correct section", () => {
      setupStore([{ name: "origin/main", is_remote: true, is_head: false, target_hash: "abc" }]);

      render(<BranchTagList />);

      const remoteSection = screen.getByText("Remote Branches").closest(".collapsible-section");
      expect(
        remoteSection?.querySelector("[data-testid='branch-item-origin/main']")
      ).toBeInTheDocument();
    });
  });

  describe("items rendering", () => {
    it("renders BranchItem for each local branch", () => {
      setupStore([
        { name: "main", is_remote: false, is_head: true, target_hash: "abc" },
        { name: "feature", is_remote: false, is_head: false, target_hash: "def" },
      ]);

      render(<BranchTagList />);

      expect(screen.getByTestId("branch-item-main")).toBeInTheDocument();
      expect(screen.getByTestId("branch-item-feature")).toBeInTheDocument();
    });

    it("renders TagItem for each tag", () => {
      setupStore(
        [],
        [
          { name: "v1.0.0", target_hash: "abc", is_annotated: true },
          { name: "v0.9.0", target_hash: "def", is_annotated: false },
        ]
      );

      render(<BranchTagList />);

      expect(screen.getByTestId("tag-item-v1.0.0")).toBeInTheDocument();
      expect(screen.getByTestId("tag-item-v0.9.0")).toBeInTheDocument();
    });

    it("renders StashItem for each stash", () => {
      setupStore(
        [],
        [],
        [
          { index: 0, message: "WIP", commit_hash: "abc", timestamp: 123, branch_name: "main" },
          { index: 1, message: "Temp", commit_hash: "def", timestamp: 124, branch_name: "main" },
        ]
      );

      render(<BranchTagList />);

      expect(screen.getByTestId("stash-item-0")).toBeInTheDocument();
      expect(screen.getByTestId("stash-item-1")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has branch-tag-list CSS class", () => {
      setupStore();

      const { container } = render(<BranchTagList />);

      expect(container.querySelector(".branch-tag-list")).toBeInTheDocument();
    });

    it("has four collapsible sections", () => {
      setupStore();

      const { container } = render(<BranchTagList />);

      const sections = container.querySelectorAll(".collapsible-section");
      expect(sections.length).toBe(4);
    });

    it("has section-header class on headers", () => {
      setupStore();

      const { container } = render(<BranchTagList />);

      const headers = container.querySelectorAll(".section-header");
      expect(headers.length).toBe(4);
    });
  });

  describe("chevron icon", () => {
    it("rotates chevron when expanded", () => {
      setupStore();

      const { container } = render(<BranchTagList />);

      const expandIcons = container.querySelectorAll(".expand-icon");
      expandIcons.forEach((icon) => {
        expect(icon).toHaveClass("expanded");
      });
    });

    it("removes expanded class when collapsed", () => {
      setupStore();

      render(<BranchTagList />);

      const localHeader = screen.getByText("Local Branches").closest("button");
      fireEvent.click(localHeader!);

      const expandIcon = localHeader?.querySelector(".expand-icon");
      expect(expandIcon).not.toHaveClass("expanded");
    });
  });
});

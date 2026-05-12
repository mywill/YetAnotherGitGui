import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CurrentBranch } from "./CurrentBranch";
import { useRepositoryStore } from "../../stores/repositoryStore";
import { useBranchFilterStore } from "../../stores/branchFilterStore";
import { mockStore } from "../../test/mockStores";

// Mock the repository store
vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: vi.fn(),
}));

describe("CurrentBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupStore(
    repositoryInfo: {
      path: string;
      current_branch: string | null;
      is_detached: boolean;
      remotes: string[];
    } | null
  ) {
    mockStore(useRepositoryStore, { repositoryInfo });
  }

  describe("no repository", () => {
    it("returns null when no repository is open", () => {
      setupStore(null);

      const { container } = render(<CurrentBranch />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("branch name display", () => {
    it("shows current branch name", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });

      render(<CurrentBranch />);

      expect(screen.getByText("main")).toBeInTheDocument();
    });

    it("shows feature branch name", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "feature/new-feature",
        is_detached: false,
        remotes: [],
      });

      render(<CurrentBranch />);

      expect(screen.getByText("feature/new-feature")).toBeInTheDocument();
    });

    it("shows branch name as title attribute", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });

      const { container } = render(<CurrentBranch />);

      const branchName = container.querySelector(".branch-name");
      expect(branchName).toHaveAttribute("title", "main");
    });
  });

  describe("detached HEAD state", () => {
    it("shows 'HEAD detached' when in detached state", () => {
      setupStore({
        path: "/test/repo",
        current_branch: null,
        is_detached: true,
        remotes: [],
      });

      render(<CurrentBranch />);

      expect(screen.getByText("HEAD detached")).toBeInTheDocument();
    });

    it("shows 'HEAD detached' even if current_branch has value", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "abc123",
        is_detached: true,
        remotes: [],
      });

      render(<CurrentBranch />);

      expect(screen.getByText("HEAD detached")).toBeInTheDocument();
    });
  });

  describe("no branch state", () => {
    it("shows 'No branch' when current_branch is null and not detached", () => {
      setupStore({
        path: "/test/repo",
        current_branch: null,
        is_detached: false,
        remotes: [],
      });

      render(<CurrentBranch />);

      expect(screen.getByText("No branch")).toBeInTheDocument();
    });

    it("shows 'No branch' when current_branch is empty string", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "",
        is_detached: false,
        remotes: [],
      });

      render(<CurrentBranch />);

      expect(screen.getByText("No branch")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has current-branch CSS class", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });

      const { container } = render(<CurrentBranch />);

      expect(container.querySelector(".current-branch")).toBeInTheDocument();
    });

    it("has branch-name CSS class on text element", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });

      const { container } = render(<CurrentBranch />);

      expect(container.querySelector(".branch-name")).toBeInTheDocument();
    });
  });

  describe("repo state label", () => {
    function setupWithState(state: string | undefined) {
      mockStore(useRepositoryStore, {
        repositoryInfo: {
          path: "/test/repo",
          current_branch: "main",
          is_detached: false,
          remotes: [],
          repo_state: state,
        },
      });
    }

    it("shows MERGING label when repo_state is merge", () => {
      setupWithState("merge");
      render(<CurrentBranch />);
      expect(screen.getByText("MERGING")).toBeInTheDocument();
    });

    it("shows REBASING label when repo_state is rebase", () => {
      setupWithState("rebase");
      render(<CurrentBranch />);
      expect(screen.getByText("REBASING")).toBeInTheDocument();
    });

    it("shows CHERRY-PICKING label when repo_state is cherry-pick", () => {
      setupWithState("cherry-pick");
      render(<CurrentBranch />);
      expect(screen.getByText(/CHERRY/)).toBeInTheDocument();
    });

    it("shows REVERTING label when repo_state is revert", () => {
      setupWithState("revert");
      render(<CurrentBranch />);
      expect(screen.getByText("REVERTING")).toBeInTheDocument();
    });

    it("shows BISECTING label when repo_state is bisect", () => {
      setupWithState("bisect");
      render(<CurrentBranch />);
      expect(screen.getByText("BISECTING")).toBeInTheDocument();
    });

    it("shows no state label when repo_state is clean", () => {
      setupWithState("clean");
      const { container } = render(<CurrentBranch />);
      expect(container.querySelector(".repo-state-label")).toBeNull();
    });

    it("shows no state label for an unknown repo_state", () => {
      setupWithState("unknown-state");
      const { container } = render(<CurrentBranch />);
      expect(container.querySelector(".repo-state-label")).toBeNull();
    });

    it("shows no state label when repo_state is undefined", () => {
      setupWithState(undefined);
      const { container } = render(<CurrentBranch />);
      expect(container.querySelector(".repo-state-label")).toBeNull();
    });
  });

  describe("branch icon", () => {
    it("renders an SVG icon", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });

      const { container } = render(<CurrentBranch />);

      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("SVG has correct size", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });

      const { container } = render(<CurrentBranch />);

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "14");
      expect(svg).toHaveAttribute("height", "14");
    });
  });

  describe("unified filter input", () => {
    beforeEach(() => {
      useBranchFilterStore.setState({ query: "" });
    });

    it("writes typed text to the shared branch filter store", () => {
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });
      render(<CurrentBranch />);
      const input = screen.getByLabelText("Filter branches and tags") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "feat" } });
      expect(useBranchFilterStore.getState().query).toBe("feat");
    });

    it("renders a clear button when the filter is non-empty and clears on click", () => {
      useBranchFilterStore.setState({ query: "feat" });
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });
      render(<CurrentBranch />);
      const clearBtn = screen.getByLabelText("Clear filter");
      fireEvent.click(clearBtn);
      expect(useBranchFilterStore.getState().query).toBe("");
    });

    it("clears the filter on Escape when query has text", () => {
      useBranchFilterStore.setState({ query: "feat" });
      setupStore({
        path: "/test/repo",
        current_branch: "main",
        is_detached: false,
        remotes: [],
      });
      render(<CurrentBranch />);
      const input = screen.getByLabelText("Filter branches and tags") as HTMLInputElement;
      fireEvent.keyDown(input, { key: "Escape" });
      expect(useBranchFilterStore.getState().query).toBe("");
    });
  });
});

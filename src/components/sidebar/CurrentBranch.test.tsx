import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrentBranch } from "./CurrentBranch";
import { useRepositoryStore } from "../../stores/repositoryStore";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useRepositoryStore).mockImplementation((selector: any) =>
      selector({ repositoryInfo })
    );
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
});

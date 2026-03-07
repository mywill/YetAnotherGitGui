import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RepoStateBanner } from "./RepoStateBanner";
import type { RepositoryInfo } from "../../types";

let mockRepositoryInfo: RepositoryInfo | null = null;

vi.mock("../../stores/repositoryStore", () => ({
  useRepositoryStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ repositoryInfo: mockRepositoryInfo }),
}));

const makeRepoInfo = (repo_state: string): RepositoryInfo => ({
  path: "/test/repo",
  current_branch: "main",
  is_detached: false,
  remotes: ["origin"],
  head_hash: "abc123",
  repo_state,
});

describe("RepoStateBanner", () => {
  beforeEach(() => {
    mockRepositoryInfo = null;
  });

  it("renders nothing when repositoryInfo is null", () => {
    const { container } = render(<RepoStateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when repo_state is clean", () => {
    mockRepositoryInfo = makeRepoInfo("clean");
    const { container } = render(<RepoStateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders merge banner", () => {
    mockRepositoryInfo = makeRepoInfo("merge");
    render(<RepoStateBanner />);
    expect(screen.getByText("Merge in progress")).toBeInTheDocument();
    expect(screen.getByText("git merge --abort")).toBeInTheDocument();
  });

  it("renders rebase banner", () => {
    mockRepositoryInfo = makeRepoInfo("rebase");
    render(<RepoStateBanner />);
    expect(screen.getByText("Rebase in progress")).toBeInTheDocument();
    expect(screen.getByText("git rebase --abort")).toBeInTheDocument();
  });

  it("renders cherry-pick banner", () => {
    mockRepositoryInfo = makeRepoInfo("cherry-pick");
    render(<RepoStateBanner />);
    expect(screen.getByText("Cherry-pick in progress")).toBeInTheDocument();
    expect(screen.getByText("git cherry-pick --abort")).toBeInTheDocument();
  });

  it("renders revert banner", () => {
    mockRepositoryInfo = makeRepoInfo("revert");
    render(<RepoStateBanner />);
    expect(screen.getByText("Revert in progress")).toBeInTheDocument();
    expect(screen.getByText("git revert --abort")).toBeInTheDocument();
  });

  it("renders bisect banner", () => {
    mockRepositoryInfo = makeRepoInfo("bisect");
    render(<RepoStateBanner />);
    expect(screen.getByText("Bisect in progress")).toBeInTheDocument();
    expect(screen.getByText("git bisect reset")).toBeInTheDocument();
  });

  it("has correct ARIA role and live region", () => {
    mockRepositoryInfo = makeRepoInfo("merge");
    render(<RepoStateBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("renders nothing for unknown state", () => {
    mockRepositoryInfo = makeRepoInfo("unknown-state");
    const { container } = render(<RepoStateBanner />);
    expect(container.firstChild).toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

// Mock all child components
vi.mock("./ViewSwitcher", () => ({
  ViewSwitcher: () => <div data-testid="view-switcher">ViewSwitcher</div>,
}));

vi.mock("./CurrentBranch", () => ({
  CurrentBranch: () => <div data-testid="current-branch">CurrentBranch</div>,
}));

vi.mock("./BranchTagList", () => ({
  BranchTagList: () => <div data-testid="branch-tag-list">BranchTagList</div>,
}));

vi.mock("./CliInstall", () => ({
  CliInstall: () => <div data-testid="cli-install">CliInstall</div>,
}));

describe("Sidebar", () => {
  describe("composition", () => {
    it("renders ViewSwitcher component", () => {
      render(<Sidebar />);

      expect(screen.getByTestId("view-switcher")).toBeInTheDocument();
    });

    it("renders CurrentBranch component", () => {
      render(<Sidebar />);

      expect(screen.getByTestId("current-branch")).toBeInTheDocument();
    });

    it("renders BranchTagList component", () => {
      render(<Sidebar />);

      expect(screen.getByTestId("branch-tag-list")).toBeInTheDocument();
    });

    it("renders CliInstall component", () => {
      render(<Sidebar />);

      expect(screen.getByTestId("cli-install")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has sidebar CSS class on root", () => {
      const { container } = render(<Sidebar />);

      expect(container.querySelector(".sidebar")).toBeInTheDocument();
    });

    it("has sidebar-scroll wrapper for BranchTagList", () => {
      const { container } = render(<Sidebar />);

      expect(container.querySelector(".sidebar-scroll")).toBeInTheDocument();
    });

    it("BranchTagList is inside sidebar-scroll", () => {
      const { container } = render(<Sidebar />);

      const scrollContainer = container.querySelector(".sidebar-scroll");
      expect(scrollContainer?.querySelector("[data-testid='branch-tag-list']")).toBeInTheDocument();
    });
  });

  describe("component order", () => {
    it("renders components in correct order", () => {
      const { container } = render(<Sidebar />);

      const sidebar = container.querySelector(".sidebar");
      const children = sidebar?.children;

      expect(children).toBeDefined();
      expect(children?.length).toBe(4);

      // Check order by data-testid
      expect(children?.[0]).toHaveAttribute("data-testid", "view-switcher");
      expect(children?.[1]).toHaveAttribute("data-testid", "current-branch");
      expect(children?.[2]).toHaveClass("sidebar-scroll");
      expect(children?.[3]).toHaveAttribute("data-testid", "cli-install");
    });
  });
});

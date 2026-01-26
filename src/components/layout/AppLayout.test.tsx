import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  describe("rendering", () => {
    it("renders sidebar prop content", () => {
      render(
        <AppLayout sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}>
          <div>Main Content</div>
        </AppLayout>
      );

      expect(screen.getByTestId("test-sidebar")).toBeInTheDocument();
      expect(screen.getByText("Sidebar Content")).toBeInTheDocument();
    });

    it("renders children content", () => {
      render(
        <AppLayout sidebar={<div>Sidebar</div>}>
          <div data-testid="test-content">Main Content</div>
        </AppLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
      expect(screen.getByText("Main Content")).toBeInTheDocument();
    });

    it("renders both sidebar and children together", () => {
      render(
        <AppLayout sidebar={<span>Sidebar</span>}>
          <span>Content</span>
        </AppLayout>
      );

      expect(screen.getByText("Sidebar")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has app-layout class on root element", () => {
      const { container } = render(
        <AppLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </AppLayout>
      );

      expect(container.querySelector(".app-layout")).toBeInTheDocument();
    });

    it("has app-sidebar class for sidebar container", () => {
      const { container } = render(
        <AppLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </AppLayout>
      );

      expect(container.querySelector(".app-sidebar")).toBeInTheDocument();
    });

    it("has app-content class for content container", () => {
      const { container } = render(
        <AppLayout sidebar={<div>Sidebar</div>}>
          <div>Content</div>
        </AppLayout>
      );

      expect(container.querySelector(".app-content")).toBeInTheDocument();
    });

    it("sidebar container contains sidebar content", () => {
      const { container } = render(
        <AppLayout sidebar={<div data-testid="sidebar">Sidebar</div>}>
          <div>Content</div>
        </AppLayout>
      );

      const sidebarContainer = container.querySelector(".app-sidebar");
      expect(sidebarContainer?.querySelector("[data-testid='sidebar']")).toBeInTheDocument();
    });

    it("content container contains children", () => {
      const { container } = render(
        <AppLayout sidebar={<div>Sidebar</div>}>
          <div data-testid="content">Content</div>
        </AppLayout>
      );

      const contentContainer = container.querySelector(".app-content");
      expect(contentContainer?.querySelector("[data-testid='content']")).toBeInTheDocument();
    });
  });

  describe("multiple children", () => {
    it("renders multiple children elements", () => {
      render(
        <AppLayout sidebar={<div>Sidebar</div>}>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </AppLayout>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });
  });
});

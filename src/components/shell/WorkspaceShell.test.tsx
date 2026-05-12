import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceShell } from "./WorkspaceShell";

vi.mock("./IconRail", () => ({
  IconRail: () => <nav data-testid="icon-rail">IconRail</nav>,
}));

vi.mock("./WorkspaceCenter", () => ({
  WorkspaceCenter: () => <div data-testid="workspace-center">WorkspaceCenter</div>,
}));

describe("WorkspaceShell", () => {
  it("renders icon rail", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("icon-rail")).toBeInTheDocument();
  });

  it("renders workspace center", () => {
    render(<WorkspaceShell />);

    expect(screen.getByTestId("workspace-center")).toBeInTheDocument();
  });

  it("has workspace-shell CSS class on root", () => {
    const { container } = render(<WorkspaceShell />);

    expect(container.querySelector(".workspace-shell")).toBeInTheDocument();
  });
});

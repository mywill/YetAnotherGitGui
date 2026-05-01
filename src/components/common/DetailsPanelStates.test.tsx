import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailsPanelLoading, DetailsPanelEmpty } from "./DetailsPanelStates";

describe("DetailsPanelLoading", () => {
  it("renders the label", () => {
    render(<DetailsPanelLoading className="test-panel" label="Loading commits…" />);
    expect(screen.getByText("Loading commits…")).toBeInTheDocument();
  });

  it("includes the supplied className and the loading modifier", () => {
    const { container } = render(
      <DetailsPanelLoading className="commit-details-panel" label="Loading…" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("commit-details-panel");
    expect(root).toHaveClass("loading");
  });

  it("renders a spinner element", () => {
    const { container } = render(<DetailsPanelLoading className="test-panel" label="Loading…" />);
    expect(container.querySelector(".loading-spinner")).toBeInTheDocument();
  });
});

describe("DetailsPanelEmpty", () => {
  it("renders the label", () => {
    render(<DetailsPanelEmpty className="test-panel" label="Nothing selected" />);
    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
  });

  it("includes the supplied className and the empty modifier", () => {
    const { container } = render(
      <DetailsPanelEmpty className="stash-details-empty" label="Select a stash" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("stash-details-empty");
    expect(root).toHaveClass("empty");
  });

  it("does not render a spinner", () => {
    const { container } = render(<DetailsPanelEmpty className="test-panel" label="Empty" />);
    expect(container.querySelector(".loading-spinner")).not.toBeInTheDocument();
  });
});

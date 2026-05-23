import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollapsibleFilteredSection } from "./CollapsibleFilteredSection";

type Item = { name: string };
const ITEMS: Item[] = [{ name: "main" }, { name: "develop" }, { name: "feature/x" }];

function renderSection(
  overrides: Partial<React.ComponentProps<typeof CollapsibleFilteredSection<Item>>> = {}
) {
  const onToggle = vi.fn();
  const onActivate = vi.fn();
  const onSecondaryActivate = vi.fn();
  const renderItem = (it: Item) => <span data-testid={`item-${it.name}`}>{it.name}</span>;
  const utils = render(
    <CollapsibleFilteredSection<Item>
      title="Branches"
      items={ITEMS}
      expanded={false}
      onToggle={onToggle}
      filterQuery=""
      listAriaLabel="Branches list"
      onActivate={onActivate}
      onSecondaryActivate={onSecondaryActivate}
      renderItem={renderItem}
      emptyLabel="No branches"
      {...overrides}
    />
  );
  return { ...utils, onToggle, onActivate, onSecondaryActivate };
}

describe("CollapsibleFilteredSection", () => {
  it("renders header with count but hides list when collapsed and not filtering", () => {
    renderSection({ expanded: false, filterQuery: "" });

    expect(screen.getByText("Branches")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /toggle branches/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toBeDisabled();
    expect(screen.getByLabelText("3 items")).toHaveTextContent("3");
    expect(screen.queryByTestId("item-main")).not.toBeInTheDocument();
    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
    expect(screen.queryByText("No branches")).not.toBeInTheDocument();
  });

  it("renders all items when expanded with no filter", () => {
    renderSection({ expanded: true, filterQuery: "" });

    const toggle = screen.getByRole("button", { name: /toggle branches/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("item-main")).toBeInTheDocument();
    expect(screen.getByTestId("item-develop")).toBeInTheDocument();
    expect(screen.getByTestId("item-feature/x")).toBeInTheDocument();
    expect(screen.getByLabelText("3 items")).toHaveTextContent("3");
  });

  it("calls onToggle when the header button is clicked", () => {
    const { onToggle } = renderSection({ expanded: false });
    fireEvent.click(screen.getByRole("button", { name: /toggle branches/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("force-expands and filters items when filterQuery is non-empty", () => {
    renderSection({ expanded: false, filterQuery: "dev" });

    const toggle = screen.getByRole("button", { name: /toggle branches/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toBeDisabled();
    expect(screen.getByTestId("item-develop")).toBeInTheDocument();
    expect(screen.queryByTestId("item-main")).not.toBeInTheDocument();
    expect(screen.queryByTestId("item-feature/x")).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 matches")).toHaveTextContent("1");
  });

  it("shows 'No matches' empty state when filter excludes everything", () => {
    renderSection({ filterQuery: "zzz" });

    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByTestId("item-main")).not.toBeInTheDocument();
    const count = screen.getByLabelText("0 matches");
    expect(count).toHaveTextContent("0");
    expect(count.className).toMatch(/opacity-60/);
  });

  it("invokes onActivate with the filtered item on Enter", () => {
    const { onActivate, onSecondaryActivate } = renderSection({
      expanded: true,
      filterQuery: "feat",
    });

    expect(screen.getByTestId("item-feature/x")).toBeInTheDocument();
    expect(screen.queryByTestId("item-main")).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("listbox", { name: "Branches list" }), {
      key: "Enter",
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith({ name: "feature/x" });
    expect(onSecondaryActivate).not.toHaveBeenCalled();
  });
});

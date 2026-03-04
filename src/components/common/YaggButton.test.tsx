import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { YaggButton } from "./YaggButton";

describe("YaggButton", () => {
  it("renders as a native button element", () => {
    render(<YaggButton>Click me</YaggButton>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders children", () => {
    render(<YaggButton>Hello</YaggButton>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("fires onClick on click", () => {
    const onClick = vi.fn();
    render(<YaggButton onClick={onClick}>Click</YaggButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe("disabled state", () => {
    it("sets native disabled attribute", () => {
      render(<YaggButton disabled>Click</YaggButton>);
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
    });

    it("applies opacity-50 class", () => {
      render(<YaggButton disabled>Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("opacity-50");
    });
  });

  describe("variants", () => {
    it("applies default variant classes", () => {
      render(<YaggButton variant="default">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("bg-bg-tertiary");
    });

    it("applies outline variant classes", () => {
      render(<YaggButton variant="outline">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("bg-transparent");
      expect(screen.getByRole("button").className).toContain("text-text-secondary");
    });

    it("applies primary variant classes", () => {
      render(<YaggButton variant="primary">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("bg-bg-selected");
      expect(screen.getByRole("button").className).toContain("text-white");
    });

    it("applies ghost variant classes", () => {
      render(<YaggButton variant="ghost">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("bg-bg-secondary");
    });

    it("applies accent variant classes", () => {
      render(<YaggButton variant="accent">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("bg-accent");
      expect(screen.getByRole("button").className).toContain("text-white");
    });

    it("applies menu-item variant classes", () => {
      render(<YaggButton variant="menu-item">Click</YaggButton>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("w-full");
      expect(btn.className).toContain("text-left");
    });

    it("applies selection variant classes", () => {
      render(<YaggButton variant="selection">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("bg-primary");
      expect(screen.getByRole("button").className).toContain("text-white");
    });

    it("applies text-link variant classes", () => {
      render(<YaggButton variant="text-link">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("text-primary");
    });

    it("applies icon variant classes", () => {
      render(<YaggButton variant="icon">X</YaggButton>);
      expect(screen.getByRole("button").className).toContain("p-1");
    });

    it("applies tab variant classes", () => {
      render(<YaggButton variant="tab">Tab</YaggButton>);
      expect(screen.getByRole("button").className).toContain("border-transparent");
    });
  });

  describe("sizes", () => {
    it("applies sm size by default", () => {
      render(<YaggButton>Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("py-0.5");
    });

    it("applies md size", () => {
      render(<YaggButton size="md">Click</YaggButton>);
      expect(screen.getByRole("button").className).toContain("py-1.5");
    });

    it("skips size classes for menu-item variant", () => {
      render(<YaggButton variant="menu-item">Click</YaggButton>);
      expect(screen.getByRole("button").className).not.toContain("min-h-");
    });
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<YaggButton ref={ref}>Click</YaggButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("merges custom className", () => {
    render(<YaggButton className="my-custom-class">Click</YaggButton>);
    expect(screen.getByRole("button").className).toContain("my-custom-class");
  });

  it("passes through aria attributes", () => {
    render(
      <YaggButton aria-label="Settings" aria-expanded={true} aria-haspopup="true">
        Gear
      </YaggButton>
    );
    const btn = screen.getByRole("button", { name: "Settings" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(btn).toHaveAttribute("aria-haspopup", "true");
  });

  it("supports custom role override", () => {
    render(
      <YaggButton role="tab" aria-selected={true}>
        Tab
      </YaggButton>
    );
    expect(screen.getByRole("tab")).toBeInTheDocument();
    expect(screen.getByRole("tab")).toHaveAttribute("aria-selected", "true");
  });

  it("applies select-none class", () => {
    render(<YaggButton>Click</YaggButton>);
    expect(screen.getByRole("button").className).toContain("select-none");
  });
});

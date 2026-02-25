import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    title: "Test Title",
    message: "Test Message",
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any event listeners
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders title correctly", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("renders message correctly", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText("Test Message")).toBeInTheDocument();
    });

    it("renders default button labels", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText("OK")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("renders custom button labels", () => {
      render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" cancelLabel="Keep" />);

      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Keep")).toBeInTheDocument();
    });
  });

  describe("ARIA attributes", () => {
    it("has role dialog", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal set to true", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-labelledby pointing to title", () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");

      const title = screen.getByRole("heading", { level: 2 });
      expect(title).toHaveAttribute("id", "dialog-title");
    });
  });

  describe("callbacks", () => {
    it("calls onConfirm when confirm button is clicked", () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("OK"));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button is clicked", () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when Escape key is pressed", () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when backdrop is clicked", () => {
      render(<ConfirmDialog {...defaultProps} />);

      const backdrop = document.querySelector(".confirm-dialog-backdrop");
      fireEvent.click(backdrop!);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel when dialog content is clicked", () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog);

      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe("focus management", () => {
    it("focuses confirm button on mount", () => {
      render(<ConfirmDialog {...defaultProps} />);

      const confirmButton = screen.getByText("OK");
      expect(document.activeElement).toBe(confirmButton);
    });
  });

  describe("custom labels", () => {
    it("renders custom confirm label", () => {
      render(<ConfirmDialog {...defaultProps} confirmLabel="Yes, Delete" />);

      expect(screen.getByText("Yes, Delete")).toBeInTheDocument();
    });

    it("renders custom cancel label", () => {
      render(<ConfirmDialog {...defaultProps} cancelLabel="No, Keep It" />);

      expect(screen.getByText("No, Keep It")).toBeInTheDocument();
    });
  });

  describe("CSS structure", () => {
    it("has correct CSS class structure", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(document.querySelector(".confirm-dialog-backdrop")).toBeInTheDocument();
      expect(document.querySelector(".confirm-dialog")).toBeInTheDocument();
      expect(document.querySelector(".confirm-dialog-header")).toBeInTheDocument();
      expect(document.querySelector(".confirm-dialog-body")).toBeInTheDocument();
      expect(document.querySelector(".confirm-dialog-actions")).toBeInTheDocument();
    });

    it("has correct button CSS classes", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(document.querySelector(".dialog-btn.cancel")).toBeInTheDocument();
      expect(document.querySelector(".dialog-btn.confirm")).toBeInTheDocument();
    });
  });
});

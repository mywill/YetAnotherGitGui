import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationToast } from "./NotificationToast";
import type { Notification } from "../../stores/notificationStore";

const mockDismiss = vi.fn();
let mockNotifications: Notification[] = [];

vi.mock("../../stores/notificationStore", () => ({
  useNotificationStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ notifications: mockNotifications, dismiss: mockDismiss }),
}));

describe("NotificationToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications = [];
  });

  it("renders nothing when notifications array is empty", () => {
    const { container } = render(<NotificationToast />);

    expect(container.firstChild).toBeNull();
  });

  it("renders error toast with correct classes and text", () => {
    mockNotifications = [{ id: 1, message: "Something went wrong", type: "error" }];

    const { container } = render(<NotificationToast />);

    const toast = container.querySelector(".notification-toast");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("notification-toast-error");
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders success toast with correct classes and text", () => {
    mockNotifications = [{ id: 1, message: "Operation succeeded", type: "success" }];

    const { container } = render(<NotificationToast />);

    const toast = container.querySelector(".notification-toast");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("notification-toast-success");
    expect(screen.getByText("Operation succeeded")).toBeInTheDocument();
  });

  it("renders multiple toasts simultaneously", () => {
    mockNotifications = [
      { id: 1, message: "Error occurred", type: "error" },
      { id: 2, message: "Success!", type: "success" },
      { id: 3, message: "Another error", type: "error" },
    ];

    const { container } = render(<NotificationToast />);

    const toasts = container.querySelectorAll(".notification-toast");
    expect(toasts).toHaveLength(3);
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("Another error")).toBeInTheDocument();
  });

  it("clicking error toast calls dismiss with correct id", () => {
    mockNotifications = [{ id: 42, message: "Something went wrong", type: "error" }];

    const { container } = render(<NotificationToast />);

    const toast = container.querySelector(".notification-toast-error");
    expect(toast).toBeInTheDocument();
    fireEvent.click(toast!);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledWith(42);
  });

  it("success toast does not have onClick dismiss handler", () => {
    mockNotifications = [{ id: 1, message: "Operation succeeded", type: "success" }];

    const { container } = render(<NotificationToast />);

    const toast = container.querySelector(".notification-toast-success");
    expect(toast).toBeInTheDocument();
    fireEvent.click(toast!);

    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("error toast has cursor-pointer class", () => {
    mockNotifications = [{ id: 1, message: "Error occurred", type: "error" }];

    const { container } = render(<NotificationToast />);

    expect(container.querySelector(".cursor-pointer")).toBeInTheDocument();
  });

  it("error toast has title attribute for accessibility", () => {
    mockNotifications = [{ id: 1, message: "Error occurred", type: "error" }];

    render(<NotificationToast />);

    expect(screen.getByTitle("Click to dismiss")).toBeInTheDocument();
  });

  describe("actionable toasts", () => {
    it("success toast with action is clickable and invokes action then dismisses", () => {
      const action = vi.fn();
      mockNotifications = [
        { id: 7, message: "Update available", type: "success", action, actionLabel: "Update" },
      ];

      const { container } = render(<NotificationToast />);

      const toast = container.querySelector(".notification-toast-success");
      expect(toast).toHaveAttribute("role", "button");
      expect(toast).toHaveClass("cursor-pointer");
      expect(toast).toHaveAttribute("title", "Update");

      fireEvent.click(toast!);

      expect(action).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledWith(7);
    });

    it("success toast without action stays non-clickable", () => {
      mockNotifications = [{ id: 1, message: "Plain success", type: "success" }];

      const { container } = render(<NotificationToast />);

      const toast = container.querySelector(".notification-toast-success");
      expect(toast).not.toHaveAttribute("role", "button");
      expect(toast).not.toHaveClass("cursor-pointer");

      fireEvent.click(toast!);
      expect(mockDismiss).not.toHaveBeenCalled();
    });

    it("error toast with action invokes action then dismisses", () => {
      const action = vi.fn();
      mockNotifications = [{ id: 9, message: "Boom", type: "error", action }];

      const { container } = render(<NotificationToast />);

      const toast = container.querySelector(".notification-toast-error");
      fireEvent.click(toast!);

      expect(action).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledWith(9);
    });

    it("error toast without action still dismisses on click", () => {
      mockNotifications = [{ id: 11, message: "Plain error", type: "error" }];

      const { container } = render(<NotificationToast />);

      const toast = container.querySelector(".notification-toast-error");
      fireEvent.click(toast!);

      expect(mockDismiss).toHaveBeenCalledWith(11);
    });

    it("success toast with action falls back to default title when no actionLabel", () => {
      mockNotifications = [{ id: 1, message: "Click me", type: "success", action: () => {} }];

      render(<NotificationToast />);
      expect(screen.getByTitle("Click for details")).toBeInTheDocument();
    });
  });
});

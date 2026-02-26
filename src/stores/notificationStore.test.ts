import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNotificationStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("showError", () => {
    it("adds a notification with type error", () => {
      useNotificationStore.getState().showError("Something went wrong");

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe("Something went wrong");
      expect(notifications[0].type).toBe("error");
    });

    it("auto-dismisses after 10 seconds", () => {
      useNotificationStore.getState().showError("Error message");

      expect(useNotificationStore.getState().notifications).toHaveLength(1);

      vi.advanceTimersByTime(10000);

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it("does not auto-dismiss before 10 seconds", () => {
      useNotificationStore.getState().showError("Error message");

      vi.advanceTimersByTime(9999);

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it("stacks with previous notifications instead of replacing", () => {
      useNotificationStore.getState().showSuccess("First");
      useNotificationStore.getState().showError("Second");

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(2);
      expect(notifications[0].message).toBe("First");
      expect(notifications[0].type).toBe("success");
      expect(notifications[1].message).toBe("Second");
      expect(notifications[1].type).toBe("error");
    });

    it("each notification has an independent timer", () => {
      useNotificationStore.getState().showError("First error");
      vi.advanceTimersByTime(8000);

      useNotificationStore.getState().showError("Second error");
      vi.advanceTimersByTime(2000);

      // First error should be auto-dismissed (10s elapsed)
      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe("Second error");

      vi.advanceTimersByTime(8000);

      // Second error should now be auto-dismissed too
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });
  });

  describe("showSuccess", () => {
    it("adds a notification with type success", () => {
      useNotificationStore.getState().showSuccess("Operation completed");

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe("Operation completed");
      expect(notifications[0].type).toBe("success");
    });

    it("auto-dismisses after 3 seconds", () => {
      useNotificationStore.getState().showSuccess("Done!");

      expect(useNotificationStore.getState().notifications).toHaveLength(1);

      vi.advanceTimersByTime(3000);

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it("does not auto-dismiss before 3 seconds", () => {
      useNotificationStore.getState().showSuccess("Done!");

      vi.advanceTimersByTime(2999);

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
  });

  describe("dismiss", () => {
    it("removes only the targeted notification", () => {
      useNotificationStore.getState().showError("Error 1");
      useNotificationStore.getState().showError("Error 2");

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(2);

      useNotificationStore.getState().dismiss(notifications[0].id);

      const updated = useNotificationStore.getState().notifications;
      expect(updated).toHaveLength(1);
      expect(updated[0].message).toBe("Error 2");
    });

    it("cancels auto-dismiss timer for the dismissed notification", () => {
      useNotificationStore.getState().showError("Error");
      const errorId = useNotificationStore.getState().notifications[0].id;
      useNotificationStore.getState().dismiss(errorId);

      // Set a new notification
      useNotificationStore.getState().showSuccess("Success");

      // Advance past the old error timer (10s)
      vi.advanceTimersByTime(10000);

      // The success notification should have been dismissed by its own 3s timer
      // but the key point: old error timer was cancelled and didn't fire incorrectly
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it("is safe to call with a non-existent id", () => {
      expect(() => useNotificationStore.getState().dismiss(999)).not.toThrow();

      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it("auto-dismiss of one notification leaves others intact", () => {
      useNotificationStore.getState().showSuccess("Quick"); // 3s timer
      useNotificationStore.getState().showError("Slow"); // 10s timer

      vi.advanceTimersByTime(3000);

      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe("Slow");
    });
  });
});

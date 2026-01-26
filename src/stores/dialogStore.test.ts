import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDialogStore } from "./dialogStore";

describe("dialogStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useDialogStore.setState({
      isOpen: false,
      title: "",
      message: "",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      onConfirm: null,
    });
    vi.clearAllMocks();
  });

  describe("showConfirm", () => {
    it("opens dialog with provided options", () => {
      const { showConfirm } = useDialogStore.getState();

      showConfirm({
        title: "Test Title",
        message: "Test Message",
      });

      const state = useDialogStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.title).toBe("Test Title");
      expect(state.message).toBe("Test Message");
    });

    it("uses default labels when not provided", () => {
      const { showConfirm } = useDialogStore.getState();

      showConfirm({
        title: "Test",
        message: "Test",
      });

      const state = useDialogStore.getState();
      expect(state.confirmLabel).toBe("OK");
      expect(state.cancelLabel).toBe("Cancel");
    });

    it("uses custom labels when provided", () => {
      const { showConfirm } = useDialogStore.getState();

      showConfirm({
        title: "Delete File",
        message: "Are you sure?",
        confirmLabel: "Delete",
        cancelLabel: "Keep",
      });

      const state = useDialogStore.getState();
      expect(state.confirmLabel).toBe("Delete");
      expect(state.cancelLabel).toBe("Keep");
    });

    it("returns a Promise that resolves to true on confirm", async () => {
      const { showConfirm } = useDialogStore.getState();

      const resultPromise = showConfirm({
        title: "Test",
        message: "Test",
      });

      // Simulate confirm action
      const { onConfirm } = useDialogStore.getState();
      onConfirm?.();

      const result = await resultPromise;
      expect(result).toBe(true);
    });

    it("closes dialog after confirm", async () => {
      const { showConfirm } = useDialogStore.getState();

      showConfirm({
        title: "Test",
        message: "Test",
      });

      expect(useDialogStore.getState().isOpen).toBe(true);

      // Simulate confirm action
      const { onConfirm } = useDialogStore.getState();
      onConfirm?.();

      expect(useDialogStore.getState().isOpen).toBe(false);
    });

    it("sets onConfirm callback", () => {
      const { showConfirm } = useDialogStore.getState();

      showConfirm({
        title: "Test",
        message: "Test",
      });

      expect(useDialogStore.getState().onConfirm).toBeInstanceOf(Function);
    });
  });

  describe("closeDialog", () => {
    it("closes the dialog", () => {
      const { showConfirm, closeDialog } = useDialogStore.getState();

      showConfirm({
        title: "Test",
        message: "Test",
      });

      expect(useDialogStore.getState().isOpen).toBe(true);

      closeDialog();

      expect(useDialogStore.getState().isOpen).toBe(false);
    });

    it("resolves Promise with false when dialog is closed", async () => {
      const { showConfirm, closeDialog } = useDialogStore.getState();

      const resultPromise = showConfirm({
        title: "Test",
        message: "Test",
      });

      closeDialog();

      const result = await resultPromise;
      expect(result).toBe(false);
    });

    it("can be called multiple times safely", () => {
      const { showConfirm, closeDialog } = useDialogStore.getState();

      showConfirm({
        title: "Test",
        message: "Test",
      });

      closeDialog();
      closeDialog();

      expect(useDialogStore.getState().isOpen).toBe(false);
    });
  });

  describe("dialog flow", () => {
    it("handles multiple sequential dialogs", async () => {
      const { showConfirm, closeDialog } = useDialogStore.getState();

      // First dialog - cancel
      const firstPromise = showConfirm({
        title: "First",
        message: "First message",
      });
      closeDialog();
      const firstResult = await firstPromise;
      expect(firstResult).toBe(false);

      // Second dialog - confirm
      const secondPromise = showConfirm({
        title: "Second",
        message: "Second message",
      });

      const { onConfirm } = useDialogStore.getState();
      onConfirm?.();
      const secondResult = await secondPromise;
      expect(secondResult).toBe(true);
    });
  });
});

import { create } from "zustand";

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (() => void) | null;

  showConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;

  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => {
  let resolvePromise: ((value: boolean) => void) | null = null;

  return {
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "OK",
    cancelLabel: "Cancel",
    onConfirm: null,

    showConfirm: (options) => {
      return new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
        set({
          isOpen: true,
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel || "OK",
          cancelLabel: options.cancelLabel || "Cancel",
          onConfirm: () => {
            resolvePromise?.(true);
            resolvePromise = null;
            set({ isOpen: false });
          },
        });
      });
    },

    closeDialog: () => {
      resolvePromise?.(false);
      resolvePromise = null;
      set({ isOpen: false });
    },
  };
});

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { YaggButton } from "./YaggButton";

interface ConfirmDialogProps {
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when dialog opens
  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  return createPortal(
    <div
      className="confirm-dialog-backdrop fixed inset-0 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="confirm-dialog border-border bg-bg-secondary shadow-dialog max-w-lg min-w-80 rounded-lg border"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="confirm-dialog-header border-border border-b p-3">
          <h2 id="dialog-title" className="text-text-primary font-semibold">
            {title}
          </h2>
        </div>
        <div className="confirm-dialog-body p-3">
          {typeof message === "string" ? (
            <p className="text-text-secondary text-xs leading-normal">{message}</p>
          ) : (
            message
          )}
        </div>
        <div className="confirm-dialog-actions border-border flex justify-end gap-2 border-t p-3">
          <YaggButton
            variant="outline"
            className="dialog-btn cancel text-text-secondary hover:border-text-muted hover:bg-bg-hover text-xs transition-all duration-150"
            onClick={onCancel}
          >
            {cancelLabel}
          </YaggButton>
          <YaggButton
            variant="primary"
            className="dialog-btn confirm focus:ring-bg-selected text-xs transition-all duration-150 hover:brightness-110 focus:ring-2 focus:ring-offset-2"
            onClick={onConfirm}
            ref={confirmButtonRef}
          >
            {confirmLabel}
          </YaggButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

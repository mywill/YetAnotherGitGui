import { useNotificationStore } from "../../stores/notificationStore";
import type { Notification } from "../../stores/notificationStore";

export function NotificationToast() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse gap-2">
      {notifications.map((n) =>
        n.type === "error" ? renderError(n, dismiss) : renderSuccess(n, dismiss)
      )}
    </div>
  );
}

function renderError(n: Notification, dismiss: (id: number) => void) {
  const onClick = () => {
    if (n.action) n.action();
    dismiss(n.id);
  };
  return (
    <div
      key={n.id}
      role={n.action ? "button" : "alert"}
      aria-live="assertive"
      aria-atomic="true"
      className="notification-toast notification-toast-error animate-slide-up bg-toast-error cursor-pointer rounded px-3 py-2 text-xs text-white"
      onClick={onClick}
      title={n.action ? (n.actionLabel ?? "Click for details") : "Click to dismiss"}
    >
      {n.message}
    </div>
  );
}

function renderSuccess(n: Notification, dismiss: (id: number) => void) {
  if (!n.action) {
    return (
      <div
        key={n.id}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="notification-toast notification-toast-success animate-slide-up bg-toast-success rounded px-3 py-2 text-xs text-white"
      >
        {n.message}
      </div>
    );
  }
  const onClick = () => {
    n.action!();
    dismiss(n.id);
  };
  return (
    <div
      key={n.id}
      role="button"
      aria-live="polite"
      aria-atomic="true"
      className="notification-toast notification-toast-success animate-slide-up bg-toast-success cursor-pointer rounded px-3 py-2 text-xs text-white"
      onClick={onClick}
      title={n.actionLabel ?? "Click for details"}
    >
      {n.message}
    </div>
  );
}

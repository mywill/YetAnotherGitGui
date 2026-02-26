import { useNotificationStore } from "../../stores/notificationStore";

export function NotificationToast() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse gap-2">
      {notifications.map((n) =>
        n.type === "error" ? (
          <div
            key={n.id}
            className="notification-toast notification-toast-error animate-slide-up bg-toast-error cursor-pointer rounded px-3 py-2 text-xs text-white"
            onClick={() => dismiss(n.id)}
            title="Click to dismiss"
          >
            {n.message}
          </div>
        ) : (
          <div
            key={n.id}
            className="notification-toast notification-toast-success animate-slide-up bg-toast-success rounded px-3 py-2 text-xs text-white"
          >
            {n.message}
          </div>
        )
      )}
    </div>
  );
}

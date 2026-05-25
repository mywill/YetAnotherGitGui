import { create } from "zustand";
import { logError } from "../utils/logger";

export interface Notification {
  id: number;
  message: string;
  type: "error" | "success";
  action?: () => void;
  actionLabel?: string;
}

interface NotificationOptions {
  duration?: number;
  action?: () => void;
  actionLabel?: string;
}

interface NotificationState {
  notifications: Notification[];
  showError: (message: string, opts?: NotificationOptions) => void;
  showSuccess: (message: string, opts?: NotificationOptions) => void;
  dismiss: (id: number) => void;
}

const _timers = new Map<number, ReturnType<typeof setTimeout>>();
let _nextId = 0;

const DEFAULT_ERROR_DURATION = 10000;
const DEFAULT_SUCCESS_DURATION = 3000;

function _emitNotification(
  set: (
    partial:
      | NotificationState
      | Partial<NotificationState>
      | ((state: NotificationState) => NotificationState | Partial<NotificationState>)
  ) => void,
  message: string,
  type: "error" | "success",
  defaultDuration: number,
  opts?: NotificationOptions
): void {
  const id = _nextId++;
  set((state) => ({
    notifications: [
      ...state.notifications,
      { id, message, type, action: opts?.action, actionLabel: opts?.actionLabel },
    ],
  }));
  _timers.set(
    id,
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
      _timers.delete(id);
    }, opts?.duration ?? defaultDuration)
  );
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  showError: (message: string, opts?: NotificationOptions) => {
    logError("yagg::fe::ui", message);
    _emitNotification(set, message, "error", DEFAULT_ERROR_DURATION, opts);
  },

  showSuccess: (message: string, opts?: NotificationOptions) => {
    _emitNotification(set, message, "success", DEFAULT_SUCCESS_DURATION, opts);
  },

  dismiss: (id: number) => {
    const timer = _timers.get(id);
    if (timer) {
      clearTimeout(timer);
      _timers.delete(id);
    }
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

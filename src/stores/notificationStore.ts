import { create } from "zustand";

export interface Notification {
  id: number;
  message: string;
  type: "error" | "success";
  action?: () => void;
  actionLabel?: string;
}

export interface NotificationOptions {
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

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  showError: (message: string, opts?: NotificationOptions) => {
    const id = _nextId++;
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id, message, type: "error", action: opts?.action, actionLabel: opts?.actionLabel },
      ],
    }));
    _timers.set(
      id,
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
        _timers.delete(id);
      }, opts?.duration ?? DEFAULT_ERROR_DURATION)
    );
  },

  showSuccess: (message: string, opts?: NotificationOptions) => {
    const id = _nextId++;
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id, message, type: "success", action: opts?.action, actionLabel: opts?.actionLabel },
      ],
    }));
    _timers.set(
      id,
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
        _timers.delete(id);
      }, opts?.duration ?? DEFAULT_SUCCESS_DURATION)
    );
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

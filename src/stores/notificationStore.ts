import { create } from "zustand";

export interface Notification {
  id: number;
  message: string;
  type: "error" | "success";
}

interface NotificationState {
  notifications: Notification[];
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  dismiss: (id: number) => void;
}

const _timers = new Map<number, ReturnType<typeof setTimeout>>();
let _nextId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  showError: (message: string) => {
    const id = _nextId++;
    set((state) => ({
      notifications: [...state.notifications, { id, message, type: "error" }],
    }));
    _timers.set(
      id,
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
        _timers.delete(id);
      }, 10000)
    );
  },

  showSuccess: (message: string) => {
    const id = _nextId++;
    set((state) => ({
      notifications: [...state.notifications, { id, message, type: "success" }],
    }));
    _timers.set(
      id,
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
        _timers.delete(id);
      }, 3000)
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

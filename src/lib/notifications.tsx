"use client";
import * as React from "react";

export interface Notification {
  id: string;
  title: string;
  description: string;
  time: Date;
  read: boolean;
  type: "room" | "event" | "note" | "assignment";
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, "id" | "time" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: number;
}

const NotificationContext = React.createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const addNotification = React.useCallback((n: Omit<Notification, "id" | "time" | "read">) => {
    const notif: Notification = {
      ...n,
      id: crypto.randomUUID(),
      time: new Date(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev]);
  }, []);

  const markAsRead = React.useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = React.useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, markAllAsRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = React.useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import apiClient from "@/lib/axios-config";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useUser } from "./UserContext";
import { API_CONFIG } from "@/lib/config";
import { logger } from "@/lib/logger";

// ==================== TYPES ====================

export interface ValidationIssue {
  id: string;
  type: "MISSING" | "MISMATCH" | "UNDOCUMENTED" | "DUPLICATE" | "INVALID";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "IGNORED";
  elementTag?: string;
  elementType?: string;
  message: string;
  description?: string;
  createdAt: string;
}

export interface ValidationRun {
  id: string;
  fileName: string;
  status: string;
  validationType: string;
  totalElements: number;
  missingCount: number;
  mismatchCount: number;
  undocumentedCount: number;
  createdAt: string;
  issues?: ValidationIssue[];
}

export interface Notification {
  id: string;
  type:
    | "VALIDATION_COMPLETE"
    | "ISSUE_CREATED"
    | "ISSUE_RESOLVED"
    | "FILE_CHANGED"
    | "SYSTEM";
  title: string;
  message: string;
  read: boolean;
  readAt?: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
  validationRunId?: string;
  validationRun?: {
    id: string;
    fileName: string;
    validationType: string;
    status: string;
  };
  issueId?: string;
  fileId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addNotification: (
    notification: Omit<Notification, "id" | "createdAt" | "read">,
  ) => Promise<void>;
}

// ==================== CONTEXT ====================

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
}

// ==================== PROVIDER ====================

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // Socket state removed as it was unused

  // Socket Connection Effect
  useEffect(() => {
    if (!user) return;

    const socketUrl = API_CONFIG.SOCKET_URL;
    logger.debug("Connecting to Socket.IO", { url: socketUrl });

    const socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"], // Force websocket first
    });

    socketInstance.on("connect", () => {
      logger.debug("Socket connected", { id: socketInstance.id });
      socketInstance.emit("join_user_room", user.id);
    });

    socketInstance.on("notification", (payload: { data: Notification }) => {
      logger.debug("Notification received", {
        id: payload.data.id,
        type: payload.data.type,
      });

      // Add to state
      setNotifications((prev) => [payload.data, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Show Toast
      toast(payload.data.title, {
        description: payload.data.message,
        action: {
          label: "Ver",
          onClick: () =>
            logger.debug("View notification", { id: payload.data.id }),
        },
      });
    });

    socketInstance.on("disconnect", () => {
      logger.debug("Socket disconnected");
    });

    // setSocket(socketInstance)

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const response = await apiClient.get(
        `/api/notifications?userId=${user.id}&limit=100`,
      );
      const result = response.data;

      if (result.success) {
        setNotifications(result.data.notifications);
        setUnreadCount(result.data.unreadCount);
      }
    } catch (error) {
      // Use warn for polling errors to avoid console spam
      logger.warn("Error fetching notifications", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.patch(
        `/api/notifications/${notificationId}/read`,
      );

      if (response.status === 200) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId
              ? { ...notif, read: true, readAt: new Date().toISOString() }
              : notif,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      logger.error("Error marking notification as read", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.patch(
        "/api/notifications/mark-read/bulk",
        { userId: user.id },
      );

      if (response.status === 200) {
        setNotifications((prev) =>
          prev.map((notif) => ({
            ...notif,
            read: true,
            readAt: new Date().toISOString(),
          })),
        );
        setUnreadCount(0);
      }
    } catch (error) {
      logger.error("Error marking all as read", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [user]);

  // Delete single notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await apiClient.delete(
        `/api/notifications/${notificationId}`,
      );

      if (response.status === 200) {
        setNotifications((prev) => {
          const deleted = prev.find((n) => n.id === notificationId);
          if (deleted && !deleted.read) {
            setUnreadCount((count) => Math.max(0, count - 1));
          }
          return prev.filter((n) => n.id !== notificationId);
        });
      }
    } catch (error) {
      logger.error("Error deleting notification", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!user) return;
    try {
      const response = await apiClient.delete(
        `/api/notifications/user/${user.id}`,
      );

      if (response.status === 200) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      logger.error("Error clearing notifications", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [user]);

  // Add a new notification (for real-time updates or local creation)
  const addNotification = useCallback(
    async (notification: Omit<Notification, "id" | "createdAt" | "read">) => {
      if (!user) return;
      try {
        const response = await apiClient.post("/api/notifications", {
          userId: user.id,
          ...notification,
        });

        if (response.status === 200 || response.status === 201) {
          const result = response.data;
          const newNotification = result.data;

          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);
          toast(newNotification.title, {
            description: newNotification.message,
          });

          return newNotification;
        }
      } catch (error) {
        logger.error("Error adding notification", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [user],
  );

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [fetchNotifications, user]);

  // Poll for new notifications every 60 seconds (fallback)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000); // 60 seconds (less frequent due to sockets)

    return () => clearInterval(interval);
  }, [fetchNotifications, user]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    addNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

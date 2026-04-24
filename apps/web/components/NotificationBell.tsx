"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  FileCheck,
  FileX,
  Settings,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications, Notification } from "@/context/NotificationContext";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setShowPanel(false);
      }
    }

    if (showPanel) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPanel]);

  // Get icon based on notification type
  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === "URGENT" || priority === "HIGH") {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }

    switch (type) {
      case "VALIDATION_COMPLETE":
        return <FileCheck className="w-5 h-5 text-green-500" />;
      case "ISSUE_CREATED":
        return <FileX className="w-5 h-5 text-amber-500" />;
      case "ISSUE_RESOLVED":
        return <Check className="w-5 h-5 text-emerald-500" />;
      case "FILE_CHANGED":
        return <Settings className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "NORMAL":
        return "bg-blue-500";
      case "LOW":
        return "bg-gray-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={cn(
          "relative p-2 rounded-lg transition-all duration-200",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          showPanel && "bg-gray-100 dark:bg-gray-800",
        )}
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />

        {/* Badge for unread count */}
        {unreadCount > 0 && (
          <Badge
            className={cn(
              "absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center",
              "bg-red-500 hover:bg-red-600 text-white text-xs font-bold",
              "border-2 border-white dark:border-gray-900",
              "animate-pulse",
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[600px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md z-[100] overflow-hidden flex flex-col animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary/10 to-purple-500/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                aria-label="Close notifications panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                {notifications.length} Total
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {unreadCount} Unread
              </span>
            </div>
          </div>

          {/* Actions */}
          {notifications.length > 0 && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex-1 text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAll}
                className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear all
              </Button>
            </div>
          )}

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No notifications</p>
                <p className="text-sm mt-1">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 transition-all duration-200 cursor-pointer group relative",
                      !notification.read && "bg-blue-50/50 dark:bg-blue-950/20",
                      "hover:bg-gray-50 dark:hover:bg-gray-800",
                    )}
                    onClick={() =>
                      !notification.read && markAsRead(notification.id)
                    }
                  >
                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    )}

                    <div className="flex gap-3 ml-3">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(
                          notification.type,
                          notification.priority,
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={cn(
                              "text-sm font-semibold",
                              !notification.read
                                ? "text-gray-900 dark:text-white"
                                : "text-gray-700 dark:text-gray-300",
                            )}
                          >
                            {notification.title}
                          </h4>

                          {/* Priority badge */}
                          {(notification.priority === "HIGH" ||
                            notification.priority === "URGENT") && (
                            <Badge
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                getPriorityColor(notification.priority),
                              )}
                            >
                              {notification.priority}
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {notification.message}
                        </p>

                        {/* Metadata */}
                        {notification.validationRun && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                              📄 {notification.validationRun.fileName}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {formatDate(notification.createdAt)}
                          </span>

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 transition"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// ==================== NOTIFICATIONS ====================

/**
 * Get all notifications for a user
 * GET /api/notifications?userId=xxx&read=false&limit=50
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId, read, type, limit = "100" } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: "userId is required" });
    }

    const where: Record<string, unknown> = { userId: userId as string };
    if (read !== undefined) where.read = read === "true";
    if (type) where.type = type as string;

    const notifications = await prisma.notification.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: [
        { read: "asc" }, // Unread first
        { createdAt: "desc" },
      ],
      include: {
        validationRun: {
          select: {
            id: true,
            fileName: true,
            validationType: true,
            status: true,
          },
        },
      },
    });

    // Count unread
    const unreadCount = await prisma.notification.count({
      where: {
        userId: userId as string,
        read: false,
      },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch notifications" });
  }
});

/**
 * Create a notification
 * POST /api/notifications
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      validationRunId,
      issueId,
      fileId,
      projectId,
      priority,
      metadata,
    } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: "userId, type, title, and message are required",
      });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        validationRunId,
        issueId,
        fileId,
        projectId,
        priority: priority || "NORMAL",
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    res.status(201).json({ success: true, data: notification });
  } catch (error: unknown) {
    console.error("Error creating notification:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create notification" });
  }
});

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json({ success: true, data: notification });
  } catch (error: unknown) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to mark notification as read" });
  }
});

/**
 * Mark multiple notifications as read
 * PATCH /api/notifications/mark-read
 */
router.patch("/mark-read/bulk", async (req: Request, res: Response) => {
  try {
    const { notificationIds, userId } = req.body;

    if (!notificationIds && !userId) {
      return res.status(400).json({
        success: false,
        error: "Either notificationIds or userId is required",
      });
    }

    const where: Record<string, unknown> = {};
    if (notificationIds) {
      where.id = { in: notificationIds };
    } else {
      where.userId = userId;
      where.read = false;
    }

    const result = await prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json({ success: true, data: { count: result.count } });
  } catch (error: unknown) {
    console.error("Error marking notifications as read:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to mark notifications as read" });
  }
});

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ success: true, message: "Notification deleted" });
  } catch (error: unknown) {
    console.error("Error deleting notification:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete notification" });
  }
});

/**
 * Delete all notifications for a user
 * DELETE /api/notifications/user/:userId
 */
router.delete("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { read } = req.query;

    const where: Record<string, unknown> = { userId };
    if (read !== undefined) where.read = read === "true";

    const result = await prisma.notification.deleteMany({
      where,
    });

    res.json({ success: true, data: { count: result.count } });
  } catch (error: unknown) {
    console.error("Error deleting notifications:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete notifications" });
  }
});

/**
 * Get notification statistics for a user
 * GET /api/notifications/stats/:userId
 */
router.get("/stats/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const [total, unread, byType, byPriority] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
      prisma.notification.groupBy({
        by: ["type"],
        where: { userId, read: false },
        _count: true,
      }),
      prisma.notification.groupBy({
        by: ["priority"],
        where: { userId, read: false },
        _count: true,
      }),
    ]);

    const stats = {
      total,
      unread,
      read: total - unread,
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byPriority: byPriority.reduce(
        (acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    res.json({ success: true, data: stats });
  } catch (error: unknown) {
    console.error("Error fetching notification stats:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch notification stats" });
  }
});

// ==================== UTILITY FUNCTIONS ====================

export default router;

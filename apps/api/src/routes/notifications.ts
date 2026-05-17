import { Router } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";

const router = Router();

// ==================== NOTIFICATIONS ====================

/**
 * Get all notifications for the authenticated user
 * GET /api/notifications
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const { read, type } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query.pageSize as string) || 50),
    );

    // Always scope to the authenticated user — ignores any userId query param
    const where: Record<string, unknown> = { userId: authUserId };
    if (read !== undefined) where.read = read === "true";
    if (type) where.type = type as string;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      prisma.notification.count({ where: { userId: authUserId, read: false } }),
    ]);

    res.json({ success: true, data: { notifications, unreadCount } });
  }),
);

/**
 * Create a notification for the authenticated user (internal/system use)
 * POST /api/notifications
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const {
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

    if (!type || !title || !message) {
      throw badRequest(
        "type, title, and message are required",
        "MISSING_REQUIRED_FIELDS",
      );
    }

    const notification = await prisma.notification.create({
      data: {
        userId: authUserId, // Always use authenticated user, never from body
        type,
        title,
        message,
        validationRunId: validationRunId ?? null,
        issueId: issueId ?? null,
        fileId: fileId ?? null,
        projectId: projectId ?? null,
        priority: priority || "NORMAL",
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    res.status(201).json({ success: true, data: notification });
  }),
);

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const id = req.params.id as string;

    // Verify ownership before updating
    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing)
      throw notFound("Notification not found", "NOTIFICATION_NOT_FOUND");
    if (existing.userId !== authUserId) throw forbidden("Access denied");

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });

    res.json({ success: true, data: notification });
  }),
);

/**
 * Mark multiple notifications as read (scoped to authenticated user)
 * PATCH /api/notifications/mark-read/bulk
 */
router.patch(
  "/mark-read/bulk",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const { notificationIds } = req.body;

    const where: Record<string, unknown> = { userId: authUserId, read: false };
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Only mark the specified IDs if they belong to the authenticated user
      where.id = { in: notificationIds };
    }

    const result = await prisma.notification.updateMany({
      where,
      data: { read: true, readAt: new Date() },
    });

    res.json({ success: true, data: { count: result.count } });
  }),
);

/**
 * Delete a notification (must be owned by authenticated user)
 * DELETE /api/notifications/:id
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const id = req.params.id as string;

    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!existing)
      throw notFound("Notification not found", "NOTIFICATION_NOT_FOUND");
    if (existing.userId !== authUserId) throw forbidden("Access denied");

    await prisma.notification.delete({ where: { id } });

    res.json({ success: true, message: "Notification deleted" });
  }),
);

/**
 * Delete all notifications for the authenticated user
 * DELETE /api/notifications
 */
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const { read } = req.query;

    const where: Record<string, unknown> = { userId: authUserId };
    if (read !== undefined) where.read = read === "true";

    const result = await prisma.notification.deleteMany({ where });

    res.json({ success: true, data: { count: result.count } });
  }),
);

/**
 * Get notification statistics for the authenticated user
 * GET /api/notifications/stats
 */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const authUserId = (req as { session?: { user?: { id?: string } } }).session
      ?.user?.id;
    if (!authUserId) throw unauthorized("Authentication required");

    const [total, unread, byType, byPriority] = await Promise.all([
      prisma.notification.count({ where: { userId: authUserId } }),
      prisma.notification.count({ where: { userId: authUserId, read: false } }),
      prisma.notification.groupBy({
        by: ["type"],
        where: { userId: authUserId, read: false },
        _count: true,
      }),
      prisma.notification.groupBy({
        by: ["priority"],
        where: { userId: authUserId, read: false },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
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
      },
    });
  }),
);

export default router;

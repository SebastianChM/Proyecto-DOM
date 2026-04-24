import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAdmin } from "../middleware/authorization";
import { asyncHandler } from "../lib/async-handler";
import { badRequest } from "../lib/errors";

const router = Router();

/**
 * GET /api/users
 * List users with pagination, search, and role filter (ADMIN only)
 * Query: ?page=1&pageSize=20&search=&role=
 */
router.get("/", requireAdmin, asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = (req.query.search as string)?.trim() || "";
    const role = (req.query.role as string)?.trim() || "";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          apsUserId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      data: users,
    });
}));

import { z } from "zod";

const updateUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

/**
 * PUT /api/admin/users/:id/role
 * Cambiar rol de un usuario (solo ADMIN)
 */
router.put("/admin/users/:id/role", requireAdmin, asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    // Validate input
    const validation = updateUserRoleSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Validation failed", "VALIDATION_ERROR", validation.error.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })));
    }

    const { role } = validation.data;

    // No permitir que el usuario se cambie su propio rol
    if (id === req.session?.user?.id) {
      throw badRequest("You cannot change your own role", "SELF_ROLE_CHANGE");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    res.json(user);
}));

export default router;

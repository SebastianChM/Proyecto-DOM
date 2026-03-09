import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAdmin } from "../middleware/authorization";
import { asyncHandler } from "../lib/async-handler";
import { badRequest } from "../lib/errors";

const router = Router();

/**
 * GET /api/users
 * Listar todos los usuarios (solo ADMIN)
 */
router.get("/", requireAdmin, asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        apsUserId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(users);
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
    const { id } = req.params;

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

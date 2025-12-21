import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAdmin } from "../middleware/authorization";

const router = Router();

/**
 * GET /api/users
 * Listar todos los usuarios (solo ADMIN)
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
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
  } catch (error: unknown) {
    console.error("Error listing users:", error);
    res.status(500).json({
      error: "Failed to list users",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

import { z } from "zod";

const updateUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});

/**
 * PUT /api/admin/users/:id/role
 * Cambiar rol de un usuario (solo ADMIN)
 */
router.put("/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    const validation = updateUserRoleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const { role } = validation.data;

    // No permitir que el usuario se cambie su propio rol
    if (id === req.session?.user?.id) {
      return res.status(400).json({
        error: "Cannot modify own role",
        message: "You cannot change your own role",
      });
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
  } catch (error: unknown) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      error: "Failed to update user role",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

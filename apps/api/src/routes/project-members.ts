/**
 * Project Members Routes
 *
 * Rutas para gestionar miembros de proyectos:
 * - Compartir proyectos (invitar usuarios)
 * - Cambiar roles de miembros
 * - Revocar acceso
 * - Listar miembros
 */

import { Router } from "express";
import type { Request } from "express";
import prisma from "../lib/prisma";
import { requirePermission } from "../middleware/authorization";
import { authorizationService } from "../services/authorization.service";
import { cacheService } from "../lib/redis";
import { logger } from "../lib/logger";
import { emailService } from "../services/email.service";
import { CONSTANTS } from "../config/constants";
import { env } from "../config/env";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, unauthorized, notFound, internal } from "../lib/errors";

const router = Router();

/**
 * GET /api/projects/:id/members
 * Listar miembros de un proyecto
 * Requiere: project:read
 */
import { z } from "zod";

// Validation Schemas
const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["EDITOR", "VIEWER_DOWNLOAD", "VIEWER"]),
});

const updateMemberSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER_DOWNLOAD", "VIEWER"]),
});

// Helper to extract id as projectId
const getProjectIdFromId = (req: Request) => req.params.id;

/**
 * GET /api/projects/:id/permissions
 * Get current user's permissions in a project
 * Returns: { role, permissions[], isOwner }
 */
router.get(
  "/:id/permissions",
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userId = req.session?.user?.id;

    if (!userId) throw unauthorized("Authentication required");

    // Get user permissions
    const permissions = await authorizationService.getUserPermissions(
      userId,
      projectId,
    );

    // Check if owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    // Get member role (if not owner)
    let role = "NONE";
    const isOwner = project?.ownerId === userId;

    if (isOwner) {
      role = "OWNER";
    } else {
      const member = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId },
        },
        select: { role: true },
      });
      if (member) {
        role = member.role;
      }
    }

    // Check if admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "ADMIN") {
      role = "ADMIN";
    }

    res.json({
      role,
      permissions: [...permissions],
      isOwner,
      isAdmin: user?.role === "ADMIN",
    });
  }),
);

/**
 * GET /api/projects/:id/members
 * Listar miembros de un proyecto
 * Requiere: project:read
 */
router.get(
  "/:id/members",
  requirePermission("project:read", getProjectIdFromId),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userId = req.session?.user?.id;

    if (!userId) throw unauthorized("Authentication required");

    const data = await authorizationService.getProjectMembers(
      projectId,
      userId,
    );

    const result = [];

    // Add owner
    if (data.owner) {
      result.push({
        userId: data.owner.id,
        role: "OWNER",
        user: {
          name: data.owner.name,
          email: data.owner.email,
          picture: undefined, // TODO: Add picture support
        },
      });
    }

    // Add members
    data.members.forEach((m) => {
      // Avoid adding owner twice if they are also in members list (unlikely but safe)
      if (m.id !== data.owner?.id) {
        result.push({
          userId: m.id,
          role: m.role,
          user: {
            name: m.name,
            email: m.email,
            picture: undefined,
          },
        });
      }
    });

    res.json(result);
  }),
);

/**
 * POST /api/projects/:id/members
 * Compartir proyecto con un usuario (invitar)
 * Requiere: member:invite
 */
router.post(
  "/:id/members",
  requirePermission("member:invite", getProjectIdFromId),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const userId = req.session?.user?.id;

    if (!userId) throw unauthorized("Authentication required");

    // Validate input
    const validation = inviteMemberSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { email, role } = validation.data;

    // Buscar usuario por email
    let targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      // Auto-provision user if they don't exist
      // This allows inviting users who haven't logged in yet
      try {
        targetUser = await prisma.user.create({
          data: {
            email,
            name: email.split("@")[0], // Use email prefix as temporary name
            apsUserId: `invited-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Temporary unique ID
            role: "USER",
          },
        });
      } catch (createError) {
        logger.error("[PROJECT_MEMBERS] Error auto-provisioning user", {
          error:
            createError instanceof Error
              ? (createError as Error).message
              : String(createError),
        });
        throw internal(
          "No se pudo registrar al usuario invitado",
          "USER_PROVISION_FAILED",
        );
      }
    }

    // Verificar que no sea el owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (project?.ownerId === targetUser.id) {
      throw badRequest("Cannot share with owner", "OWNER_SHARE_FORBIDDEN");
    }

    // Send Email Notification
    // Construct link: Dashboard URL / Project ID
    const baseUrl = env.FRONTEND_URL;
    const projectLink = `${baseUrl}${CONSTANTS.FRONTEND.DASHBOARD_PATH}/projects/${projectId}`;

    // Get inviter name for the email
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const inviterName = inviter?.name || "A user";

    // Get project name
    const projectInfo = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    const projectName = projectInfo?.name || "Project";

    // Send email
    await emailService.sendInvitationEmail(
      email,
      inviterName,
      projectName,
      role,
      projectLink,
    );

    // Crear o actualizar la relación de membresía
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUser.id,
        },
      },
      update: {
        role: role,
        invitedBy: userId,
      },
      create: {
        projectId,
        userId: targetUser.id,
        role: role,
        invitedBy: userId,
      },
    });

    // Obtener miembro creado con información del invitador
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: targetUser.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Obtener info del invitador por separado
    let invitedBy = null;
    if (member?.invitedBy) {
      invitedBy = await prisma.user.findUnique({
        where: { id: member.invitedBy },
        select: { id: true, name: true, email: true },
      });
    }

    res.status(201).json({
      success: true,
      member: {
        ...member,
        invitedByUser: invitedBy,
      },
    });
  }),
);

/**
 * PUT /api/projects/:id/members/:userId
 * Cambiar rol de un miembro
 * Requiere: member:update
 */
router.put(
  "/:id/members/:userId",
  requirePermission("member:update", getProjectIdFromId),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const targetUserId = req.params.userId;

    // Validate input
    const validation = updateMemberSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { role } = validation.data;

    // Verificar que el miembro existe
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: targetUserId,
      },
    });

    if (!member) {
      throw notFound("Member not found", "MEMBER_NOT_FOUND");
    }

    // No se puede cambiar rol de OWNER
    if (member.role === "OWNER") {
      throw badRequest("Cannot change owner role", "OWNER_ROLE_IMMUTABLE");
    }

    // Actualizar rol
    const updated = await prisma.projectMember.update({
      where: { id: member.id },
      data: { role: role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Invalidar cache de permisos
    await cacheService
      .invalidatePattern(`cache:permissions:${targetUserId}:*`)
      .catch((e) => logger.warn("Cache invalidation failed", { error: e }));

    res.json({
      success: true,
      member: updated,
    });
  }),
);

/**
 * DELETE /api/projects/:id/members/:userId
 * Revocar acceso a un usuario
 * Requiere: member:remove
 */
router.delete(
  "/:id/members/:userId",
  requirePermission("member:remove", getProjectIdFromId),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id;
    const targetUserId = req.params.userId;
    const requesterId = req.session?.user?.id;

    if (!requesterId) throw unauthorized("Authentication required");

    // Verificar que el miembro existe
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId: targetUserId,
      },
    });

    if (!member) {
      throw notFound("Member not found", "MEMBER_NOT_FOUND");
    }

    // No se puede revocar al OWNER
    if (member.role === "OWNER") {
      throw badRequest("Cannot remove owner", "OWNER_REMOVE_FORBIDDEN");
    }

    // Revocar acceso
    const success = await authorizationService.revokeAccess(
      projectId,
      targetUserId,
      requesterId,
    );

    if (!success) {
      throw internal("No se pudo revocar el acceso", "REVOKE_FAILED");
    }

    res.json({
      success: true,
      message: "Acceso revocado correctamente",
    });
  }),
);

export default router;

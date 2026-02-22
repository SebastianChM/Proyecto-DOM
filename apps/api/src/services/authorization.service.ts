/**
 * Authorization Service
 *
 * Sistema de permisos tipo SharePoint adaptado a BIM
 * Roles: ADMIN, OWNER, EDITOR, VIEWER_DOWNLOAD, VIEWER
 */

import prisma from "../lib/prisma";
import { cacheService, RedisKeys } from "../lib/redis";
import { logger } from "../lib/logger";

// Definición de permisos por rol
const ROLE_PERMISSIONS = {
  ADMIN: [
    // Full access - puede hacer TODO
    "project:create",
    "project:read",
    "project:update",
    "project:delete",
    "project:share",
    "project:archive",
    "file:create",
    "file:read",
    "file:update",
    "file:delete",
    "file:download",
    "member:invite",
    "member:remove",
    "member:update",
    "validation:run",
    "validation:read",
    "validation:resolve",
    "settings:read",
    "settings:update",
  ],
  OWNER: [
    // Owner del proyecto - casi todo menos configuración global
    "project:read",
    "project:update",
    "project:delete",
    "project:share",
    "project:archive",
    "file:create",
    "file:read",
    "file:update",
    "file:delete",
    "file:download",
    "member:invite",
    "member:remove",
    "member:update",
    "validation:run",
    "validation:read",
    "validation:resolve",
  ],
  EDITOR: [
    // Puede editar archivos y correr validaciones
    "project:read",
    "project:update", // Puede editar detalles del proyecto
    "file:create",
    "file:read",
    "file:update",
    "file:download",
    "validation:run",
    "validation:read",
    "validation:resolve",
  ],
  VIEWER_DOWNLOAD: [
    // Ver y descargar archivos
    "project:read",
    "file:read",
    "file:download",
    "validation:read",
  ],
  VIEWER: [
    // Solo lectura
    "project:read",
    "file:read",
    "validation:read",
  ],
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;
export type Permission = (typeof ROLE_PERMISSIONS)[Role][number];

export class AuthorizationService {
  /**
   * Verificar si un usuario tiene un permiso específico en un proyecto
   */
  async hasPermission(
    userId: string,
    projectId: string,
    permission: Permission,
  ): Promise<boolean> {
    try {
      // Cache key para permisos del usuario
      const cacheKey = RedisKeys.userPermissions(userId, projectId);

      // Intentar obtener del cache
      const cachedPermissions = await cacheService.get<string[]>(cacheKey);
      if (cachedPermissions) {
        return cachedPermissions.includes(permission);
      }

      // Obtener permisos desde DB
      const permissions = await this.getUserPermissions(userId, projectId);

      // Cachear por 5 minutos
      await cacheService.set(cacheKey, permissions, 300);

      return permissions.includes(permission);
    } catch (error) {
      logger.error("[AUTHORIZATION] Error checking permission", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false; // Fail closed - denegar acceso en caso de error
    }
  }

  /**
   * Obtener todos los permisos de un usuario en un proyecto
   */
  async getUserPermissions(
    userId: string,
    projectId: string,
  ): Promise<readonly string[]> {
    // Verificar si es admin global
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "ADMIN") {
      return ROLE_PERMISSIONS.ADMIN as readonly string[];
    }

    // Verificar si es owner del proyecto
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (project?.ownerId === userId) {
      return ROLE_PERMISSIONS.OWNER as readonly string[];
    }

    // Verificar si es miembro del proyecto
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!member) {
      return [] as readonly string[]; // No tiene acceso al proyecto
    }

    // Retornar permisos según rol
    return (ROLE_PERMISSIONS[member.role as Role] || []) as readonly string[];
  }

  /**
   * Verificar si un usuario tiene acceso a un proyecto
   */
  async canAccessProject(userId: string, projectId: string): Promise<boolean> {
    return this.hasPermission(userId, projectId, "project:read");
  }

  /**
   * Compartir proyecto con un usuario
   */
  async shareProject(
    projectId: string,
    targetUserId: string,
    role: Role,
    invitedBy: string,
  ): Promise<boolean> {
    try {
      // Verificar que quien invita tenga permiso
      const canShare = await this.hasPermission(
        invitedBy,
        projectId,
        "project:share",
      );
      if (!canShare) {
        throw new Error("No tienes permiso para compartir este proyecto");
      }

      // Crear o actualizar membresía
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
        update: {
          role,
          invitedBy,
        },
        create: {
          projectId,
          userId: targetUserId,
          role,
          invitedBy,
          acceptedAt: new Date(), // Auto-accept por ahora
        },
      });

      // Invalidar cache de permisos
      await this.invalidateUserCache(targetUserId, projectId);

      return true;
    } catch (error) {
      logger.error("[AUTHORIZATION] Error sharing project", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Remover acceso de un usuario a un proyecto
   */
  async revokeAccess(
    projectId: string,
    targetUserId: string,
    revokedBy: string,
  ): Promise<boolean> {
    try {
      // Verificar permiso
      const canRemove = await this.hasPermission(
        revokedBy,
        projectId,
        "member:remove",
      );
      if (!canRemove) {
        throw new Error("No tienes permiso para remover miembros");
      }

      // No se puede remover al owner
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });

      if (project?.ownerId === targetUserId) {
        throw new Error("No se puede remover al propietario del proyecto");
      }

      // Eliminar membresía
      await prisma.projectMember.delete({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
      });

      // Invalidar cache
      await this.invalidateUserCache(targetUserId, projectId);

      return true;
    } catch (error) {
      logger.error("[AUTHORIZATION] Error revoking access", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Listar miembros de un proyecto con sus roles
   */
  async getProjectMembers(projectId: string, requesterId: string) {
    // Verificar acceso
    const canRead = await this.hasPermission(
      requesterId,
      projectId,
      "project:read",
    );
    if (!canRead) {
      throw new Error("No tienes acceso a este proyecto");
    }

    // Obtener owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Obtener miembros
    const members = await prisma.projectMember.findMany({
      where: { projectId },
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

    return {
      owner: project?.owner,
      members: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        invitedAt: m.invitedAt,
        acceptedAt: m.acceptedAt,
      })),
    };
  }

  /**
   * Invalidar cache de permisos de un usuario
   */
  private async invalidateUserCache(userId: string, projectId: string) {
    const cacheKey = RedisKeys.userPermissions(userId, projectId);
    await cacheService.del(cacheKey);
  }
}

export const authorizationService = new AuthorizationService();

/**
 * Authorization Middleware
 *
 * Middleware para verificar permisos en rutas protegidas
 */

import { Request, Response, NextFunction } from "express";
import {
  authorizationService,
  Permission,
} from "../services/authorization.service";
import { logger } from "../lib/logger";

/**
 * Middleware que requiere un permiso específico para acceder a la ruta
 *
 * @param permission - Permiso requerido (ej: 'project:read', 'file:create')
 * @param getProjectId - Función para extraer projectId del request (opcional)
 */
export const requirePermission = (
  permission: Permission,
  getProjectId?: (req: Request) => string,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.session?.user?.id) {
        logger.warn("[AUTH] 401 - Unauthenticated access", {
          method: req.method,
          path: req.path,
          ip: req.ip,
          requestId: req.headers["x-request-id"],
        });
        return res.status(401).json({
          error: "Authentication required",
          message: "Debes iniciar sesión para acceder a este recurso",
        });
      }

      const userId = req.session.user.id;

      // Obtener projectId
      let projectId: string;

      if (getProjectId) {
        projectId = getProjectId(req);
      } else if (req.params.projectId) {
        projectId = req.params.projectId;
      } else if (req.body.projectId) {
        projectId = req.body.projectId;
      } else if (req.query.projectId) {
        projectId = req.query.projectId as string;
      } else {
        return res.status(400).json({
          error: "Bad request",
          message: "No se pudo determinar el proyecto",
        });
      }

      // Verificar permiso
      const hasPermission = await authorizationService.hasPermission(
        userId,
        projectId,
        permission,
      );

      if (!hasPermission) {
        logger.warn("[AUTH] 403 - Permission denied", {
          method: req.method,
          path: req.path,
          user: req.session.user.email,
          requiredPermission: permission,
          projectId,
          requestId: req.headers["x-request-id"],
        });
        return res.status(403).json({
          error: "Forbidden",
          message: `No tienes permiso para: ${permission}`,
          requiredPermission: permission,
        });
      }

      next();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[AUTH] Authorization middleware error", { error: msg });
      res.status(500).json({
        error: "Authorization check failed",
        message: msg,
      });
    }
  };
};

/**
 * Middleware que requiere ser ADMIN global
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.session?.user?.id) {
      logger.warn("[AUTH] 401 - Unauthenticated access", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: req.headers["x-request-id"],
      });
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (req.session.user.role !== "ADMIN") {
      logger.warn("[AUTH] 403 - Admin required", {
        method: req.method,
        path: req.path,
        user: req.session.user.email,
        role: req.session.user.role,
        requestId: req.headers["x-request-id"],
      });
      return res.status(403).json({
        error: "Forbidden",
        message: "Se requiere rol de administrador",
      });
    }

    next();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[AUTH] Admin check error", { error: msg });
    res.status(500).json({
      error: "Authorization check failed",
      message: msg,
    });
  }
};

/**
 * Middleware que verifica si el usuario es owner o miembro del proyecto
 */
export const requireProjectAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const getProjectId = (req: Request) => {
    return req.params.id || req.params.projectId;
  };

  return requirePermission("project:read", getProjectId)(req, res, next);
};

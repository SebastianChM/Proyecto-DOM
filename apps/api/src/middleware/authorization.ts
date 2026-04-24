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
import { maskEmail } from "../lib/redact";

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
          ...logger.fromReq(req),
          ip: req.ip,
        });
        return res.status(401).json({
          error: "Authentication required",
          type: "Unauthorized",
          message: "Debes iniciar sesión para acceder a este recurso",
          requestId: req.headers["x-request-id"],
        });
      }

      const userId = req.session.user.id;

      // Obtener projectId
      let projectId: string;

      if (getProjectId) {
        projectId = getProjectId(req);
      } else if (req.params.projectId) {
        projectId = req.params.projectId as string;
      } else if (req.body.projectId) {
        projectId = req.body.projectId;
      } else if (req.query.projectId) {
        projectId = req.query.projectId as string;
      } else {
        return res.status(400).json({
          error: "Bad request",
          type: "BadRequest",
          message: "No se pudo determinar el proyecto",
          requestId: req.headers["x-request-id"],
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
          ...logger.fromReq(req),
          email: maskEmail(req.session.user.email),
          requiredPermission: permission,
          projectId,
        });
        return res.status(403).json({
          error: "Forbidden",
          type: "Forbidden",
          message: `No tienes permiso para: ${permission}`,
          requiredPermission: permission,
          requestId: req.headers["x-request-id"],
        });
      }

      next();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[AUTH] Authorization middleware error", {
        ...logger.fromReq(req),
        error: msg,
      });
      res.status(500).json({
        error: "Authorization check failed",
        type: "InternalServerError",
        message: msg,
        requestId: req.headers["x-request-id"],
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
        ...logger.fromReq(req),
        ip: req.ip,
      });
      return res.status(401).json({
        error: "Authentication required",
        type: "Unauthorized",
        requestId: req.headers["x-request-id"],
      });
    }

    if (req.session.user.role !== "ADMIN") {
      logger.warn("[AUTH] 403 - Admin required", {
        ...logger.fromReq(req),
        email: maskEmail(req.session.user.email),
        role: req.session.user.role,
      });
      return res.status(403).json({
        error: "Forbidden",
        type: "Forbidden",
        message: "Se requiere rol de administrador",
        requestId: req.headers["x-request-id"],
      });
    }

    next();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[AUTH] Admin check error", {
      ...logger.fromReq(req),
      error: msg,
    });
    res.status(500).json({
      error: "Authorization check failed",
      type: "InternalServerError",
      message: msg,
      requestId: req.headers["x-request-id"],
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
    return (req.params.id || req.params.projectId) as string;
  };

  return requirePermission("project:read", getProjectId)(req, res, next);
};

/**
 * Authorization Middleware
 * 
 * Middleware para verificar permisos en rutas protegidas
 */

import { Request, Response, NextFunction } from 'express';
import { authorizationService, Permission } from '../services/authorization.service';

/**
 * Middleware que requiere un permiso específico para acceder a la ruta
 * 
 * @param permission - Permiso requerido (ej: 'project:read', 'file:create')
 * @param getProjectId - Función para extraer projectId del request (opcional)
 */
export const requirePermission = (
  permission: Permission,
  getProjectId?: (req: Request) => string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.session?.user?.id) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Debes iniciar sesión para acceder a este recurso'
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
        // Si no hay projectId, no podemos verificar permisos
        return res.status(400).json({
          error: 'Bad request',
          message: 'No se pudo determinar el proyecto'
        });
      }

      // Verificar permiso
      const hasPermission = await authorizationService.hasPermission(
        userId,
        projectId,
        permission
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `No tienes permiso para: ${permission}`,
          requiredPermission: permission
        });
      }

      // Usuario tiene permiso, continuar
      next();
    } catch (error: unknown) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({
        error: 'Authorization check failed',
        message: (error as Error).message
      });
    }
  };
};

/**
 * Middleware que requiere ser ADMIN global
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Verificar rol de admin
    if (req.session.user.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Se requiere rol de administrador'
      });
    }

    next();
  } catch (error: unknown) {
    console.error('Admin check error:', error);
    res.status(500).json({
      error: 'Authorization check failed',
      message: (error as Error).message
    });
  }
};

/**
 * Middleware que verifica si el usuario es owner o miembro del proyecto
 */
export const requireProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  // Custom getProjectId function that handles both :id and :projectId params
  const getProjectId = (req: Request) => {
    return req.params.id || req.params.projectId;
  };

  return requirePermission('project:read', getProjectId)(req, res, next);
};

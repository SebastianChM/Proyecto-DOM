/**
 * Workflow API Routes
 *
 * Provides REST API endpoints for workflow management:
 * - GET /api/workflows/templates - List available templates
 * - GET /api/workflows/:entityType/:entityId - Get workflow for entity
 * - GET /api/workflows/:entityType/:entityId/transitions - Get available transitions
 * - POST /api/workflows/:entityType/:entityId/transition - Execute transition
 * - GET /api/workflows/:entityType/:entityId/history - Get audit trail
 * - POST /api/workflows/:entityType/:entityId/cancel - Cancel workflow (admin)
 * - POST /api/workflows/:entityType/:entityId/reset - Reset workflow (admin)
 *
 * @module routes/workflows
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  workflowService,
  WorkflowError,
  EntityType,
  UserContext,
} from "../services/workflow.service";

const router = Router();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Validate entity type parameter
 */
function validateEntityType(req: Request, res: Response, next: NextFunction) {
  const { entityType } = req.params;
  const validTypes: EntityType[] = ["PROJECT", "FILE", "VALIDATION"];

  if (!validTypes.includes(entityType as EntityType)) {
    return res.status(400).json({
      error: "Invalid entity type",
      code: "INVALID_ENTITY_TYPE",
      message: `Entity type must be one of: ${validTypes.join(", ")}`,
      received: entityType,
    });
  }

  next();
}

/**
 * Extract user context from session
 */
function getUserContext(req: Request): UserContext | null {
  // req.session is populated by cookie-session, type might be inferred as generic
  const session = req.session as {
    user?: { id: string; name?: string; email?: string; role?: string };
  } | null;
  const user = session?.user;

  if (!user) return null;

  return {
    id: user.id,
    name: user.name || user.email || "Unknown",
    email: user.email || "unknown@example.com", // Fix possible undefined
    role: user.role || "VIEWER",
  };
}

/**
 * Get user's role for a specific entity
 */
async function getEntityRole(
  userId: string,
  entityType: EntityType,
  entityId: string,
): Promise<string> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    if (entityType === "PROJECT") {
      // Check if owner
      const project = await prisma.project.findUnique({
        where: { id: entityId },
        select: { ownerId: true },
      });

      if (project?.ownerId === userId) {
        return "OWNER";
      }

      // Check project membership
      const member = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: entityId, userId },
        },
        select: { role: true },
      });

      if (member) {
        return member.role;
      }
    } else if (entityType === "FILE") {
      // Get file's project and check role there
      const file = await prisma.file.findUnique({
        where: { id: entityId },
        select: { projectId: true, uploadedBy: true },
      });

      if (file) {
        // Uploader has EDITOR role
        if (file.uploadedBy === userId) {
          return "EDITOR";
        }

        // Check project role
        return getEntityRole(userId, "PROJECT", file.projectId);
      }
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role === "ADMIN") {
      return "ADMIN";
    }

    return "NONE";
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Error handler for workflow errors
 */
function handleWorkflowError(error: unknown, res: Response) {
  if (error instanceof WorkflowError) {
    return res.status(error.statusCode).json({
      error: error.name,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  console.error("Unexpected workflow error:", error);
  return res.status(500).json({
    error: "InternalServerError",
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred while processing your request",
  });
}

// ============================================
// TEMPLATE ROUTES
// ============================================

/**
 * GET /api/workflows/templates
 * List all available workflow templates
 *
 * Query params:
 * - entityType: Filter by entity type (PROJECT, FILE, VALIDATION)
 */
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const { entityType } = req.query;

    const templates = await workflowService.getTemplates(
      entityType as EntityType | undefined,
    );

    res.json(templates);
  } catch (error) {
    handleWorkflowError(error, res);
  }
});

/**
 * GET /api/workflows/templates/:templateId
 * Get a specific template with states and transitions
 */
router.get("/templates/:templateId", async (req: Request, res: Response) => {
  try {
    const { templateId } = req.params;

    const template = await workflowService.getTemplateById(templateId);

    if (!template) {
      return res.status(404).json({
        error: "NotFound",
        code: "TEMPLATE_NOT_FOUND",
        message: `Template with ID "${templateId}" not found`,
      });
    }

    res.json(template);
  } catch (error) {
    handleWorkflowError(error, res);
  }
});

// ============================================
// WORKFLOW INSTANCE ROUTES
// ============================================

/**
 * GET /api/workflows/:entityType/:entityId
 * Get workflow instance for an entity
 */
router.get(
  "/:entityType/:entityId",
  validateEntityType,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const user = getUserContext(req);

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        });
      }

      // Get user's role for this entity
      const userRole = await getEntityRole(
        user.id,
        entityType as EntityType,
        entityId,
      );

      if (userRole === "NONE") {
        return res.status(403).json({
          error: "Forbidden",
          code: "ACCESS_DENIED",
          message: "You do not have access to this entity",
        });
      }

      let instance = await workflowService.getInstance(
        entityType as EntityType,
        entityId,
      );

      // Auto-create workflow if doesn't exist
      if (!instance) {
        instance = await workflowService.createInstance(
          entityType as EntityType,
          entityId,
          user.id,
        );
      }

      // Get available transitions for current user
      const availableTransitions =
        await workflowService.getAvailableTransitions(
          entityType as EntityType,
          entityId,
          userRole,
        );

      res.json({
        ...instance,
        availableTransitions,
        userRole,
      });
    } catch (error) {
      handleWorkflowError(error, res);
    }
  },
);

/**
 * GET /api/workflows/:entityType/:entityId/transitions
 * Get available transitions for current user
 */
router.get(
  "/:entityType/:entityId/transitions",
  validateEntityType,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const user = getUserContext(req);

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        });
      }

      const userRole = await getEntityRole(
        user.id,
        entityType as EntityType,
        entityId,
      );

      if (userRole === "NONE") {
        return res.status(403).json({
          error: "Forbidden",
          code: "ACCESS_DENIED",
          message: "You do not have access to this entity",
        });
      }

      const transitions = await workflowService.getAvailableTransitions(
        entityType as EntityType,
        entityId,
        userRole,
      );

      res.json(transitions);
    } catch (error) {
      handleWorkflowError(error, res);
    }
  },
);

/**
 * POST /api/workflows/:entityType/:entityId/transition
 * Perform a workflow transition
 *
 * Body:
 * - transitionName: string (required) - Name of the transition to perform
 * - comment: string (optional) - Comment for audit trail
 * - metadata: object (optional) - Additional metadata
 */
router.post(
  "/:entityType/:entityId/transition",
  validateEntityType,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { transitionName, comment, metadata } = req.body;
      const user = getUserContext(req);

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        });
      }

      // Validate required fields
      if (!transitionName || typeof transitionName !== "string") {
        return res.status(400).json({
          error: "ValidationError",
          code: "MISSING_TRANSITION_NAME",
          message: "transitionName is required and must be a string",
        });
      }

      // Get user's role
      const userRole = await getEntityRole(
        user.id,
        entityType as EntityType,
        entityId,
      );

      if (userRole === "NONE") {
        return res.status(403).json({
          error: "Forbidden",
          code: "ACCESS_DENIED",
          message: "You do not have access to this entity",
        });
      }

      // Update user context with entity role
      const userWithRole: UserContext = {
        ...user,
        role: userRole,
      };

      const instance = await workflowService.performTransition(
        entityType as EntityType,
        entityId,
        { transitionName, comment, metadata },
        userWithRole,
      );

      // Get updated available transitions
      const availableTransitions =
        await workflowService.getAvailableTransitions(
          entityType as EntityType,
          entityId,
          userRole,
        );

      res.json({
        success: true,
        message: "Transition completed successfully",
        workflow: {
          ...instance,
          availableTransitions,
          userRole,
        },
      });
    } catch (error) {
      handleWorkflowError(error, res);
    }
  },
);

/**
 * GET /api/workflows/:entityType/:entityId/history
 * Get workflow history/audit trail
 *
 * Query params:
 * - limit: number (default: 50) - Max entries to return
 */
router.get(
  "/:entityType/:entityId/history",
  validateEntityType,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const user = getUserContext(req);

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        });
      }

      const userRole = await getEntityRole(
        user.id,
        entityType as EntityType,
        entityId,
      );

      if (userRole === "NONE") {
        return res.status(403).json({
          error: "Forbidden",
          code: "ACCESS_DENIED",
          message: "You do not have access to this entity",
        });
      }

      const history = await workflowService.getHistory(
        entityType as EntityType,
        entityId,
        limit,
      );

      res.json(history);
    } catch (error) {
      handleWorkflowError(error, res);
    }
  },
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * POST /api/workflows/:entityType/:entityId/cancel
 * Cancel a workflow (admin/owner only)
 *
 * Body:
 * - reason: string (optional) - Reason for cancellation
 */
router.post(
  "/:entityType/:entityId/cancel",
  validateEntityType,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { reason } = req.body;
      const user = getUserContext(req);

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        });
      }

      const userRole = await getEntityRole(
        user.id,
        entityType as EntityType,
        entityId,
      );

      // Only admin or owner can cancel
      if (!["ADMIN", "OWNER"].includes(userRole)) {
        return res.status(403).json({
          error: "Forbidden",
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Only administrators or owners can cancel workflows",
        });
      }

      const userWithRole: UserContext = { ...user, role: userRole };

      const instance = await workflowService.cancelWorkflow(
        entityType as EntityType,
        entityId,
        userWithRole,
        reason,
      );

      res.json({
        success: true,
        message: "Workflow cancelled successfully",
        workflow: instance,
      });
    } catch (error) {
      handleWorkflowError(error, res);
    }
  },
);

/**
 * POST /api/workflows/:entityType/:entityId/reset
 * Reset a workflow to initial state (admin only)
 *
 * Body:
 * - reason: string (optional) - Reason for reset
 */
router.post(
  "/:entityType/:entityId/reset",
  validateEntityType,
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const { reason } = req.body;
      const user = getUserContext(req);

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "AUTH_REQUIRED",
          message: "Authentication required",
        });
      }

      const userRole = await getEntityRole(
        user.id,
        entityType as EntityType,
        entityId,
      );

      // Only admin can reset
      if (userRole !== "ADMIN") {
        return res.status(403).json({
          error: "Forbidden",
          code: "ADMIN_REQUIRED",
          message: "Only administrators can reset workflows",
        });
      }

      const userWithRole: UserContext = { ...user, role: userRole };

      const instance = await workflowService.resetWorkflow(
        entityType as EntityType,
        entityId,
        userWithRole,
        reason,
      );

      // Get available transitions
      const availableTransitions =
        await workflowService.getAvailableTransitions(
          entityType as EntityType,
          entityId,
          userRole,
        );

      res.json({
        success: true,
        message: "Workflow reset successfully",
        workflow: {
          ...instance,
          availableTransitions,
          userRole,
        },
      });
    } catch (error) {
      handleWorkflowError(error, res);
    }
  },
);

export default router;

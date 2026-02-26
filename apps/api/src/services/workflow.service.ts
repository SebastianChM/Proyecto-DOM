/**
 * Workflow Service - Enterprise Grade Workflow Engine
 *
 * Provides complete workflow management with:
 * - State machine transitions
 * - Permission-based access control
 * - Comprehensive audit trail
 * - Automatic notifications
 * - Condition validation
 *
 * @module services/workflow.service
 */

import {
  WorkflowInstance,
  WorkflowTemplate,
  WorkflowState,
  WorkflowTransition,
  WorkflowHistory,
} from "@prisma/client";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

// ============================================
// CUSTOM ERROR CLASSES
// ============================================

/**
 * Base class for workflow-related errors
 */
export class WorkflowError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, WorkflowError.prototype);
  }
}

/**
 * Error when workflow template is not found
 */
export class WorkflowTemplateNotFoundError extends WorkflowError {
  constructor(templateId?: string, entityType?: string) {
    super(
      templateId
        ? `Workflow template with ID "${templateId}" not found`
        : `No default workflow template found for entity type "${entityType}"`,
      "WORKFLOW_TEMPLATE_NOT_FOUND",
      404,
      { templateId, entityType },
    );
    this.name = "WorkflowTemplateNotFoundError";
  }
}

/**
 * Error when workflow instance is not found
 */
export class WorkflowInstanceNotFoundError extends WorkflowError {
  constructor(entityType: string, entityId: string) {
    super(
      `No workflow instance found for ${entityType} with ID "${entityId}"`,
      "WORKFLOW_INSTANCE_NOT_FOUND",
      404,
      { entityType, entityId },
    );
    this.name = "WorkflowInstanceNotFoundError";
  }
}

/**
 * Error when transition is not valid
 */
export class InvalidTransitionError extends WorkflowError {
  constructor(fromState: string, transitionName: string, reason: string) {
    super(
      `Cannot perform transition "${transitionName}" from state "${fromState}": ${reason}`,
      "INVALID_TRANSITION",
      400,
      { fromState, transitionName, reason },
    );
    this.name = "InvalidTransitionError";
  }
}

/**
 * Error when user lacks permission for transition
 */
export class TransitionPermissionError extends WorkflowError {
  constructor(transitionName: string, requiredRole: string, userRole: string) {
    super(
      `You do not have permission to perform "${transitionName}". Required role: ${requiredRole}, Your role: ${userRole}`,
      "TRANSITION_PERMISSION_DENIED",
      403,
      { transitionName, requiredRole, userRole },
    );
    this.name = "TransitionPermissionError";
  }
}

/**
 * Error when transition conditions are not met
 */
export class TransitionConditionsNotMetError extends WorkflowError {
  constructor(transitionName: string, failedConditions: string[]) {
    super(
      `Cannot perform "${transitionName}": conditions not met`,
      "TRANSITION_CONDITIONS_NOT_MET",
      400,
      { transitionName, failedConditions },
    );
    this.name = "TransitionConditionsNotMetError";
  }
}

/**
 * Error when comment is required but not provided
 */
export class CommentRequiredError extends WorkflowError {
  constructor(transitionName: string) {
    super(
      `A comment is required to perform "${transitionName}"`,
      "COMMENT_REQUIRED",
      400,
      { transitionName },
    );
    this.name = "CommentRequiredError";
  }
}

/**
 * Error when workflow is in a final state
 */
export class WorkflowCompletedError extends WorkflowError {
  constructor(entityType: string, entityId: string) {
    super(
      `Workflow for ${entityType} "${entityId}" is already completed and cannot be modified`,
      "WORKFLOW_COMPLETED",
      400,
      { entityType, entityId },
    );
    this.name = "WorkflowCompletedError";
  }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export type EntityType = "PROJECT" | "FILE" | "VALIDATION";

export interface WorkflowCondition {
  type: string;
  value?: unknown;
}

export interface WorkflowAction {
  type: "notify" | "setField" | "webhook" | "email";
  target?: string;
  template?: string;
  field?: string;
  value?: unknown;
  url?: string;
}

export interface TransitionInput {
  transitionName: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface UserContext {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export interface AvailableTransition {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  icon?: string | null;
  buttonVariant: string;
  requireComment: boolean;
  requireConfirmation: boolean;
  confirmationMessage?: string | null;
  toState: {
    name: string;
    displayName: string;
    color: string;
  };
}

export interface WorkflowInstanceWithDetails extends WorkflowInstance {
  template: WorkflowTemplate;
  currentState: WorkflowState;
  history: WorkflowHistory[];
}

// ============================================
// ROLE HIERARCHY
// ============================================

const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 100,
  OWNER: 80,
  EDITOR: 60,
  VIEWER_DOWNLOAD: 40,
  VIEWER: 20,
  NONE: 0,
};

function hasRequiredRole(
  userRole: string,
  requiredRole: string | null,
): boolean {
  if (!requiredRole) return true; // No role required
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

// ============================================
// WORKFLOW SERVICE CLASS
// ============================================

export class WorkflowService {
  // ========================================
  // TEMPLATE MANAGEMENT
  // ========================================

  /**
   * Get all available workflow templates
   */
  async getTemplates(entityType?: EntityType): Promise<WorkflowTemplate[]> {
    const where = entityType
      ? { entityType, isActive: true }
      : { isActive: true };

    return prisma.workflowTemplate.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  /**
   * Get a specific template by ID with all states and transitions
   */
  async getTemplateById(templateId: string): Promise<
    | (WorkflowTemplate & {
        states: WorkflowState[];
        transitions: WorkflowTransition[];
      })
    | null
  > {
    return prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        states: { orderBy: { order: "asc" } },
        transitions: true,
      },
    });
  }

  /**
   * Get the default template for an entity type
   */
  async getDefaultTemplate(
    entityType: EntityType,
  ): Promise<WorkflowTemplate | null> {
    return prisma.workflowTemplate.findFirst({
      where: {
        entityType,
        isDefault: true,
        isActive: true,
      },
      include: {
        states: { orderBy: { order: "asc" } },
        transitions: true,
      },
    });
  }

  // ========================================
  // WORKFLOW INSTANCE MANAGEMENT
  // ========================================

  /**
   * Create a new workflow instance for an entity
   *
   * @param entityType - Type of entity (PROJECT, FILE, VALIDATION)
   * @param entityId - ID of the entity
   * @param userId - ID of user starting the workflow
   * @param templateId - Optional specific template ID (uses default if not provided)
   * @returns The created workflow instance
   * @throws WorkflowTemplateNotFoundError if no template found
   */
  async createInstance(
    entityType: EntityType,
    entityId: string,
    userId?: string,
    templateId?: string,
  ): Promise<WorkflowInstanceWithDetails> {
    // Check if instance already exists
    const existing = await prisma.workflowInstance.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });

    if (existing) {
      // Return existing instance instead of error
      return this.getInstance(
        entityType,
        entityId,
      ) as Promise<WorkflowInstanceWithDetails>;
    }

    // Get template
    let template: (WorkflowTemplate & { states: WorkflowState[] }) | null;

    if (templateId) {
      template = await prisma.workflowTemplate.findUnique({
        where: { id: templateId, isActive: true },
        include: { states: { orderBy: { order: "asc" } } },
      });
      if (!template) {
        throw new WorkflowTemplateNotFoundError(templateId);
      }
    } else {
      template = await prisma.workflowTemplate.findFirst({
        where: { entityType, isDefault: true, isActive: true },
        include: { states: { orderBy: { order: "asc" } } },
      });
      if (!template) {
        throw new WorkflowTemplateNotFoundError(undefined, entityType);
      }
    }

    // Find initial state
    const initialState = template.states.find((s) => s.isInitial);
    if (!initialState) {
      throw new WorkflowError(
        `Template "${template.name}" has no initial state defined`,
        "NO_INITIAL_STATE",
        500,
      );
    }

    // Create instance in transaction
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const instance = await prisma.$transaction(async (tx) => {
      const newInstance = await tx.workflowInstance.create({
        data: {
          templateId: template!.id,
          entityType,
          entityId,
          currentStateId: initialState.id,
          currentStateName: initialState.name,
          currentStateDisplay: initialState.displayName,
          currentStateColor: initialState.color,
          status: "ACTIVE",
          startedBy: userId,
        },
      });

      // Create initial history entry
      await tx.workflowHistory.create({
        data: {
          instanceId: newInstance.id,
          fromStateName: "NONE",
          fromStateDisplay: "Not Started",
          toStateName: initialState.name,
          toStateDisplay: initialState.displayName,
          performedById: userId || "SYSTEM",
          performedByName: userId ? "User" : "System",
          metadata: JSON.stringify({ action: "workflow_started" }),
        },
      });

      return newInstance;
    });

    return this.getInstance(
      entityType,
      entityId,
    ) as Promise<WorkflowInstanceWithDetails>;
  }

  /**
   * Get workflow instance for an entity
   */
  async getInstance(
    entityType: EntityType,
    entityId: string,
  ): Promise<WorkflowInstanceWithDetails | null> {
    const instance = await prisma.workflowInstance.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
      include: {
        template: true,
        currentState: true,
        history: {
          orderBy: { performedAt: "desc" },
          take: 50,
        },
      },
    });

    return instance as WorkflowInstanceWithDetails | null;
  }

  /**
   * Get or create workflow instance
   * Creates with default template if doesn't exist
   */
  async getOrCreateInstance(
    entityType: EntityType,
    entityId: string,
    userId?: string,
  ): Promise<WorkflowInstanceWithDetails> {
    let instance = await this.getInstance(entityType, entityId);

    if (!instance) {
      instance = await this.createInstance(entityType, entityId, userId);
    }

    return instance;
  }

  // ========================================
  // TRANSITIONS
  // ========================================

  /**
   * Get available transitions for current state
   *
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @param userRole - Current user's role for permission filtering
   * @returns Array of available transitions
   */
  async getAvailableTransitions(
    entityType: EntityType,
    entityId: string,
    userRole: string,
  ): Promise<AvailableTransition[]> {
    const instance = await this.getInstance(entityType, entityId);

    if (!instance) {
      return [];
    }

    if (instance.status !== "ACTIVE") {
      return []; // No transitions if workflow is completed/cancelled
    }

    const transitions = await prisma.workflowTransition.findMany({
      where: {
        templateId: instance.templateId,
        fromStateId: instance.currentStateId,
      },
      include: {
        toState: true,
      },
    });

    // Filter by role and map to response format
    return transitions
      .filter((t) => hasRequiredRole(userRole, t.requiredRole))
      .map((t) => ({
        id: t.id,
        name: t.name,
        displayName: t.displayName,
        description: t.description,
        icon: t.icon,
        buttonVariant: t.buttonVariant,
        requireComment: t.requireComment,
        requireConfirmation: t.requireConfirmation,
        confirmationMessage: t.confirmationMessage,
        toState: {
          name: t.toState.name,
          displayName: t.toState.displayName,
          color: t.toState.color,
        },
      }));
  }

  /**
   * Perform a workflow transition
   *
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @param input - Transition input with name and optional comment
   * @param user - User context performing the transition
   * @returns Updated workflow instance
   * @throws Various WorkflowError subtypes on failure
   */
  async performTransition(
    entityType: EntityType,
    entityId: string,
    input: TransitionInput,
    user: UserContext,
  ): Promise<WorkflowInstanceWithDetails> {
    const { transitionName, comment, metadata } = input;

    // Get current instance
    const instance = await this.getInstance(entityType, entityId);

    if (!instance) {
      throw new WorkflowInstanceNotFoundError(entityType, entityId);
    }

    // Check if workflow is still active
    if (instance.status !== "ACTIVE") {
      throw new WorkflowCompletedError(entityType, entityId);
    }

    // Find the transition
    const transition = await prisma.workflowTransition.findFirst({
      where: {
        templateId: instance.templateId,
        fromStateId: instance.currentStateId,
        name: transitionName,
      },
      include: {
        toState: true,
      },
    });

    if (!transition) {
      throw new InvalidTransitionError(
        instance.currentStateName,
        transitionName,
        "Transition not found or not available from current state",
      );
    }

    // Check permission
    if (!hasRequiredRole(user.role, transition.requiredRole)) {
      throw new TransitionPermissionError(
        transition.displayName,
        transition.requiredRole || "Unknown",
        user.role,
      );
    }

    // Check if comment is required
    if (transition.requireComment && !comment?.trim()) {
      throw new CommentRequiredError(transition.displayName);
    }

    // Validate conditions (if any)
    if (transition.conditions) {
      const conditions = JSON.parse(
        transition.conditions,
      ) as WorkflowCondition[];
      const failedConditions = await this.validateConditions(
        conditions,
        entityType,
        entityId,
      );

      if (failedConditions.length > 0) {
        throw new TransitionConditionsNotMetError(
          transition.displayName,
          failedConditions,
        );
      }
    }

    // Calculate duration in previous state
    const lastHistoryEntry = await prisma.workflowHistory.findFirst({
      where: { instanceId: instance.id },
      orderBy: { performedAt: "desc" },
    });

    const durationInPreviousState = lastHistoryEntry
      ? Math.floor((Date.now() - lastHistoryEntry.performedAt.getTime()) / 1000)
      : 0;

    // Perform transition in transaction
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const updatedInstance = await prisma.$transaction(async (tx) => {
      // Determine if this is a final state
      const isCompleting = transition.toState.isFinal;

      // Update instance
      const updated = await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          currentStateId: transition.toStateId,
          currentStateName: transition.toState.name,
          currentStateDisplay: transition.toState.displayName,
          currentStateColor: transition.toState.color,
          status: isCompleting ? "COMPLETED" : "ACTIVE",
          completedAt: isCompleting ? new Date() : null,
        },
      });

      // Create history entry
      await tx.workflowHistory.create({
        data: {
          instanceId: instance.id,
          fromStateName: instance.currentStateName,
          fromStateDisplay: instance.currentStateDisplay,
          toStateName: transition.toState.name,
          toStateDisplay: transition.toState.displayName,
          transitionName: transition.name,
          transitionDisplay: transition.displayName,
          performedById: user.id,
          performedByName: user.name,
          performedByEmail: user.email,
          comment: comment?.trim() || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          durationInPreviousState,
        },
      });

      return updated;
    });

    // Execute post-transition actions (non-blocking)
    if (transition.actions) {
      this.executeActions(
        JSON.parse(transition.actions) as WorkflowAction[],
        entityType,
        entityId,
        user,
      ).catch((err) => {
        logger.error("[WORKFLOW] Error executing workflow actions", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // Execute on-enter actions for new state
    if (transition.toState.onEnterActions) {
      this.executeActions(
        JSON.parse(transition.toState.onEnterActions) as WorkflowAction[],
        entityType,
        entityId,
        user,
      ).catch((err) => {
        logger.error("[WORKFLOW] Error executing on-enter actions", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    return this.getInstance(
      entityType,
      entityId,
    ) as Promise<WorkflowInstanceWithDetails>;
  }

  // ========================================
  // HISTORY & AUDIT
  // ========================================

  /**
   * Get workflow history for an entity
   */
  async getHistory(
    entityType: EntityType,
    entityId: string,
    limit: number = 50,
  ): Promise<WorkflowHistory[]> {
    const instance = await prisma.workflowInstance.findUnique({
      where: {
        entityType_entityId: { entityType, entityId },
      },
    });

    if (!instance) {
      return [];
    }

    return prisma.workflowHistory.findMany({
      where: { instanceId: instance.id },
      orderBy: { performedAt: "desc" },
      take: limit,
    });
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Validate transition conditions
   * Returns array of failed condition descriptions
   */
  private async validateConditions(
    conditions: WorkflowCondition[],
    entityType: EntityType,
    entityId: string,
  ): Promise<string[]> {
    const failed: string[] = [];

    for (const condition of conditions) {
      switch (condition.type) {
        case "hasNoOpenIssues":
          if (entityType === "PROJECT" || entityType === "FILE") {
            // Check for open validation issues
            const openIssues = await prisma.validationIssue.count({
              where: {
                validationRun: {
                  OR: [{ projectId: entityId }, { fileId: entityId }],
                },
                status: "OPEN",
              },
            });
            if (openIssues > 0) {
              failed.push(
                `There are ${openIssues} open issues that must be resolved`,
              );
            }
          }
          break;

        case "allFilesReady":
          if (entityType === "PROJECT") {
            const pendingFiles = await prisma.file.count({
              where: {
                projectId: entityId,
                status: { not: "READY" },
              },
            });
            if (pendingFiles > 0) {
              failed.push(`${pendingFiles} files are not ready`);
            }
          }
          break;

        case "hasFiles":
          if (entityType === "PROJECT") {
            const fileCount = await prisma.file.count({
              where: { projectId: entityId },
            });
            if (fileCount === 0) {
              failed.push("Project must have at least one file");
            }
          }
          break;

        default:
          logger.warn(`[WORKFLOW] Unknown condition type: ${condition.type}`);
      }
    }

    return failed;
  }

  /**
   * Execute workflow actions (notifications, webhooks, etc.)
   */
  private async executeActions(
    actions: WorkflowAction[],
    entityType: EntityType,
    entityId: string,
    user: UserContext,
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case "notify":
            await this.sendNotification(action, entityType, entityId, user);
            break;

          case "setField":
            await this.setEntityField(action, entityType, entityId);
            break;

          case "webhook":
            // TODO: Implement webhook calls
            logger.warn("[WORKFLOW] Webhook action not yet implemented", {
              action,
            });
            break;

          case "email":
            // TODO: Integrate with email service
            logger.warn("[WORKFLOW] Email action not yet implemented", {
              action,
            });
            break;

          default:
            logger.warn(
              `[WORKFLOW] Unknown action type: ${(action as WorkflowAction).type}`,
            );
        }
      } catch (error) {
        logger.error(`[WORKFLOW] Error executing action ${action.type}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Send notification for workflow action
   */
  private async sendNotification(
    action: WorkflowAction,
    entityType: EntityType,
    entityId: string,
    user: UserContext,
  ): Promise<void> {
    let targetUserId: string | null = null;

    // Determine target user
    if (action.target === "owner") {
      if (entityType === "PROJECT") {
        const project = await prisma.project.findUnique({
          where: { id: entityId },
          select: { ownerId: true },
        });
        targetUserId = project?.ownerId || null;
      } else if (entityType === "FILE") {
        const file = await prisma.file.findUnique({
          where: { id: entityId },
          select: { uploadedBy: true },
        });
        targetUserId = file?.uploadedBy || null;
      }
    } else if (action.target === "performer") {
      targetUserId = user.id;
    } else if (action.target) {
      targetUserId = action.target; // Direct user ID
    }

    if (!targetUserId) return;

    // Get entity name for notification
    let entityName = entityId;
    if (entityType === "PROJECT") {
      const project = await prisma.project.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      entityName = project?.name || entityId;
    } else if (entityType === "FILE") {
      const file = await prisma.file.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      entityName = file?.name || entityId;
    }

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: "WORKFLOW_TRANSITION",
        title: `${entityType} Status Changed`,
        message: `${entityName} workflow was updated by ${user.name}`,
        projectId: entityType === "PROJECT" ? entityId : null,
        fileId: entityType === "FILE" ? entityId : null,
        priority: "NORMAL",
        metadata: JSON.stringify({
          entityType,
          entityId,
          performedBy: user.id,
          template: action.template,
        }),
      },
    });
  }

  /**
   * Update entity field based on workflow action
   */
  private async setEntityField(
    action: WorkflowAction,
    entityType: EntityType,
    entityId: string,
  ): Promise<void> {
    if (!action.field || action.value === undefined) return;

    if (entityType === "PROJECT") {
      await prisma.project.update({
        where: { id: entityId },
        data: { [action.field]: action.value },
      });
    } else if (entityType === "FILE") {
      await prisma.file.update({
        where: { id: entityId },
        data: { [action.field]: action.value },
      });
    }
  }

  // ========================================
  // ADMIN / MANAGEMENT
  // ========================================

  /**
   * Cancel a workflow (admin only)
   */
  async cancelWorkflow(
    entityType: EntityType,
    entityId: string,
    user: UserContext,
    reason?: string,
  ): Promise<WorkflowInstance> {
    const instance = await this.getInstance(entityType, entityId);

    if (!instance) {
      throw new WorkflowInstanceNotFoundError(entityType, entityId);
    }

    if (instance.status !== "ACTIVE") {
      throw new WorkflowError(
        "Can only cancel active workflows",
        "CANNOT_CANCEL",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
        },
      });

      await tx.workflowHistory.create({
        data: {
          instanceId: instance.id,
          fromStateName: instance.currentStateName,
          fromStateDisplay: instance.currentStateDisplay,
          toStateName: "CANCELLED",
          toStateDisplay: "Cancelled",
          transitionName: "cancel",
          transitionDisplay: "Cancelled",
          performedById: user.id,
          performedByName: user.name,
          performedByEmail: user.email,
          comment: reason,
          metadata: JSON.stringify({ action: "workflow_cancelled" }),
        },
      });

      return updated;
    });
  }

  /**
   * Reset a workflow to initial state (admin only)
   */
  async resetWorkflow(
    entityType: EntityType,
    entityId: string,
    user: UserContext,
    reason?: string,
  ): Promise<WorkflowInstanceWithDetails> {
    const instance = await this.getInstance(entityType, entityId);

    if (!instance) {
      throw new WorkflowInstanceNotFoundError(entityType, entityId);
    }

    // Get initial state
    const initialState = await prisma.workflowState.findFirst({
      where: {
        templateId: instance.templateId,
        isInitial: true,
      },
    });

    if (!initialState) {
      throw new WorkflowError(
        "Template has no initial state",
        "NO_INITIAL_STATE",
        500,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          currentStateId: initialState.id,
          currentStateName: initialState.name,
          currentStateDisplay: initialState.displayName,
          currentStateColor: initialState.color,
          status: "ACTIVE",
          completedAt: null,
        },
      });

      await tx.workflowHistory.create({
        data: {
          instanceId: instance.id,
          fromStateName: instance.currentStateName,
          fromStateDisplay: instance.currentStateDisplay,
          toStateName: initialState.name,
          toStateDisplay: initialState.displayName,
          transitionName: "reset",
          transitionDisplay: "Reset",
          performedById: user.id,
          performedByName: user.name,
          performedByEmail: user.email,
          comment: reason,
          metadata: JSON.stringify({ action: "workflow_reset" }),
        },
      });
    });

    return this.getInstance(
      entityType,
      entityId,
    ) as Promise<WorkflowInstanceWithDetails>;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const workflowService = new WorkflowService();

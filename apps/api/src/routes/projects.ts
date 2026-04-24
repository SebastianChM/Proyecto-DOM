import { Router } from "express";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { cacheService, RedisKeys } from "../lib/redis";
import {
  requirePermission,
  requireProjectAccess,
} from "../middleware/authorization";
import { z } from "zod";
import { APP_CONFIG } from "../config/constants";
import { apsWebhooksService } from "../services/aps/webhooks.service";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, unauthorized, notFound } from "../lib/errors";
import { auditService } from "../services/audit.service";

const router = Router();

// Validation Schemas
const createProjectSchema = z.object({
  name: z
    .string()
    .min(
      APP_CONFIG.LIMITS.PROJECT_NAME_MIN_LENGTH,
      `Name must be at least ${APP_CONFIG.LIMITS.PROJECT_NAME_MIN_LENGTH} characters`,
    )
    .max(
      APP_CONFIG.LIMITS.PROJECT_NAME_MAX_LENGTH,
      `Name must be at most ${APP_CONFIG.LIMITS.PROJECT_NAME_MAX_LENGTH} characters`,
    ),
  description: z.string().optional(),
  status: z.string().optional(),
  clientName: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  discipline: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial().refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  },
);

const createProjectSchemaWithValidation = createProjectSchema.refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate);
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  },
);

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *               clientName:
 *                 type: string
 *               location:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               discipline:
 *                 type: string
 *     responses:
 *       200:
 *         description: The created project
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
// Create project
router.post("/", asyncHandler(async (req, res) => {
    // Validate input
    const validation = createProjectSchemaWithValidation.safeParse(req.body);
    logger.debug("POST /projects validation", { valid: validation.success });

    if (!validation.success) {
      throw badRequest("Validation failed", "VALIDATION_ERROR", validation.error.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })));
    }

    const {
      name,
      description,
      status,
      clientName,
      location,
      startDate,
      endDate,
      discipline,
    } = validation.data;

    // Usuario autenticado es el owner
    const userId = req.session?.user?.id;
    if (!userId) {
      throw unauthorized();
    }

    // Check Project Limit
    const projectCount = await prisma.project.count({
      where: { ownerId: userId },
    });

    if (projectCount >= APP_CONFIG.LIMITS.MAX_PROJECTS_PER_USER) {
      throw badRequest(
        `You cannot create more than ${APP_CONFIG.LIMITS.MAX_PROJECTS_PER_USER} projects.`,
        "PROJECT_LIMIT_REACHED",
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status,
        clientName,
        location,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        discipline,
        ownerId: userId, // Owner es quien crea el proyecto
        isFromAutodesk: false, // Proyecto local
      },
      include: {
        _count: {
          select: { files: true },
        },
      },
    });

    // Crear entrada en ProjectMember como OWNER
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: userId,
        role: "OWNER",
        acceptedAt: new Date(), // Auto-aceptado
      },
    });

    // Invalidate cache after creating project
    await cacheService
      .invalidatePattern("cache:projects:list:*")
      .catch((e) => logger.warn("Cache invalidation failed", { error: e }));

    auditService.log({
      ...auditService.fromReq(req),
      action: "CREATE",
      entity: "project",
      entityId: project.id,
      details: { name: project.name },
    });

    res.status(201).json(project);
}));

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: List projects with pagination, search, and filters
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search in name, description, clientName, location
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by project status
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [updatedAt, name, createdAt], default: updatedAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated list of projects with metadata
 */
// List projects (paginated, cached) - Solo proyectos donde el usuario tiene acceso
router.get("/", asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw unauthorized();
    }

    // Parse query params with safe defaults
    const search = (req.query.search as string)?.trim() || "";
    const status = (req.query.status as string)?.trim() || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const sortBy = (["updatedAt", "name", "createdAt"].includes(req.query.sortBy as string))
      ? (req.query.sortBy as string) : "updatedAt";
    const sortOrder = (req.query.sortOrder === "asc") ? "asc" as const : "desc" as const;

    const cacheKey = `${RedisKeys.projectsList(userId)}:p=${page}:ps=${pageSize}:s=${search}:st=${status}:sb=${sortBy}:so=${sortOrder}`;

    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const baseWhere = {
          OR: [
            { ownerId: userId },
            {
              members: {
                some: {
                  userId: userId,
                  acceptedAt: { not: null },
                },
              },
            },
          ],
        };

        // Build additional filters
        const filters: Record<string, unknown>[] = [];
        if (search) {
          filters.push({
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { clientName: { contains: search, mode: "insensitive" } },
              { location: { contains: search, mode: "insensitive" } },
            ],
          });
        }
        if (status) {
          filters.push({ status });
        }

        const where = filters.length > 0
          ? { AND: [baseWhere, ...filters] }
          : baseWhere;

        // Parallel: count + paginated data
        const [total, projects] = await Promise.all([
          prisma.project.count({ where: where as any }),
          prisma.project.findMany({
            where: where as any,
            orderBy: { [sortBy]: sortOrder },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
              files: {
                select: { id: true, name: true, type: true, status: true, apsUrn: true, createdAt: true, updatedAt: true },
                orderBy: { updatedAt: "desc" },
              },
              _count: {
                select: { files: true, members: true },
              },
              owner: {
                select: { id: true, name: true, email: true },
              },
            },
          }),
        ]);

        return {
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
          data: projects,
        };
      },
      60,
    );
    res.json(result);
}));

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project details
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
// Get project by ID - Requiere permiso de lectura
router.get("/:id", requireProjectAccess, asyncHandler(async (req, res) => {
    const cacheKey = RedisKeys.projectDetail(req.params.id as string);

    // Cache for 1 minute
    const project = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await prisma.project.findUnique({
          where: { id: req.params.id as string },
          include: {
            files: {
              orderBy: { createdAt: "desc" },
              include: {
                versions: true,
                conversions: true,
              },
            },
            comparisons: true,
          },
        });
      },
      60,
    );

    if (!project) {
      throw notFound("Project not found", "PROJECT_NOT_FOUND");
    }

    // Check status for translating files - REMOVED FOR PERFORMANCE
    // Status checks are now handled via /api/files/sync-status endpoint called by frontend
    const updatedFiles = project.files;

    // Add progress estimation to files
    const filesWithProgress = updatedFiles.map((file) => {
      let progress = 0;
      if (file.status === "TRANSLATING") {
        const elapsed = Date.now() - new Date(file.updatedAt).getTime();
        const isLocal = file.apsUrn && file.apsUrn.startsWith("local-");
        const duration = isLocal ? 5000 : 60000; // 5s for local, 60s for real
        // Force minimum 10% to ensure visibility immediately
        progress = Math.max(
          10,
          Math.min(99, Math.floor((elapsed / duration) * 100)),
        );
      } else if (file.status === "READY") {
        progress = 100;
      }
      return { ...file, progress };
    });

    res.json({ ...project, files: filesWithProgress });
}));

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated project
 *       500:
 *         description: Server error
 */
// Update project - Requiere permiso de edición
router.put("/:id", requirePermission("project:update"), asyncHandler(async (req, res) => {
    const validation = updateProjectSchema.safeParse(req.body);
    logger.debug("PUT /projects/:id validation", { valid: validation.success });

    if (!validation.success) {
      throw badRequest("Validation failed", "VALIDATION_ERROR", 
        validation.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }))
      );
    }

    const {
      name,
      description,
      status,
      clientName,
      location,
      startDate,
      endDate,
      discipline,
    } = validation.data;
    const project = await prisma.project.update({
      where: { id: req.params.id as string },
      data: {
        name,
        description,
        status,
        clientName,
        location,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        discipline,
      },
    });

    // Invalidate caches
    await Promise.all([
      cacheService.del(RedisKeys.projectDetail(req.params.id as string)),
      cacheService.invalidatePattern("cache:projects:list:*"),
      cacheService.invalidatePattern("cache:dashboard:stats:*"),
    ]);

    res.json(project);
}));

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted
 *       500:
 *         description: Server error
 */
// Delete project - Requiere permiso de eliminación
router.delete("/:id", requirePermission("project:delete"), asyncHandler(async (req, res) => {
    await prisma.project.delete({
      where: { id: req.params.id as string },
    });

    // Invalidate caches
    await Promise.all([
      cacheService.del(RedisKeys.projectDetail(req.params.id as string)),
      cacheService.invalidatePattern("cache:projects:list:*"),
      cacheService.invalidatePattern("cache:dashboard:stats:*"),
    ]);

    res.json({ success: true });
}));

const importApsProjectSchema = z.object({
  name: z.string(),
  apsProjectId: z.string(), // b.xxxx (Hub Project ID)
  apsFolderId: z.string(), // Root folder ID to watch
  hubId: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  clientName: z.string().optional(),
});

/**
 * @swagger
 * /projects/import-aps:
 *   post:
 *     summary: Import/Link an Autodesk Project
 *     tags: [Projects]
 */
// Import Autodesk Project & Auto-Subscribe to Webhooks
router.post("/import-aps", asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id;
    if (!userId) throw unauthorized("Authentication required");

    const validation = importApsProjectSchema.safeParse(req.body);
    if (!validation.success) {
      throw badRequest("Invalid input", "VALIDATION_ERROR", validation.error);
    }

    const {
      name,
      apsProjectId,
      apsFolderId,
      description,
      location,
      clientName,
    } = validation.data;

    // 1. Create Local Project Record
    logger.info(
      `[PROJECTS] Importing Autodesk Project: ${name} (${apsProjectId})`,
    );

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: "Active",
        clientName: clientName || "Autodesk Import",
        location,
        ownerId: userId,
        isFromAutodesk: true,
        apsOwnerId: apsProjectId, // Using apsOwnerId to store the APS Project ID
      },
    });

    // 2. Add Owner
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role: "OWNER",
        acceptedAt: new Date(),
      },
    });

    // 3. Subscribe to Webhooks for this Project's Folder
    try {
      logger.info(`[PROJECTS] Subscribing to folder updates: ${apsFolderId}`);
      // We pass workflowAttribute so we know WHICH local project this belongs to when event fires
      await apsWebhooksService.createWebhook("data", "dm.version.added", {
        folder: apsFolderId,
        workflowAttribute: {
          projectId: project.id,
          userId: userId,
          apsProjectId: apsProjectId,
          hubId: validation.data.hubId, // Pass hubId in metadata if needed
        },
      });
      logger.info(
        `[PROJECTS] Webhook subscription active for project ${project.id}`,
      );
    } catch (hookError: unknown) {
      const err = hookError as { message?: string };
      logger.warn("[PROJECTS] Failed to subscribe to webhooks", {
        error: err.message || "Unknown error",
      });
      // Don't fail the import, just warn
    }

    await cacheService
      .invalidatePattern("cache:projects:list:*")
      .catch((e) => logger.warn("Cache invalidation failed", { error: e }));

    res.status(201).json(project);
}));

/**
 * GET /:id/export
 * Export all project data as JSON
 */
router.get("/:id/export", requireProjectAccess, asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        files: {
          select: {
            id: true, name: true, type: true, size: true, status: true,
            createdAt: true, updatedAt: true,
          },
        },
        _count: { select: { files: true, members: true } },
      },
    });

    if (!project) {
      throw notFound("Project not found", "PROJECT_NOT_FOUND");
    }

    // Get compliance runs for this project
    const complianceRuns = await prisma.complianceRun.findMany({
      where: { projectId },
      select: {
        id: true, status: true, complianceScore: true, totalElements: true,
        passedCount: true, failedCount: true, startedAt: true, completedAt: true,
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      project,
      complianceRuns,
    };

    const safeName = (project.name || "project").replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="export_${safeName}.json"`);
    res.json(exportData);
}));

export default router;

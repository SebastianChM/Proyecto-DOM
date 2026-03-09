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

const router = Router();

// Validation Schemas
const createProjectSchema = z
  .object({
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
  })
  .refine(
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

const updateProjectSchema = createProjectSchema.partial();

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
    const validation = createProjectSchema.safeParse(req.body);
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

    res.status(201).json(project);
}));

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: List all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *       500:
 *         description: Server error
 */
// List projects (with cache) - Solo proyectos donde el usuario tiene acceso
router.get("/", asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw unauthorized();
    }

    const cacheKey = RedisKeys.projectsList(userId);

    // Cache for 1 minute
    const projects = await cacheService.getOrSet(
      cacheKey,
      async () => {
        // Obtener proyectos donde el usuario es owner o miembro
        const userProjects = await prisma.project.findMany({
          where: {
            OR: [
              { ownerId: userId }, // Owner directo
              {
                members: {
                  some: {
                    userId: userId,
                    acceptedAt: { not: null }, // Solo miembros que aceptaron
                  },
                },
              },
            ],
          },
          orderBy: { updatedAt: "desc" },
          include: {
            files: true,
            _count: {
              select: {
                files: true,
                members: true,
              },
            },
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
        return userProjects;
      },
      60,
    );
    res.json(projects);
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
    const cacheKey = RedisKeys.projectDetail(req.params.id);

    // Cache for 1 minute
    const project = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await prisma.project.findUnique({
          where: { id: req.params.id },
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
      where: { id: req.params.id },
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
      cacheService.del(RedisKeys.projectDetail(req.params.id)),
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
      where: { id: req.params.id },
    });

    // Invalidate caches
    await Promise.all([
      cacheService.del(RedisKeys.projectDetail(req.params.id)),
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

export default router;

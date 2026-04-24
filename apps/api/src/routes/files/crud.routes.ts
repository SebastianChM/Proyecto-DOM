import { Router } from "express";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import { apsDataManagementService } from "../../services/aps/data-management.service";
import { apsOssService } from "../../services/aps/oss.service";
import prisma from "../../lib/prisma";
import { cacheService } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { unauthorized, notFound } from "../../lib/errors";

// Define RequestWithSession locally since it's not exported globally yet
interface SessionData {
  user?: {
    id?: string;
    apsAccessToken?: string;
    apsRefreshToken?: string;
  };
  apsToken?: string;
}
type RequestWithSession = Express.Request & {
  session?: SessionData;
};

const router = Router();

const fileRequiresGeometry = (file: { type?: string; name?: string }) => {
  const type = (file.type || "").toUpperCase();
  if (type === "PDF") return false;

  const ext = (file.name || "").toLowerCase().split(".").pop() || "";
  return ext !== "pdf";
};

/**
 * @swagger
 * /files/recent:
 *   get:
 *     summary: Get recent files for dashboard
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: List of recent files
 *       500:
 *         description: Server error
 */
router.get(
  "/recent",
  asyncHandler(async (req, res) => {
    const userId = (req as unknown as RequestWithSession).session?.user?.id;
    if (!userId) {
      throw unauthorized("Authentication required");
    }

    const cacheKey = `cache:files:recent:${userId}`;

    // Cache for 5 minutes
    const files = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await prisma.file.findMany({
          where: {
            project: {
              OR: [{ ownerId: userId }, { members: { some: { userId } } }],
            },
            status: "READY",
            type: { in: ["RVT", "IFC", "NWC", "DWG"] },
          },
          take: 6,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            apsUrn: true,
            updatedAt: true,
            project: {
              select: { name: true },
            },
          },
        });
      },
      300,
    );

    res.json(files);
  }),
);

// List ALL files across projects (paginated) - for the "All Files" page
// GET /files/all?page=1&pageSize=20&search=&type=&status=&projectId=
router.get(
  "/all",
  asyncHandler(async (req, res) => {
    const userId = (req as unknown as RequestWithSession).session?.user?.id;
    if (!userId) {
      throw unauthorized("Authentication required");
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query.pageSize as string) || 20),
    );
    const search = (req.query.search as string)?.trim() || "";
    const type = (req.query.type as string)?.trim().toUpperCase() || "";
    const status = (req.query.status as string)?.trim() || "";
    const projectId = (req.query.projectId as string)?.trim() || "";

    // Only files from projects the user has access to
    const where: Record<string, unknown> = {
      project: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, acceptedAt: { not: null } } } },
        ],
      },
    };

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (type) where.type = type;
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;

    const [total, files, types, projects] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          status: true,
          apsUrn: true,
          createdAt: true,
          updatedAt: true,
          projectId: true,
          project: { select: { id: true, name: true } },
        },
      }),
      // Available types for filter dropdown
      prisma.file.groupBy({
        by: ["type"],
        where: {
          project: {
            OR: [
              { ownerId: userId },
              { members: { some: { userId, acceptedAt: { not: null } } } },
            ],
          },
        },
        _count: true,
      }),
      // Available projects for filter dropdown
      prisma.project.findMany({
        where: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, acceptedAt: { not: null } } } },
          ],
        },
        select: { id: true, name: true, _count: { select: { files: true } } },
        orderBy: { name: "asc" },
      }),
    ]);

    // Add progress to each file
    const filesWithProgress = files.map((file) => {
      let progress = 0;
      if (file.status === "TRANSLATING" || file.status === "PROCESSING") {
        const elapsed = Date.now() - new Date(file.updatedAt).getTime();
        const isLocal = file.apsUrn && file.apsUrn.startsWith("local-");
        const duration = isLocal ? 5000 : 60000;
        progress = Math.max(
          10,
          Math.min(99, Math.floor((elapsed / duration) * 100)),
        );
      } else if (file.status === "READY") {
        progress = 100;
      }
      return { ...file, progress };
    });

    res.json({
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      filters: {
        types: types.map((t) => ({ type: t.type, count: t._count })),
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          fileCount: p._count.files,
        })),
      },
      data: filesWithProgress,
    });
  }),
);

// List files for a project (paginated)
// GET /files/project/:projectId?page=1&pageSize=20&search=&type=&status=
router.get(
  "/project/:projectId",
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query.pageSize as string) || 20),
    );
    const search = (req.query.search as string)?.trim() || "";
    const type = (req.query.type as string)?.trim().toUpperCase() || "";
    const status = (req.query.status as string)?.trim() || "";

    const where: Record<string, unknown> = { projectId };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (type) where.type = type;
    if (status) where.status = status;

    const [total, files] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { versions: true },
      }),
    ]);

    // Check status for active files (only those in current page)
    for (const file of files) {
      if (
        (file.status === "TRANSLATING" ||
          file.status === "PROCESSING" ||
          (file.status === "READY" && fileRequiresGeometry(file))) &&
        file.apsUrn &&
        !file.apsUrn.startsWith("local-")
      ) {
        try {
          const manifest = await modelDerivativeService.getManifest(
            file.apsUrn,
          );
          const nextStatus =
            modelDerivativeService.resolveFileStatusFromManifest(
              manifest,
              fileRequiresGeometry(file),
            );

          if (nextStatus === "FAILED") {
            logger.warn(
              `[FILES_CRUD] Marking file as FAILED due to manifest without usable geometry`,
              {
                ...logger.fromReq(req),
                fileId: file.id,
                fileName: file.name,
                previousStatus: file.status,
                manifestStatus: manifest?.status,
              },
            );
          }

          if (nextStatus !== file.status) {
            await prisma.file.update({
              where: { id: file.id },
              data: { status: nextStatus },
            });
            file.status = nextStatus;
          }
        } catch (e) {
          logger.error(
            `[FILES_CRUD] Failed to check manifest for file ${file.id}`,
            {
              ...logger.fromReq(req),
              error: e instanceof Error ? e.message : String(e),
            },
          );
        }
      }
    }

    // Add progress estimation
    const filesWithProgress = files.map((file) => {
      let progress = 0;
      if (file.status === "TRANSLATING" || file.status === "PROCESSING") {
        const elapsed = Date.now() - new Date(file.updatedAt).getTime();
        const isLocal = file.apsUrn && file.apsUrn.startsWith("local-");
        const duration = isLocal ? 5000 : 60000;
        progress = Math.max(
          10,
          Math.min(99, Math.floor((elapsed / duration) * 100)),
        );
      } else if (file.status === "READY") {
        progress = 100;
      }
      return { ...file, progress };
    });

    res.json({
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      data: filesWithProgress,
    });
  }),
);

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     summary: Get file details
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File details
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Get file details
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id as string },
      include: {
        versions: true,
        conversions: true,
      },
    });

    if (!file) {
      throw notFound("File not found", "FILE_NOT_FOUND");
    }

    // Check translation status if currently translating
    if (file.status === "TRANSLATING" || file.status === "PROCESSING") {
      const elapsed = Date.now() - new Date(file.updatedAt).getTime();
      const isLocal = file.apsUrn && file.apsUrn.startsWith("local-");
      const duration = isLocal ? 5000 : 60000; // 5s for local, 60s for real
      // Force minimum 10% to ensure visibility immediately
      (file as typeof file & { progress?: number }).progress = Math.max(
        10,
        Math.min(99, Math.floor((elapsed / duration) * 100)),
      );
    } else if (file.status === "READY") {
      (file as typeof file & { progress?: number }).progress = 100;
    }

    if (
      (file.status === "TRANSLATING" ||
        file.status === "PROCESSING" ||
        (file.status === "READY" && fileRequiresGeometry(file))) &&
      file.apsUrn &&
      !file.apsUrn.startsWith("local-")
    ) {
      try {
        const manifest = await modelDerivativeService.getManifest(file.apsUrn);
        const nextStatus = modelDerivativeService.resolveFileStatusFromManifest(
          manifest,
          fileRequiresGeometry(file),
        );

        if (nextStatus === "FAILED") {
          logger.warn(
            `[FILES_CRUD] Marking file as FAILED due to manifest without usable geometry`,
            {
              ...logger.fromReq(req),
              fileId: file.id,
              fileName: file.name,
              previousStatus: file.status,
              manifestStatus: manifest?.status,
            },
          );
        }

        if (nextStatus !== file.status) {
          await prisma.file.update({
            where: { id: file.id },
            data: { status: nextStatus },
          });
          file.status = nextStatus;
          const fileWithProgress = file as typeof file & { progress?: number };
          if (nextStatus === "READY") {
            fileWithProgress.progress = 100;
          } else if (nextStatus === "FAILED") {
            fileWithProgress.progress = 0;
          }
        }
      } catch (e) {
        logger.error("[FILES_CRUD] Failed to check manifest", {
          ...logger.fromReq(req),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    res.json(file);
  }),
);

/**
 * @swagger
 * /files/{id}/versions:
 *   get:
 *     summary: Get file versions
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: List of file versions
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Get file versions (from APS Data Management for ACC/BIM 360 files)
router.get(
  "/:id/versions",
  asyncHandler(async (req, res) => {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id as string },
      include: {
        versions: {
          orderBy: { version: "desc" },
        },
      },
    });

    if (!file) {
      throw notFound("File not found", "FILE_NOT_FOUND");
    }

    // If file is from APS (has apsProjectId and apsItemId), fetch real versions
    const apsFile = file as typeof file & {
      apsProjectId?: string;
      apsItemId?: string;
    };
    if (apsFile.apsProjectId && apsFile.apsItemId) {
      // Get 3-legged token from session
      const accessToken = (req as unknown as RequestWithSession).session
        ?.apsToken;

      if (!accessToken) {
        throw unauthorized(
          "Not authenticated with Autodesk. Please sign in again.",
        );
      }

      const versions = await apsDataManagementService.getItemVersions(
        apsFile.apsProjectId,
        apsFile.apsItemId,
        accessToken,
      );

      // Transform to our format
      const formattedVersions = versions.map(
        (v: {
          id: string;
          baseVersion: number;
          name: string;
          lastModified: string;
          urn: string;
        }) => ({
          id: v.id,
          versionNumber: v.baseVersion,
          displayName: v.name,
          createTime: v.lastModified,
          createUserName: "Unknown", // Service doesn't return user name currently
          storageId: null, // Service doesn't return explicit storage ID, just URN
          urn: v.urn ? apsOssService.getDerivativeUrn(v.urn) : null,
          size: 0, // Service doesn't return size currently
          status: "READY", // Assume ready since it's from APS
        }),
      );

      return res.json({
        file: {
          id: file.id,
          name: file.name,
          projectId: file.projectId,
        },
        versions: formattedVersions,
        source: "APS",
      });
    }

    // Fallback: Return local versions from database
    const localVersions = file.versions.map((v) => ({
      id: v.id,
      versionNumber: v.version,
      displayName: `Version ${v.version}`,
      createTime: v.createdAt.toISOString(),
      createUserName: "Local User",
      urn: v.apsUrn,
      size: file.size,
      status: "READY",
    }));

    res.json({
      file: {
        id: file.id,
        name: file.name,
        projectId: file.projectId,
      },
      versions:
        localVersions.length > 0
          ? localVersions
          : [
              {
                id: file.id,
                versionNumber: 1,
                displayName: "Current Version",
                createTime: file.createdAt.toISOString(),
                createUserName: "Local User",
                urn: file.apsUrn,
                size: file.size,
                status: file.status,
              },
            ],
      source: "LOCAL",
    });
  }),
);

/**
 * @swagger
 * /files/{id}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Delete file
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id as string as string;

    // Check if file exists
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      throw notFound("File not found", "FILE_NOT_FOUND");
    }

    // Delete from DB
    await prisma.file.delete({
      where: { id },
    });

    res.json({ success: true });
  }),
);

export default router;

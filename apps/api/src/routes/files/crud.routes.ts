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

// List files for a project
router.get(
  "/project/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const files = await prisma.file.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        versions: true,
      },
    });

    // Check status for active files
    for (const file of files) {
      if (
        (file.status === "TRANSLATING" || file.status === "PROCESSING") &&
        file.apsUrn &&
        !file.apsUrn.startsWith("local-")
      ) {
        try {
          const manifest = await modelDerivativeService.getManifest(
            file.apsUrn,
          );
          if (manifest.status === "success") {
            await prisma.file.update({
              where: { id: file.id },
              data: { status: "READY" },
            });
            file.status = "READY";
          } else if (manifest.status === "failed") {
            await prisma.file.update({
              where: { id: file.id },
              data: { status: "FAILED" },
            });
            file.status = "FAILED";
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

    res.json(filesWithProgress);
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
      where: { id: req.params.id },
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
      (file.status === "TRANSLATING" || file.status === "PROCESSING") &&
      file.apsUrn &&
      !file.apsUrn.startsWith("local-")
    ) {
      try {
        const manifest = await modelDerivativeService.getManifest(file.apsUrn);
        if (manifest.status === "success") {
          await prisma.file.update({
            where: { id: file.id },
            data: { status: "READY" },
          });
          file.status = "READY";
        } else if (manifest.status === "failed") {
          await prisma.file.update({
            where: { id: file.id },
            data: { status: "FAILED" },
          });
          file.status = "FAILED";
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
      where: { id: req.params.id },
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
    const { id } = req.params;

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

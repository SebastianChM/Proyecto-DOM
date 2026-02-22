import { Router } from "express";

import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import prisma from "../../lib/prisma";
import { cacheService } from "../../lib/redis";
import { logger } from "../../lib/logger";

// Define RequestWithSession locally since it's not exported globally yet
interface SessionData {
  user?: {
    id?: string;
  };
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
router.get("/recent", async (req, res) => {
  try {
    const userId = (req as RequestWithSession).session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
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
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

// List files for a project
router.get("/project/:projectId", async (req, res) => {
  try {
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
            `[FILES_LIST] Failed to check manifest for file ${file.id}`,
            { error: e instanceof Error ? e.message : String(e) },
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
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

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
router.get("/:id", async (req, res) => {
  try {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
      include: {
        versions: true,
        conversions: true,
      },
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
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
        logger.error("[FILES_LIST] Failed to check manifest", {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    res.json(file);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMessage });
  }
});

export default router;

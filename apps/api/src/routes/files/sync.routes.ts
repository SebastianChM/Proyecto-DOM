/**
 * File Routes - Sync Operations
 *
 * Handles file synchronization with APS (status checks, manifest updates)
 */

import { Router } from "express";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import { cacheService, RedisKeys } from "../../lib/redis";
import { prisma } from "../../lib/utils";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * @swagger
 * /files/sync-status:
 *   post:
 *     summary: Sync status of specific files with APS
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated file statuses
 *       500:
 *         description: Server error
 */
router.post("/sync-status", async (req, res) => {
  try {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: "No file IDs provided" });
    }

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
    });

    const updates: Array<{ id: string; status: string; progress: number }> = [];
    const allFiles: Array<{ id: string; status: string; progress: number }> =
      [];

    await Promise.all(
      files.map(async (file) => {
        let newStatus = file.status;
        let progress = 0;

        // Calculate progress for files in transition
        if (
          file.status === "TRANSLATING" ||
          file.status === "PROCESSING" ||
          file.status === "PENDING"
        ) {
          const elapsed = Date.now() - new Date(file.updatedAt).getTime();
          const isLocal = file.apsUrn && file.apsUrn.startsWith("local-");
          const duration = isLocal ? 5000 : 120000; // 5s for local, 120s for real APS
          progress = Math.max(
            10,
            Math.min(99, Math.floor((elapsed / duration) * 100)),
          );

          // Check APS manifest for actual status
          if (file.apsUrn && !file.apsUrn.startsWith("local-")) {
            try {
              const manifest = await modelDerivativeService.getManifest(
                file.apsUrn,
              );

              if (manifest.status === "success") {
                newStatus = "READY";
                progress = 100;
              } else if (manifest.status === "failed") {
                newStatus = "FAILED";
                progress = 0;
              } else if (manifest.progress) {
                const apsProgress = parseInt(
                  manifest.progress.replace("%", ""),
                );
                if (!isNaN(apsProgress)) {
                  progress = apsProgress;
                }
              }
            } catch (e) {
              logger.error(
                `[FILES_SYNC] Failed to check manifest for ${file.id}`,
                { error: e instanceof Error ? e.message : String(e) },
              );
            }
          }

          // Update DB if status changed
          if (newStatus !== file.status) {
            await prisma.file.update({
              where: { id: file.id },
              data: { status: newStatus },
            });
            updates.push({ id: file.id, status: newStatus, progress });
          }
        } else if (file.status === "READY") {
          progress = 100;
        }

        allFiles.push({
          id: file.id,
          status: newStatus,
          progress,
        });
      }),
    );

    if (updates.length > 0) {
      // Invalidate caches
      const projectIds = [...new Set(files.map((f) => f.projectId))];
      await Promise.all(
        projectIds.map((pid) => cacheService.del(RedisKeys.projectDetail(pid))),
      );
      await cacheService.invalidatePattern("cache:dashboard:stats:*");
      await cacheService.invalidatePattern("cache:files:recent:*");
    }

    res.json({
      success: true,
      updatedCount: updates.length,
      updates,
      files: allFiles,
    });
  } catch (error: unknown) {
    logger.error("[FILES_SYNC] Sync status error", {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .json({ error: "Failed to sync status", details: errorMessage });
  }
});

export default router;

import prisma from "../../lib/prisma";
import { apsAuthService } from "../aps/auth.service";
import { apsDataManagementService } from "../aps/data-management.service";
import { modelDerivativeService } from "../aps/model-derivative.service";
import { webhookProcessorService } from "./webhook-processor.service";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

/**
 * Polling Service
 *
 * Backup mechanism for missed webhooks
 * Polls APS projects periodically to detect new versions
 *
 * Features:
 * - Cursor-based polling per project
 * - Backfill missing versions
 * - Automatic translation triggering
 * - Error tracking and recovery
 *
 * Configuration:
 * - POLLING_INTERVAL_MINUTES: How often to poll (default: 30)
 * - pollStatus: ACTIVE/PAUSED/FAILED per project
 */
export class PollingService {
  /**
   * Poll all active projects for missing versions
   */
  async pollAllProjects() {
    const cursors = await prisma.apsPollCursor.findMany({
      where: { pollStatus: "ACTIVE" },
    });

    if (cursors.length === 0) {
      logger.debug("[POLLING] No active projects to poll");
      return;
    }

    logger.info("[POLLING] Starting poll", { projectCount: cursors.length });

    for (const cursor of cursors) {
      try {
        await this.pollProject(cursor.projectId, cursor.id);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[POLLING] Failed to poll project", {
          projectId: cursor.projectId,
          error: msg.substring(0, 200),
        });

        // Update cursor with error
        await prisma.apsPollCursor.update({
          where: { id: cursor.id },
          data: {
            errorCount: { increment: 1 },
            lastError: msg.substring(0, 500),
            lastPollAt: new Date(),
            // Pause if too many errors
            pollStatus: cursor.errorCount >= 5 ? "FAILED" : cursor.pollStatus,
          },
        });
      }
    }
  }

  /**
   * Poll single project for new versions
   */
  private async pollProject(apsProjectId: string, cursorId: string) {
    if (env.LOG_LEVEL === "debug") {
      logger.debug("[POLLING] Polling project", { projectId: apsProjectId });
    }

    // Placeholder - token would be used for actual APS API calls
    await apsAuthService.getInternalToken();

    // Get cursor
    const cursor = await prisma.apsPollCursor.findUnique({
      where: { id: cursorId },
    });

    if (!cursor) {
      logger.warn("[POLLING] Cursor not found", { projectId: apsProjectId });
      return;
    }

    // Track new versions (placeholder - would be incremented in actual implementation)
    const newVersionCount = 0;

    // NOTE: This is a simplified implementation
    // Real implementation would:
    // 1. List folders in project via apsDataManagementService.getProjectContents
    // 2. For each folder, list items
    // 3. For each item, list versions
    // 4. Filter versions by createTime > lastSeenAt
    // 5. Process each new version
    //
    // For now, we'll just update the cursor to demonstrate the flow

    // TODO: Implement actual APS API calls to list versions
    // This would require extending apsDataManagementService with:
    // - listProjectFolders(projectId, token)
    // - listFolderItems(projectId, folderId, token)
    // - listItemVersions(projectId, itemId, token)

    // Example pseudo-flow:
    // const folders = await apsDataManagementService.listProjectFolders(apsProjectId, token);
    // for (const folder of folders) {
    //   const items = await apsDataManagementService.listFolderItems(apsProjectId, folder.id, token);
    //   for (const item of items) {
    //     const versions = await apsDataManagementService.listItemVersions(apsProjectId, item.id, token);
    //     for (const version of versions) {
    //       const versionCreatedAt = new Date(version.attributes.createTime);
    //       if (versionCreatedAt > lastSeenAt) {
    //         await this.processNewVersion(apsProjectId, version, token);
    //         newVersionCount++;
    //       }
    //     }
    //   }
    // }

    // Update cursor
    await prisma.apsPollCursor.update({
      where: { id: cursorId },
      data: {
        lastSeenAt: new Date(),
        lastPollAt: new Date(),
        errorCount: 0,
        lastError: null,
      },
    });

    if (env.LOG_LEVEL === "debug") {
      logger.debug("[POLLING] Completed", {
        projectId: apsProjectId,
        newVersions: newVersionCount,
      });
    }
  }

  /**
   * Process a newly discovered version from polling
   */
  private async processNewVersion(
    apsProjectId: string,
    version: Record<string, unknown>,
    token: string,
  ) {
    const urn = version.id as string;
    const versionId = version.id as string;

    // Check if already exists
    const existing = await prisma.file.findFirst({
      where: { apsUrn: urn },
    });

    if (existing) {
      if (env.LOG_LEVEL === "debug") {
        logger.debug("[POLLING] Version already exists", {
          fileId: existing.id,
        });
      }
      return;
    }

    // Find local project
    const localProject = await prisma.file.findFirst({
      where: { apsProjectId },
      select: { projectId: true },
    });

    if (!localProject) {
      logger.warn("[POLLING] No local project", { projectId: apsProjectId });
      return;
    }

    // Get version details
    let fileName = `File ${versionId.substring(0, 8)}`;
    let fileType = "RVT";
    let fileSize = 0;

    try {
      const versionDetails = await apsDataManagementService.getVersion(
        apsProjectId,
        versionId,
        token,
      );

      fileName = versionDetails.fileName || fileName;
      fileType = versionDetails.fileType || fileType;
      fileSize = versionDetails.storageSize || 0;
    } catch (error) {
      logger.warn("[POLLING] Failed to fetch version details", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Insert missing version
    const newFile = await prisma.file.create({
      data: {
        name: fileName,
        originalName: fileName,
        type: fileType,
        size: fileSize,
        apsUrn: urn,
        status: "UPLOADED",
        origin: "ACC",
        apsProjectId,
        projectId: localProject.projectId,
      },
    });

    logger.info("[POLLING] Backfilled missing version", {
      fileId: newFile.id,
      fileName,
    });

    // Enqueue translation
    try {
      await modelDerivativeService.translateToSVF2(urn);
      await prisma.file.update({
        where: { id: newFile.id },
        data: { status: "TRANSLATING" },
      });
    } catch (error) {
      logger.error("[POLLING] Failed to enqueue translation", {
        fileId: newFile.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Create notification
    await webhookProcessorService.createNotification(
      "VERSION_BACKFILLED",
      localProject.projectId,
      newFile.id,
      { source: "polling", urn: urn.substring(0, 30) },
    );
  }

  /**
   * Initialize cursor for a project
   */
  async initializeProjectCursor(apsProjectId: string) {
    const existing = await prisma.apsPollCursor.findUnique({
      where: { projectId: apsProjectId },
    });

    if (existing) {
      logger.debug("[POLLING] Cursor already exists", {
        projectId: apsProjectId,
      });
      return existing;
    }

    const cursor = await prisma.apsPollCursor.create({
      data: {
        projectId: apsProjectId,
        lastSeenAt: new Date(),
        pollStatus: "ACTIVE",
      },
    });

    logger.info("[POLLING] Initialized cursor", { projectId: apsProjectId });
    return cursor;
  }

  /**
   * Pause polling for a project
   */
  async pauseProject(apsProjectId: string) {
    await prisma.apsPollCursor.update({
      where: { projectId: apsProjectId },
      data: { pollStatus: "PAUSED" },
    });

    logger.info("[POLLING] Paused", { projectId: apsProjectId });
  }

  /**
   * Resume polling for a project
   */
  async resumeProject(apsProjectId: string) {
    await prisma.apsPollCursor.update({
      where: { projectId: apsProjectId },
      data: {
        pollStatus: "ACTIVE",
        errorCount: 0,
        lastError: null,
      },
    });

    logger.info("[POLLING] Resumed", { projectId: apsProjectId });
  }
}

export const pollingService = new PollingService();

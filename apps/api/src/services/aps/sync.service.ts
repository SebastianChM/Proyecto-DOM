import prisma from "../../lib/prisma";
import { apsDataManagementService } from "./data-management.service";
import { apsAuthService } from "./auth.service";
import { logger } from "../../lib/logger";

export class ApsSyncService {
  async syncAccount() {
    logger.info("[SYNC] Starting Account Sync");
    const token = await apsAuthService.getInternalToken();

    const hubs = await apsDataManagementService.getHubs(token);
    for (const hub of hubs) {
      await prisma.apsHub.upsert({
        where: { id: hub.id },
        update: { name: hub.attributes.name, region: hub.attributes.region },
        create: {
          id: hub.id,
          name: hub.attributes.name,
          region: hub.attributes.region,
        },
      });
      logger.debug("[SYNC] Synced Hub", { hub: hub.attributes.name });
      await this.syncProjects(hub.id, token);
    }
    logger.info("[SYNC] Account Sync Completed");
  }

  async syncProjects(hubId: string, token: string) {
    const projects = await apsDataManagementService.getProjects(hubId, token);
    for (const project of projects) {
      await prisma.apsProject.upsert({
        where: { id: project.id },
        update: { name: project.attributes.name, hubId: hubId },
        create: { id: project.id, name: project.attributes.name, hubId: hubId },
      });
      logger.debug("[SYNC] Synced Project", {
        project: project.attributes.name,
      });

      // Sync Root Folder (Project Files)
      const projectWithRoot = project as { rootFolderId?: string };
      if (projectWithRoot.rootFolderId) {
        const rootFolderId = projectWithRoot.rootFolderId;

        await prisma.apsFolder.upsert({
          where: { id: rootFolderId },
          update: {
            name: "Project Files",
            projectId: project.id,
            parentId: null,
          },
          create: {
            id: rootFolderId,
            name: "Project Files",
            projectId: project.id,
            parentId: null,
          },
        });

        // Recursively scan
        await this.scanFolderRecursively(project.id, rootFolderId, token);
      }
    }
  }

  async scanFolderRecursively(
    projectId: string,
    folderId: string,
    token: string,
  ) {
    try {
      const contents = await apsDataManagementService.getFolderContents(
        projectId,
        folderId,
        token,
      );

      const folders = contents.filter((item: unknown) => {
        const i = item as { type?: string };
        return i.type === "folders";
      });
      const items = contents.filter((item: unknown) => {
        const i = item as { type?: string };
        return i.type === "items";
      });

      // Process Subfolders
      for (const folder of folders) {
        await prisma.apsFolder.upsert({
          where: { id: folder.id },
          update: {
            name: folder.attributes.displayName,
            projectId: projectId,
            parentId: folderId,
          },
          create: {
            id: folder.id,
            name: folder.attributes.displayName,
            projectId: projectId,
            parentId: folderId,
          },
        });

        // Recurse
        await this.scanFolderRecursively(projectId, folder.id, token);
      }

      // Process Items (Files)
      for (const item of items) {
        await prisma.apsItem.upsert({
          where: { id: item.id },
          update: {
            name: item.attributes.displayName,
            folderId: folderId,
            projectId: projectId,
          },
          create: {
            id: item.id,
            name: item.attributes.displayName,
            folderId: folderId,
            projectId: projectId,
          },
        });
        // Note: Skipping version details for sync performance
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error("[SYNC] Error scanning folder", {
        folderId,
        error: err.message || "Unknown error",
      });
    }
  }
}

export const apsSyncService = new ApsSyncService();

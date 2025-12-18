
import prisma from '../../lib/prisma';
import { apsDataManagementService } from './data-management.service';
import { apsAuthService } from './auth.service';

export class ApsSyncService {

    async syncAccount() {
        console.log("Starting Account Sync...");
        const token = await apsAuthService.getInternalToken();

        const hubs = await apsDataManagementService.getHubs(token);
        for (const hub of hubs) {
            await prisma.apsHub.upsert({
                where: { id: hub.id },
                update: { name: hub.attributes.name, region: hub.attributes.region },
                create: { id: hub.id, name: hub.attributes.name, region: hub.attributes.region }
            });
            console.log(`Synced Hub: ${hub.attributes.name}`);
            await this.syncProjects(hub.id, token);
        }
        console.log("Account Sync Completed.");
    }

    async syncProjects(hubId: string, token: string) {
        const projects = await apsDataManagementService.getProjects(hubId, token);
        for (const project of projects) {
            await prisma.apsProject.upsert({
                where: { id: project.id },
                update: { name: project.attributes.name, hubId: hubId },
                create: { id: project.id, name: project.attributes.name, hubId: hubId }
            });
            console.log(`Synced Project: ${project.attributes.name}`);

            // Sync Root Folder (Project Files)
            if ((project as any).rootFolderId) {
                const rootFolderId = (project as any).rootFolderId;

                await prisma.apsFolder.upsert({
                    where: { id: rootFolderId },
                    update: { name: "Project Files", projectId: project.id, parentId: null },
                    create: { id: rootFolderId, name: "Project Files", projectId: project.id, parentId: null }
                });

                // Recursively scan
                await this.scanFolderRecursively(project.id, rootFolderId, token);
            }
        }
    }

    async scanFolderRecursively(projectId: string, folderId: string, token: string) {
        try {
            const contents = await apsDataManagementService.getFolderContents(projectId, folderId, token);

            const folders = contents.filter((item: any) => item.type === 'folders');
            const items = contents.filter((item: any) => item.type === 'items');

            // Process Subfolders
            for (const folder of folders) {
                await prisma.apsFolder.upsert({
                    where: { id: folder.id },
                    update: { name: folder.attributes.displayName, projectId: projectId, parentId: folderId },
                    create: { id: folder.id, name: folder.attributes.displayName, projectId: projectId, parentId: folderId }
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
                        projectId: projectId
                    },
                    create: {
                        id: item.id,
                        name: item.attributes.displayName,
                        folderId: folderId,
                        projectId: projectId
                    }
                });
                // Note: Skipping version details for sync performance
            }

        } catch (error: any) {
            console.error(`Error scanning folder ${folderId}:`, error.message);
        }
    }
}

export const apsSyncService = new ApsSyncService();

import prisma from '../../lib/prisma';
import { apsDataManagementService } from './data-management.service';

export class ApsSyncService {
    
    async syncAccount() {
        console.log("Starting Account Sync...");
        const hubs = await apsDataManagementService.getHubs();
        for (const hub of hubs) {
            await prisma.apsHub.upsert({
                where: { id: hub.id },
                update: { name: hub.attributes.name, region: hub.attributes.region },
                create: { id: hub.id, name: hub.attributes.name, region: hub.attributes.region }
            });
            console.log(`Synced Hub: ${hub.attributes.name}`);
            await this.syncProjects(hub.id);
        }
        console.log("Account Sync Completed.");
    }

    async syncProjects(hubId: string) {
        const projects = await apsDataManagementService.getProjects(hubId);
        for (const project of projects) {
            await prisma.apsProject.upsert({
                where: { id: project.id },
                update: { name: project.attributes.name, hubId: hubId },
                create: { id: project.id, name: project.attributes.name, hubId: hubId }
            });
            console.log(`Synced Project: ${project.attributes.name}`);
            
            // Sync Top Folders
            const topFolders = await apsDataManagementService.getTopFolders(hubId, project.id);
            for (const folder of topFolders) {
                // Create Top Folder
                await prisma.apsFolder.upsert({
                    where: { id: folder.id },
                    update: { name: folder.attributes.displayName, projectId: project.id, parentId: null },
                    create: { id: folder.id, name: folder.attributes.displayName, projectId: project.id, parentId: null }
                });
                
                // Recursively scan
                await this.scanFolderRecursively(project.id, folder.id);
            }
        }
    }

    async scanFolderRecursively(projectId: string, folderId: string) {
        try {
            const contents = await apsDataManagementService.getFolderContents(projectId, folderId);
            
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
                await this.scanFolderRecursively(projectId, folder.id);
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

                // Sync Versions (Optional: can be done on demand or here)
                // For now, let's just get the tip version if available in attributes
                // Usually item.relationships.tip.data.id gives the latest version ID
                
                const tipVersionId = item.relationships?.tip?.data?.id;
                if (tipVersionId) {
                    // We might need to fetch version details to get URN
                    // Or we can defer this.
                    // Let's try to fetch it to have the URN ready for the viewer.
                    try {
                        // This might be too slow for all files. 
                        // Optimization: Only fetch if not exists or if we need it.
                        // For the prototype, let's skip deep version fetching to avoid rate limits.
                        // We can implement a "Sync File" method later.
                    } catch (e) {
                        console.warn(`Failed to sync version for item ${item.id}`);
                    }
                }
            }

        } catch (error: any) {
            console.error(`Error scanning folder ${folderId}:`, error.message);
        }
    }
}

export const apsSyncService = new ApsSyncService();

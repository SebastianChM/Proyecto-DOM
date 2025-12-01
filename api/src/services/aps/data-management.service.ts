import axios from 'axios';
import { apsAuthService } from './auth.service';

const APS_BASE_URL = 'https://developer.api.autodesk.com';

export class ApsDataManagementService {
    
    private async getClient() {
        const token = await apsAuthService.getInternalToken();
        return axios.create({
            baseURL: APS_BASE_URL,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    }

    /**
     * Get all Hubs (BIM 360 / ACC Accounts)
     */
    async getHubs() {
        const client = await this.getClient();
        const response = await client.get('/project/v1/hubs');
        console.log("Hubs Response:", JSON.stringify(response.data, null, 2));
        return response.data.data;
    }

    /**
     * Get all Projects in a Hub
     */
    async getProjects(hubId: string) {
        const client = await this.getClient();
        const response = await client.get(`/project/v1/hubs/${hubId}/projects`);
        return response.data.data;
    }

    /**
     * Get Top Folders of a Project
     */
    async getTopFolders(hubId: string, projectId: string) {
        const client = await this.getClient();
        const response = await client.get(`/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`);
        return response.data.data;
    }

    /**
     * Get Contents of a Folder
     */
    async getFolderContents(projectId: string, folderId: string) {
        const client = await this.getClient();
        const response = await client.get(`/data/v1/projects/${projectId}/folders/${folderId}/contents`);
        return response.data.data;
    }

    /**
     * Get Item Details
     */
    async getItem(projectId: string, itemId: string) {
        const client = await this.getClient();
        const response = await client.get(`/data/v1/projects/${projectId}/items/${itemId}`);
        return response.data.data;
    }

    /**
     * Get Versions of an Item
     */
    async getItemVersions(projectId: string, itemId: string, accessToken?: string) {
        // If a 3-legged access token is provided (user session), use it.
        if (accessToken) {
            const url = `${APS_BASE_URL}/data/v1/projects/${projectId}/items/${itemId}/versions`;
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            return response.data.data;
        }

        const client = await this.getClient();
        const response = await client.get(`/data/v1/projects/${projectId}/items/${itemId}/versions`);
        return response.data.data;
    }
}

export const apsDataManagementService = new ApsDataManagementService();

import { apsAuthService } from './auth.service';
import axios from 'axios';

const DA_BASE_URL = 'https://developer.api.autodesk.com/da/us-east/v3';
const FORGE_CLIENT_ID = process.env.APS_CLIENT_ID || '';
// Use configured nickname or fallback to client ID (which is the default if not set)
const NICKNAME = process.env.APS_DA_NICKNAME || FORGE_CLIENT_ID;

export class APSDesignAutomationService {

    constructor() {
        // No forge-apis needed, we use REST API directly
    }

    /**
     * Get authorization header
     */
    private async getAuthHeader() {
        const token = await apsAuthService.getInternalToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Setup nickname (required once per account)
     */
    async setupNickname() {
        try {
            const headers = await this.getAuthHeader();
            // Check if nickname is already set by trying to get it (not directly possible via simple GET, 
            // but we can try to create it and handle 409)

            console.log(`🔧 Setting up Design Automation nickname: ${NICKNAME}`);

            await axios.patch(`${DA_BASE_URL}/forgeapps/me`,
                { nickname: NICKNAME },
                { headers }
            );
            console.log(`✅ Nickname set to: ${NICKNAME}`);
            return true;
        } catch (error: any) {
            // 409 means nickname already exists, which is fine
            if (error.response?.status === 409) {
                console.log(`✅ Nickname already exists (or conflict): ${NICKNAME}`);
                return true;
            }
            console.error('Failed to setup nickname:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Check if DWG to PDF activity exists, create if not
     */
    async ensureDwgToPdfActivity(): Promise<string> {
        const activityId = `${NICKNAME}.DwgToPdfActivity+prod`;
        const headers = await this.getAuthHeader();

        try {
            // Check if activity exists
            await axios.get(`${DA_BASE_URL}/activities/${activityId}`, { headers });
            console.log(`✅ Activity exists: ${activityId}`);
            return activityId;
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error(`❌ Error checking activity ${activityId}:`, error.response?.data || error.message);
                throw error;
            }
        }

        // Create the activity using AutoCAD's built-in PlotToPDF command
        console.log(`📝 Creating DWG to PDF activity: ${activityId}...`);

        // Ensure nickname is set up before creating activity
        await this.setupNickname();

        const activity = {
            id: 'DwgToPdfActivity',
            commandLine: [
                '$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /s "$(settings[script].path)"'
            ],
            parameters: {
                inputFile: {
                    verb: 'get',
                    description: 'Input DWG file',
                    required: true,
                    localName: 'input.dwg'
                },
                outputPdf: {
                    verb: 'put',
                    description: 'Output PDF file',
                    required: true,
                    localName: 'output.pdf'
                }
            },
            engine: 'Autodesk.AutoCAD+24', // AutoCAD 2024
            description: 'Converts DWG to high-quality PDF',
            settings: {
                script: {
                    value: '_-EXPORT _PDF _ALL output.pdf\n'
                }
            }
        };

        try {
            const response = await axios.post(`${DA_BASE_URL}/activities`, activity, { headers });
            console.log(`✅ Activity created: ${response.data.id}`);

            // Create alias 'prod' for the activity
            await axios.post(`${DA_BASE_URL}/activities/${activity.id}/aliases`,
                { id: 'prod', version: 1 },
                { headers }
            );
            console.log(`✅ Activity alias 'prod' created`);

            return activityId;
        } catch (error: any) {
            console.error('Failed to create activity:', error.response?.data || error.message);

            // If it failed because it already exists (race condition or partial setup), try to return the ID anyway
            if (error.response?.status === 409) {
                console.log('Activity already exists (409), returning ID.');
                return activityId;
            }
            throw error;
        }
    }

    /**
     * Convert DWG to PDF using Design Automation
     */
    async convertDwgToPdf(inputObjectId: string, outputObjectId: string, bucketKey: string): Promise<string> {
        const headers = await this.getAuthHeader();
        const token = await apsAuthService.getInternalToken();

        // Ensure the activity exists
        const activityId = await this.ensureDwgToPdfActivity();

        // Create signed URLs for input/output
        // Note: For OSS, we need to use the specific endpoint to get a signed URL or use the token in the header if supported by the engine.
        // Design Automation for AutoCAD supports passing the Authorization header in the arguments for HTTP downloads/uploads.

        const inputUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${inputObjectId}`;
        const outputUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${outputObjectId}`;

        const workItem = {
            activityId: activityId,
            arguments: {
                inputFile: {
                    url: inputUrl,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                },
                outputPdf: {
                    url: outputUrl,
                    verb: 'put',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/pdf'
                    }
                }
            }
        };

        console.log(`📤 Creating work item for DWG to PDF conversion...`);
        console.log(`   Activity: ${activityId}`);
        console.log(`   Input: ${inputObjectId}`);
        console.log(`   Output: ${outputObjectId}`);

        try {
            const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, { headers });
            console.log(`✅ Work item created: ${response.data.id}`);
            return response.data.id;
        } catch (error: any) {
            console.error('Failed to create work item:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get work item status via REST API
     */
    async getWorkItemStatusRest(workItemId: string): Promise<any> {
        const headers = await this.getAuthHeader();
        const response = await axios.get(`${DA_BASE_URL}/workitems/${workItemId}`, { headers });
        return response.data;
    }

    /**
     * Get all app bundles
     */
    async getAppBundles() {
        const headers = await this.getAuthHeader();
        const response = await axios.get(`${DA_BASE_URL}/appbundles`, { headers });
        return response.data;
    }

    /**
     * Get all activities
     */
    async getActivities() {
        const headers = await this.getAuthHeader();
        const response = await axios.get(`${DA_BASE_URL}/activities`, { headers });
        return response.data;
    }

    /**
     * Create a new activity
     */
    async createActivity(activity: any) {
        const headers = await this.getAuthHeader();
        const response = await axios.post(`${DA_BASE_URL}/activities`, activity, { headers });
        return response.data;
    }

    /**
     * Create a new app bundle
     */
    async createAppBundle(appBundle: any) {
        const headers = await this.getAuthHeader();
        const response = await axios.post(`${DA_BASE_URL}/appbundles`, appBundle, { headers });
        return response.data;
    }

    /**
     * Submit a work item (job)
     */
    async createWorkItem(workItem: any) {
        const headers = await this.getAuthHeader();
        const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, { headers });
        return response.data;
    }

    /**
     * Get work item status
     */
    async getWorkItemStatus(id: string) {
        const headers = await this.getAuthHeader();
        const response = await axios.get(`${DA_BASE_URL}/workitems/${id}`, { headers });
        return response.data;
    }

    /**
     * Delete a work item (cancel)
     */
    async deleteWorkItem(id: string) {
        const headers = await this.getAuthHeader();
        await axios.delete(`${DA_BASE_URL}/workitems/${id}`, { headers });
    }
}

export const designAutomationService = new APSDesignAutomationService();

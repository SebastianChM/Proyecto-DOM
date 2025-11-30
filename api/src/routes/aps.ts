import { Router } from 'express';
import { HubsApi, ProjectsApi, FoldersApi } from 'forge-apis';
import { apsAuthService } from '../services/aps/auth.service';
import { modelDerivativeService } from '../services/aps/model-derivative.service';

const router = Router();

// Helper to get 3-legged token from session
const getPublicToken = (req: any) => {
    if (!req.session || !req.session.token) {
        throw new Error('Unauthorized: No session token');
    }
    return { access_token: req.session.token };
};

// Get manifest for a URN (public endpoint for debugging)
router.get('/manifest/:urn', async (req, res) => {
    try {
        const { urn } = req.params;
        console.log(`📋 Getting manifest for URN: ${urn}`);
        const manifest = await modelDerivativeService.getManifest(urn);
        res.json(manifest);
    } catch (error: any) {
        console.error('Failed to get manifest:', error);
        res.status(500).json({ error: 'Failed to get manifest', details: error.message });
    }
});

// Download a specific derivative
router.get('/derivative/:urn/:derivativeUrn', async (req, res) => {
    try {
        const { urn, derivativeUrn } = req.params;
        console.log(`📥 Downloading derivative: ${derivativeUrn} from ${urn}`);
        const buffer = await modelDerivativeService.getDerivative(urn, decodeURIComponent(derivativeUrn));
        res.setHeader('Content-Disposition', 'attachment; filename="derivative.pdf"');
        res.send(buffer);
    } catch (error: any) {
        console.error('Failed to download derivative:', error);
        res.status(500).json({ error: 'Failed to download derivative', details: error.message });
    }
});

// List Hubs
router.get('/hubs', async (req, res) => {
    try {
        const token = getPublicToken(req);
        const hubsApi = new HubsApi();
        const response = await hubsApi.getHubs(null, token, token);
        res.json(response.body.data);
    } catch (error: any) {
        console.error('Failed to list hubs:', error);
        res.status(error.statusCode || 500).json({ error: 'Failed to list hubs', details: error.message });
    }
});

// List Projects in a Hub
router.get('/hubs/:hubId/projects', async (req, res) => {
    try {
        const token = getPublicToken(req);
        const projectsApi = new ProjectsApi();
        const { hubId } = req.params;
        const response = await projectsApi.getHubProjects(hubId, null, token, token);
        res.json(response.body.data);
    } catch (error: any) {
        console.error(`Failed to list projects for hub ${req.params.hubId}:`, error);
        res.status(error.statusCode || 500).json({ error: 'Failed to list projects', details: error.message });
    }
});

// List Top Folders (Top Folder) of a Project
router.get('/hubs/:hubId/projects/:projectId/topFolders', async (req, res) => {
    try {
        const token = getPublicToken(req);
        const projectsApi = new ProjectsApi();
        const { hubId, projectId } = req.params;
        const response = await projectsApi.getProjectTopFolders(hubId, projectId, token, token);
        res.json(response.body.data);
    } catch (error: any) {
        console.error(`Failed to list top folders for project ${req.params.projectId}:`, error);
        res.status(error.statusCode || 500).json({ error: 'Failed to list top folders', details: error.message });
    }
});

// List Contents of a Folder
router.get('/projects/:projectId/folders/:folderId/contents', async (req, res) => {
    try {
        const token = getPublicToken(req);
        const foldersApi = new FoldersApi();
        const { projectId, folderId } = req.params;
        const response = await foldersApi.getFolderContents(projectId, folderId, null, token, token);
        res.json(response.body.data);
    } catch (error: any) {
        console.error(`Failed to list folder contents for ${req.params.folderId}:`, error);
        res.status(error.statusCode || 500).json({ error: 'Failed to list folder contents', details: error.message });
    }
});

export default router;

/**
 * APS Hubs Router
 * Clean interface to APS services through central integration
 *
 * Handles: Hubs, Projects, Folders
 */

import { Router } from "express";
import { apsIntegrationService } from "../../services/aps/aps-integration.service";
import { asyncHandler } from "../../lib/async-handler";

const router = Router();

/**
 * GET /api/aps/hubs
 * List hubs for the authenticated user
 */
router.get("/hubs", asyncHandler(async (req, res) => {
    const hubs = await apsIntegrationService.getHubsForUser(req);
    res.json(hubs);
}));

/**
 * GET /api/aps/hubs/:hubId/projects
 * List projects in a hub
 */
router.get("/hubs/:hubId/projects", asyncHandler(async (req, res) => {
    const { hubId } = req.params;
    const projects = await apsIntegrationService.getProjectsForHub(req, hubId);
    res.json(projects);
}));

/**
 * GET /api/aps/projects/:projectId/folders/:folderId
 * Get folder contents
 */
router.get("/projects/:projectId/folders/:folderId", asyncHandler(async (req, res) => {
    const { projectId, folderId } = req.params;
    const contents = await apsIntegrationService.getFolderContents(
      req,
      projectId,
      folderId,
    );
    res.json(contents);
}));

export default router;

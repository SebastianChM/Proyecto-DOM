/**
 * APS Hubs Router
 * Clean interface to APS services through central integration
 *
 * Handles: Hubs, Projects, Folders
 */

import { Router } from "express";
import { apsIntegrationService } from "../../services/aps/aps-integration.service";
import { handleApsError } from "../../lib/utils";

const router = Router();

/**
 * GET /api/aps/hubs
 * List hubs for the authenticated user
 */
router.get("/hubs", async (req, res) => {
  try {
    const hubs = await apsIntegrationService.getHubsForUser(req);
    res.json(hubs);
  } catch (error) {
    handleApsError(error, req, res);
  }
});

/**
 * GET /api/aps/hubs/:hubId/projects
 * List projects in a hub
 */
router.get("/hubs/:hubId/projects", async (req, res) => {
  try {
    const { hubId } = req.params;
    const projects = await apsIntegrationService.getProjectsForHub(req, hubId);
    res.json(projects);
  } catch (error) {
    handleApsError(error, req, res);
  }
});

/**
 * GET /api/aps/projects/:projectId/folders/:folderId
 * Get folder contents
 */
router.get("/projects/:projectId/folders/:folderId", async (req, res) => {
  try {
    const { projectId, folderId } = req.params;
    const contents = await apsIntegrationService.getFolderContents(
      req,
      projectId,
      folderId,
    );
    res.json(contents);
  } catch (error) {
    handleApsError(error, req, res);
  }
});

export default router;

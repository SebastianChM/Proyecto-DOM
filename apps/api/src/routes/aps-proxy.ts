/**
 * APS Proxy Router
 * Clean interface to APS services through central integration
 * 
 * Hito 2: Centralized APS integration with standardized error handling
 */

import { Router, Request, Response } from "express";
import { apsIntegrationService } from "../services/aps/aps-integration.service";
import { ApsError } from "../services/aps/aps-error";

const router = Router();

/**
 * Common error handler for APS routes
 * Returns standardized JSON format
 */
function handleApsError(error: unknown, req: Request, res: Response): void {
  const requestId = req.headers["x-request-id"] as string | undefined;

  if (error instanceof ApsError) {
    // Standardized APS error response
    res.status(error.status).json({
      error: "APS_ERROR",
      code: error.code,
      message: error.message,
      requestId,
      status: error.status,
      ...(error.details && {
        apsRequestId: error.details.apsRequestId,
        apsErrorId: error.details.apsErrorId,
      }),
    });
    return;
  }

  // Unknown error
  console.error("[APS_PROXY] Unexpected error", {
    error: error instanceof Error ? error.message : String(error),
    requestId,
    timestamp: new Date().toISOString(),
  });

  res.status(500).json({
    error: "APS_ERROR",
    code: "APS_UPSTREAM",
    message: "An unexpected error occurred",
    requestId,
    status: 500,
  });
}

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

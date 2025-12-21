import { Router, Request } from "express";
import { ProjectsApi } from "forge-apis";
import { modelDerivativeService } from "../services/aps/model-derivative.service";
import { apsDataManagementService } from "../services/aps/data-management.service";

const router = Router();
const isDev = process.env.NODE_ENV !== "production";

// Helper to get 3-legged token from session
const getPublicToken = (req: Request) => {
  if (isDev) {
    console.log("[DEBUG] Session check:", {
      hasSession: !!req.session,
      hasToken: !!(req.session as { token?: string })?.token,
    });
  }

  if (!req.session || !(req.session as { token?: string }).token) {
    const error = new Error("Unauthorized: No session token");
    (error as { statusCode?: number }).statusCode = 401;
    throw error;
  }
  return { access_token: (req.session as { token: string }).token };
};

/**
 * @swagger
 * /aps/manifest/{urn}:
 *   get:
 *     summary: Get manifest for a URN
 *     tags: [APS]
 *     parameters:
 *       - in: path
 *         name: urn
 *         required: true
 *         schema:
 *           type: string
 *         description: File URN
 *     responses:
 *       200:
 *         description: Manifest data
 *       500:
 *         description: Server error
 */
// Get manifest for a URN (public endpoint for debugging)
router.get("/manifest/:urn", async (req, res) => {
  try {
    const { urn } = req.params;
    console.log(`📋 Getting manifest for URN: ${urn}`);
    const manifest = await modelDerivativeService.getManifest(urn);
    res.json(manifest);
  } catch (error: unknown) {
    console.error("Failed to get manifest:", error);
    res.status(500).json({
      error: "Failed to get manifest",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /aps/derivative/{urn}/{derivativeUrn}:
 *   get:
 *     summary: Download a specific derivative
 *     tags: [APS]
 *     parameters:
 *       - in: path
 *         name: urn
 *         required: true
 *         schema:
 *           type: string
 *         description: File URN
 *       - in: path
 *         name: derivativeUrn
 *         required: true
 *         schema:
 *           type: string
 *         description: Derivative URN
 *     responses:
 *       200:
 *         description: Derivative file
 *       500:
 *         description: Server error
 */
// Download a specific derivative
router.get("/derivative/:urn/:derivativeUrn", async (req, res) => {
  try {
    const { urn, derivativeUrn } = req.params;
    console.log(`📥 Downloading derivative: ${derivativeUrn} from ${urn}`);
    const buffer = await modelDerivativeService.getDerivative(
      urn,
      decodeURIComponent(derivativeUrn),
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="derivative.pdf"',
    );
    res.send(buffer);
  } catch (error: unknown) {
    console.error("Failed to download derivative:", error);
    res.status(500).json({
      error: "Failed to download derivative",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /aps/hubs:
 *   get:
 *     summary: List Hubs
 *     tags: [APS]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of hubs
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// List Hubs
router.get("/hubs", async (req, res) => {
  try {
    const token = getPublicToken(req);
    const hubs = await apsDataManagementService.getHubs(token.access_token);
    res.json(hubs);
  } catch (error: unknown) {
    console.error("Failed to list hubs:", error);
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    res.status(statusCode).json({
      error: "Failed to list hubs",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /aps/hubs/{hubId}/projects:
 *   get:
 *     summary: List Projects in a Hub
 *     tags: [APS]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: hubId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hub ID
 *     responses:
 *       200:
 *         description: List of projects
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// List Projects in a Hub
router.get("/hubs/:hubId/projects", async (req, res) => {
  try {
    const token = getPublicToken(req);
    const { hubId } = req.params;
    const projects = await apsDataManagementService.getProjects(
      hubId,
      token.access_token,
    );
    res.json(projects);
  } catch (error: unknown) {
    console.error(
      `Failed to list projects for hub ${req.params.hubId}:`,
      error,
    );
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    res.status(statusCode).json({
      error: "Failed to list projects",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /aps/hubs/{hubId}/projects/{projectId}/topFolders:
 *   get:
 *     summary: List Top Folders of a Project
 *     tags: [APS]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: hubId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hub ID
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: List of top folders
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// List Top Folders (Top Folder) of a Project
router.get("/hubs/:hubId/projects/:projectId/topFolders", async (req, res) => {
  try {
    const token = getPublicToken(req);
    const projectsApi = new ProjectsApi();
    const { hubId, projectId } = req.params;
    const response = await projectsApi.getProjectTopFolders(
      hubId,
      projectId,
      token,
      token,
    );
    res.json(response.body.data);
  } catch (error: unknown) {
    console.error(
      `Failed to list top folders for project ${req.params.projectId}:`,
      error,
    );
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    res.status(statusCode).json({
      error: "Failed to list top folders",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /aps/projects/{projectId}/folders/{folderId}/contents:
 *   get:
 *     summary: List Contents of a Folder
 *     tags: [APS]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Folder ID
 *     responses:
 *       200:
 *         description: List of folder contents
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
// List Contents of a Folder
router.get(
  "/projects/:projectId/folders/:folderId/contents",
  async (req, res) => {
    try {
      const token = getPublicToken(req);
      const { projectId, folderId } = req.params;
      const contents = await apsDataManagementService.getFolderContents(
        projectId,
        folderId,
        token.access_token,
      );
      res.json(contents);
    } catch (error: unknown) {
      console.error(
        `Failed to list folder contents for ${req.params.folderId}:`,
        error,
      );
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      res.status(statusCode).json({
        error: "Failed to list folder contents",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;

import { Router, Request } from "express";
import { apsDataManagementService } from "../services/aps/data-management.service";
import { apsAuthService } from "../services/aps/auth.service";

const router = Router();
const isDev = process.env.NODE_ENV !== "production";

// Middleware to get access token (3-legged preferred, 2-legged fallback)
const getAccessToken = async (req: Request) => {
  // Log session state only in development
  if (isDev) {
    const sessionData = req.session as
      | { token?: string; expiresAt?: number }
      | undefined;
    console.log("[DEBUG] Session check:", {
      hasSession: !!req.session,
      hasToken: !!sessionData?.token,
      expiresAt: sessionData?.expiresAt
        ? new Date(sessionData.expiresAt).toISOString()
        : "N/A",
      now: new Date().toISOString(),
      expired: sessionData?.expiresAt
        ? Date.now() > sessionData.expiresAt
        : "unknown",
    });
  }

  if (req.session && req.session.token) {
    // Check if token needs refresh
    if (req.session.expiresAt && Date.now() > req.session.expiresAt) {
      console.log("⚠️ Token expired, attempting refresh...");

      if (req.session.refreshToken) {
        try {
          const credentials = await apsAuthService.refreshPublicToken(
            req.session.refreshToken,
          );

          // Update session
          req.session.token = credentials.access_token;
          req.session.refreshToken = credentials.refresh_token;
          req.session.expiresAt = Date.now() + credentials.expires_in * 1000;

          console.log("✅ Token refreshed successfully");
          return credentials.access_token;
        } catch (error) {
          console.error("❌ Token refresh failed:", error);
          req.session = null; // Clear invalid session
          // Fall through to internal token? Or throw?
          // If we need user context, we MUST throw. Falling back to internal (2-legged)
          // usually results in 403 or empty data for Hubs.
          // But let's verify connection matches old logic,
          // which fell back to internal.
        }
      } else {
        console.warn("⚠️ Token expired and no refresh token available.");
      }
    } else {
      return req.session.token;
    }
  }

  // Capture specific error for debugging
  console.warn("⚠️ Session missing or expired, and refresh failed.");
  const error = new Error("Unauthorized: Session required");
  (error as { statusCode?: number }).statusCode = 401;
  throw error;
};

// GET /api/aps/hubs
router.get("/hubs", async (req, res) => {
  try {
    const token = await getAccessToken(req);
    const hubs = await apsDataManagementService.getHubs(token);
    res.json(hubs);
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      statusCode?: number;
      response?: { status?: number; data?: unknown };
    };
    console.error("Error in /hubs:", err.message);
    const statusCode =
      err.statusCode || (err.response ? err.response.status : undefined) || 500;
    res.status(statusCode).json({
      error: err.message || "Unknown error",
      details: err.response?.data,
    });
  }
});

// GET /api/aps/hubs/:hubId/projects
router.get("/hubs/:hubId/projects", async (req, res) => {
  try {
    const token = await getAccessToken(req);
    const projects = await apsDataManagementService.getProjects(
      req.params.hubId,
      token,
    );
    res.json(projects);
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      statusCode?: number;
      response?: { status?: number };
    };
    const statusCode =
      err.statusCode || (err.response ? err.response.status : undefined) || 500;
    res.status(statusCode).json({ error: err.message || "Unknown error" });
  }
});

// GET /api/aps/projects/:projectId/folders/:folderId
router.get("/projects/:projectId/folders/:folderId", async (req, res) => {
  try {
    const token = await getAccessToken(req);
    const contents = await apsDataManagementService.getFolderContents(
      req.params.projectId,
      req.params.folderId,
      token,
    );
    res.json(contents);
  } catch (error: unknown) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

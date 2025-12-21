import { Router } from "express";
import { apsAuthService } from "../services/aps/auth.service";

const router = Router();

/**
 * GET /api/viewer/token
 * Get viewer token with proper scopes (viewables:read)
 */
router.get("/token", async (req, res) => {
  try {
    const credentials = await apsAuthService.getViewerToken();
    res.json({
      access_token: credentials.access_token,
      expires_in: credentials.expires_in,
      token_type: "Bearer",
    });
  } catch (error: unknown) {
    console.error("Failed to get viewer token:", error);
    res.status(500).json({ error: "Failed to get viewer token" });
  }
});

export default router;

import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { CONSTANTS } from "../../config/constants";
import { logger } from "../../lib/logger";

const router = Router();

/**
 * @swagger
 * /auth/token:
 *   get:
 *     summary: Get Viewer Token (DEPRECATED - Use /api/viewer/token)
 *     description: Alias to /api/viewer/token. Gets a 2-legged token for the viewer.
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Viewer access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *                 expires_at:
 *                   type: integer
 *       500:
 *         description: Failed to get viewer token
 */
router.get("/token", async (req, res) => {
  // Hito 3.1: Alias to unified viewer token endpoint
  const { viewerTokenService } =
    await import("../../services/viewer/viewer-token.service");
  const requestId = req.headers["x-request-id"] as string | undefined;

  // Add deprecation header
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", '</api/viewer/token>; rel="successor-version"');

  try {
    const tokenResponse = await viewerTokenService.getViewerToken(requestId);
    res.json(tokenResponse);
  } catch {
    res.status(500).json({
      error: "VIEWER_TOKEN_ERROR",
      code: "VIEWER_TOKEN_FAILED",
      message: "Failed to generate viewer token",
      requestId,
      status: 500,
    });
  }
});

/**
 * @swagger
 * /auth/user-token:
 *   get:
 *     summary: Get User Token (3-legged)
 *     description: Returns the 3-legged user token with strict validation.
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *                 expires_at:
 *                   type: integer
 *                 scope:
 *                   type: string
 *       401:
 *         description: Session required or invalid
 *       403:
 *         description: Insufficient scopes
 */

// Rate limiter: 10 requests per minute per user (Hito 3.3)
const userTokenLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMIT.USER_TOKEN_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.USER_TOKEN_MAX_REQUESTS,
  keyGenerator: (req) => {
    const userId = req.session?.user?.id;
    return userId || req.ip; // Fallback to IP if no user
  },
  message: {
    error: "USER_TOKEN_ERROR",
    code: "USER_TOKEN_RATE_LIMITED",
    message: "Too many token requests. Please try again later.",
    status: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const requestId = req.headers["x-request-id"] as string | undefined;
    res.status(429).json({
      error: "USER_TOKEN_ERROR",
      code: "USER_TOKEN_RATE_LIMITED",
      message: "Too many token requests. Please try again later.",
      requestId,
      status: 429,
    });
  },
});

router.get("/user-token", userTokenLimiter, async (req, res) => {
  // Hito 3.3: Strict validation for user tokens
  const requestId = req.headers["x-request-id"] as string | undefined;

  // 1. Require valid session
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: "USER_TOKEN_ERROR",
      code: "USER_SESSION_REQUIRED",
      message: "Valid user session required. Please login.",
      requestId,
      status: 401,
    });
  }

  // 2. Require token in session
  if (!req.session.token) {
    return res.status(401).json({
      error: "USER_TOKEN_ERROR",
      code: "USER_SESSION_REQUIRED",
      message: "No user token in session. Please re-authenticate.",
      requestId,
      status: 401,
    });
  }

  // 3. Require refreshToken for token renewal capability
  if (!req.session.refreshToken) {
    return res.status(401).json({
      error: "USER_TOKEN_ERROR",
      code: "USER_SESSION_REQUIRED",
      message:
        "Session does not support token refresh. Please re-authenticate.",
      requestId,
      status: 401,
    });
  }

  // 4. Ensure token with refresh service (auto-refresh if needed)
  try {
    const { tokenRefreshService } =
      await import("../../services/aps/token-refresh.service");
    const validToken = await tokenRefreshService.ensureValidToken(req);

    const expiresAt = req.session.expiresAt || 0;
    const expiresIn = Math.floor((expiresAt - Date.now()) / 1000);

    // Define session type locally to avoid 'any'
    interface ApsSession {
      scope?: string;
    }
    const scope = (req.session as unknown as ApsSession).scope || "data:read";

    res.json({
      access_token: validToken,
      expires_in: Math.max(0, expiresIn),
      expires_at: expiresAt,
      scope,
      requestId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("[USER_TOKEN] Token validation failed", {
      error: errorMessage.substring(0, 200),
      userId: req.session.user.id?.substring(0, 8),
      requestId,
    });

    res.status(401).json({
      error: "USER_TOKEN_ERROR",
      code: "USER_SESSION_REQUIRED",
      message: "Failed to validate user token. Please re-authenticate.",
      requestId,
      status: 401,
    });
  }
});

export default router;

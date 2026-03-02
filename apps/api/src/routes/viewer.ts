/**
 * Viewer Token Router
 * Hito 3.1: Unified endpoint for viewer tokens
 *
 * Primary route: GET /api/viewer/token
 * Rate limit: 60 req/min per IP
 */

import { Router, Request, Response } from "express";
import { viewerTokenService } from "../services/viewer/viewer-token.service";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../lib/async-handler";
import { serviceUnavailable, internal } from "../lib/errors";

const router = Router();

// Rate limiter: 60 requests per minute per IP
const viewerTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: {
    error: "VIEWER_TOKEN_ERROR",
    code: "VIEWER_TOKEN_RATE_LIMITED",
    message: "Too many token requests. Please try again later.",
    status: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const requestId = req.headers["x-request-id"] as string | undefined;
    res.status(429).json({
      error: "VIEWER_TOKEN_ERROR",
      code: "VIEWER_TOKEN_RATE_LIMITED",
      message: "Too many token requests. Please try again later.",
      requestId,
      status: 429,
    });
  },
});

/**
 * GET /api/viewer/token
 * Primary endpoint for viewer tokens (2-legged internal)
 */
router.get(
  "/token",
  viewerTokenLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = req.headers["x-request-id"] as string | undefined;

    try {
      const tokenResponse = await viewerTokenService.getViewerToken(requestId);
      res.json(tokenResponse);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Handle specific error: VIEWER_TOKEN_BUSY
      if (errorMessage === "VIEWER_TOKEN_BUSY") {
        throw serviceUnavailable(
          "Token generation in progress. Please retry in a moment.",
          "VIEWER_TOKEN_BUSY",
        );
      }

      throw internal("Failed to generate viewer token", "VIEWER_TOKEN_FAILED");
    }
  }),
);

export default router;

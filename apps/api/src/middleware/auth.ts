import { Request, Response, NextFunction } from "express";
import { cacheService, RedisKeys } from "../lib/redis";
import { logger } from "../lib/logger";

/**
 * Authentication Middleware
 *
 * Session-based authentication (OAuth 3-legged via Autodesk)
 *
 * Flow:
 * 1. User logs in via /api/auth/login (redirects to Autodesk)
 * 2. Autodesk callback stores session with user data
 * 3. All subsequent requests validate req.session.user
 */
export const basicAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip auth for public endpoints
  const publicPaths = [
    "/health",
    "/",
    "/api/auth/login", // Allow initial login redirect
    "/api/auth/callback", // Allow OAuth callback
    "/api/auth/token", // Allow viewer token
    "/api/aps/callback",
    "/api/aps/oauth/callback",
  ];

  if (publicPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Require session authentication
  if (req.session && req.session.user) {
    // Cache user data for faster subsequent checks
    const cacheKey = RedisKeys.userProfile(req.session.user.id);
    try {
      await cacheService.set(cacheKey, req.session.user, 300);
    } catch (e) {
      logger.warn("[AUTH] Session cache write failed", {
        ...logger.fromReq(req),
        userId: req.session.user.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return next();
  }

  // No session = unauthorized
  return res.status(401).json({
    error: "Authentication required",
    type: "Unauthorized",
    message: "Please sign in with Autodesk",
    requestId: req.headers["x-request-id"],
  });
};

import { Request, Response, NextFunction } from "express";
import { cacheService, RedisKeys } from "../lib/redis";
import { logger } from "../lib/logger";
import { tokenRefreshService } from "../services/aps/token-refresh.service";
import { ApsError, ApsErrorCode } from "../services/aps/aps-error";
import { CONSTANTS } from "../config/constants";

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
    "/api/auth/login", // Allow initial login redirect
    "/api/auth/callback", // Allow OAuth callback
    "/api/auth/token", // Allow viewer token
    "/api/aps/callback",
    "/api/aps/oauth/callback",
  ];

  if (req.path === "/" || publicPaths.some((p) => req.path.startsWith(p))) {
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

// ─── Session Refresh Middleware ──────────────────────────────────────
//
// Applied globally BEFORE routes. Transparently refreshes APS tokens
// that are expiring/expired. Never blocks unauthenticated requests —
// those pass through and individual route handlers decide their own
// auth logic.
//
// Outcomes:
// - No session / no token → next() (no-op)
// - Token well within threshold → next() (no-op)
// - Token near expiry → refresh → next() with fresh token
// - Refresh fails fatally (invalid_grant / no refreshToken)
//     → clear session, return 401 SESSION_EXPIRED
// - Refresh fails transiently (APS rate limit / network)
//     → log warning, next() with stale token
// ────────────────────────────────────────────────────────────────────

export const sessionRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Only act on authenticated sessions with an APS token
  if (!req.session?.user || !req.session?.token) {
    return next();
  }

  const expiresAt = req.session.expiresAt || 0;
  const needsRefresh =
    expiresAt - Date.now() < CONSTANTS.TOKEN_REFRESH.THRESHOLD_SECONDS * 1000;

  if (!needsRefresh) {
    return next();
  }

  try {
    await tokenRefreshService.ensureValidToken(req);
  } catch (err) {
    const requestId = (req.headers["x-request-id"] as string) || undefined;

    // Unrecoverable: invalid_grant, no refreshToken, session gone
    if (
      err instanceof ApsError &&
      err.code === ApsErrorCode.APS_REFRESH_REQUIRED
    ) {
      logger.warn("[AUTH] Session expired, clearing session", {
        userId: req.session.user?.id?.substring(0, 8),
        reason: err.message,
      });

      // Clear all session data so subsequent auth checks see "no user"
      req.session.token = undefined;
      req.session.refreshToken = undefined;
      req.session.expiresAt = undefined;
      req.session.user = undefined;

      return res.status(401).json({
        error: "Session expired. Please sign in again.",
        type: "Unauthorized",
        code: "SESSION_EXPIRED",
        requestId,
      });
    }

    // Transient APS errors — don't destroy session, let the route try
    logger.warn("[AUTH] Token refresh failed (transient), proceeding", {
      userId: req.session.user?.id?.substring(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return next();
};

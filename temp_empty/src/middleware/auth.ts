import { Request, Response, NextFunction } from "express";
import { cacheService, RedisKeys } from "../lib/redis";

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
export const basicAuth = (req: Request, res: Response, next: NextFunction) => {
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
    cacheService.set(cacheKey, req.session.user, 300).catch(() => {}); // Fire and forget
    return next();
  }

  // No session = unauthorized
  return res.status(401).json({
    error: "Authentication required",
    message: "Please sign in with Autodesk",
  });
};

/**
 * Token Refresh Service
 * Centralized token refresh with concurrency control
 *
 * Hito 2.3: Early refresh with Redis locks to prevent stampede
 */

import { Request } from "express";
import { redis } from "../../lib/redis";
import { apsAuthService } from "./auth.service";
import { ApsError, ApsErrorCode } from "./aps-error";
import { logger } from "../../lib/logger";
import { CONSTANTS } from "../../config/constants";

const {
  THRESHOLD_SECONDS: REFRESH_THRESHOLD_SECONDS,
  LOCK_TTL_SECONDS,
  LOCK_RETRY_MS,
  MAX_LOCK_RETRIES,
} = CONSTANTS.TOKEN_REFRESH;

export class TokenRefreshService {
  /**
   * Ensure valid token, refresh if needed
   * Returns access token ready to use
   */
  async ensureValidToken(req: Request): Promise<string> {
    if (!req.session || !req.session.token) {
      throw new ApsError(
        ApsErrorCode.APS_REFRESH_REQUIRED,
        401,
        "User session required. Please re-authenticate.",
      );
    }

    const expiresAt = req.session.expiresAt;
    if (!expiresAt) {
      throw new ApsError(
        ApsErrorCode.APS_REFRESH_REQUIRED,
        401,
        "Session expiration not found. Please re-authenticate.",
      );
    }

    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Already expired
    if (timeUntilExpiry <= 0) {
      logger.warn("[TOKEN_REFRESH] Token already expired", {
        userId: req.session.user?.id?.substring(0, 8),
        expiredMs: Math.abs(timeUntilExpiry),
      });

      await this.refreshUserToken(req);
      return req.session.token!;
    }

    // Needs refresh soon (early refresh)
    if (timeUntilExpiry < REFRESH_THRESHOLD_SECONDS * 1000) {
      logger.debug("[TOKEN_REFRESH] Token expiring soon, refreshing early", {
        userId: req.session.user?.id?.substring(0, 8),
        timeUntilExpirySeconds: Math.floor(timeUntilExpiry / 1000),
      });

      await this.refreshUserToken(req);
      return req.session.token!;
    }

    // Token still valid
    return req.session.token;
  }

  /**
   * Refresh user token with Redis lock for concurrency control
   */
  async refreshUserToken(req: Request): Promise<void> {
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new ApsError(
        ApsErrorCode.APS_REFRESH_REQUIRED,
        401,
        "User ID not found in session",
      );
    }

    if (!req.session?.refreshToken) {
      throw new ApsError(
        ApsErrorCode.APS_REFRESH_REQUIRED,
        401,
        "Refresh token not found. Please re-authenticate.",
      );
    }

    // Try to acquire refresh lock
    const lockAcquired = await this.acquireRefreshLock(userId);

    if (!lockAcquired) {
      // Another request is refreshing — wait and re-read session from the store
      // on each iteration so we correctly detect when the lock holder finishes.
      logger.debug(
        "[TOKEN_REFRESH] Refresh lock held, waiting for completion",
        {
          userId: userId.substring(0, 8),
        },
      );

      for (let i = 0; i < MAX_LOCK_RETRIES; i++) {
        await this.sleep(LOCK_RETRY_MS);

        // Reload session from Redis so we see the lock holder's updated tokens,
        // not the stale in-memory snapshot loaded at request start.
        await new Promise<void>((resolve) => {
          req.session!.reload((err: Error | null) => {
            if (err) {
              logger.warn(
                "[TOKEN_REFRESH] Session reload failed in wait loop",
                {
                  userId: userId.substring(0, 8),
                  error: err instanceof Error ? err.message : String(err),
                },
              );
            }
            resolve(); // always continue — stale session is safer than crashing
          });
        });

        const timeUntilExpiry = (req.session?.expiresAt || 0) - Date.now();
        if (timeUntilExpiry > REFRESH_THRESHOLD_SECONDS * 1000) {
          logger.debug(
            "[TOKEN_REFRESH] Token refreshed by concurrent request",
            {
              userId: userId.substring(0, 8),
              retries: i + 1,
            },
          );
          return; // Concurrent request already refreshed the token
        }
      }

      // Lock released but token not refreshed — proceed to refresh ourselves
      logger.warn(
        "[TOKEN_REFRESH] Lock released but token not refreshed, proceeding",
        {
          userId: userId.substring(0, 8),
        },
      );
    }

    // Perform refresh — read refreshToken from session now (not at function entry)
    // so we always use the latest value after any session.reload() calls above.
    const currentRefreshToken = req.session?.refreshToken;
    if (!currentRefreshToken) {
      throw new ApsError(
        ApsErrorCode.APS_REFRESH_REQUIRED,
        401,
        "Refresh token not found after waiting. Please re-authenticate.",
      );
    }

    try {
      logger.info("[TOKEN_REFRESH] Starting token refresh", {
        userId: userId.substring(0, 8),
      });

      const credentials =
        await apsAuthService.refreshPublicToken(currentRefreshToken);

      //  Update session (safe after null checks above)
      req.session!.token = credentials.access_token;
      req.session!.refreshToken = credentials.refresh_token;
      req.session!.expiresAt = Date.now() + credentials.expires_in * 1000;

      // Save session
      await new Promise<void>((resolve, reject) => {
        req.session!.save((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info("[TOKEN_REFRESH] Token refreshed successfully", {
        userId: userId.substring(0, 8),
        expiresIn: credentials.expires_in,
      });
    } catch (error) {
      // Check for invalid_grant or 401 from APS
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isInvalidGrant =
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized");

      if (isInvalidGrant) {
        logger.error("[TOKEN_REFRESH] Refresh failed - invalid grant", {
          userId: userId.substring(0, 8),
          error: errorMessage.substring(0, 100),
          event: "token_refresh_invalid_grant",
        });

        // Destroy session tokens — caller (auth middleware) will send 401
        req.session!.token = undefined;
        req.session!.refreshToken = undefined;
        req.session!.expiresAt = undefined;

        throw new ApsError(
          ApsErrorCode.APS_REFRESH_REQUIRED,
          401,
          "Session expired. Please sign in again.",
          {
            apsStatus: 401,
          },
        );
      }

      // Other error, log and rethrow
      logger.error("[TOKEN_REFRESH] Refresh failed", {
        userId: userId.substring(0, 8),
        error: errorMessage.substring(0, 100),
      });

      throw ApsError.fromUpstream(error);
    } finally {
      // Always release lock
      if (lockAcquired) {
        await this.releaseRefreshLock(userId);
      }
    }
  }

  /**
   * Acquire refresh lock for a user
   */
  private async acquireRefreshLock(userId: string): Promise<boolean> {
    try {
      const key = `aps:refresh-lock:user:${userId}`;
      const result = await redis.set(key, "1", "EX", LOCK_TTL_SECONDS, "NX");
      return result === "OK";
    } catch (error) {
      logger.error("[TOKEN_REFRESH] Lock acquire error", {
        userId: userId.substring(0, 8),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Release refresh lock for a user
   */
  private async releaseRefreshLock(userId: string): Promise<void> {
    try {
      const key = `aps:refresh-lock:user:${userId}`;
      await redis.del(key);
    } catch (error) {
      logger.error("[TOKEN_REFRESH] Lock release error", {
        userId: userId.substring(0, 8),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const tokenRefreshService = new TokenRefreshService();

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

const REFRESH_THRESHOLD_SECONDS = 120; // Refresh when <120s remaining
const LOCK_TTL_SECONDS = 15; // Lock expires after 15s
const LOCK_RETRY_MS = 200; // Wait 200ms between retries
const MAX_LOCK_RETRIES = 10; // Max 2 seconds waiting for lock

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

    const refreshToken = req.session?.refreshToken;
    if (!refreshToken) {
      throw new ApsError(
        ApsErrorCode.APS_REFRESH_REQUIRED,
        401,
        "Refresh token not found. Please re-authenticate.",
      );
    }

    // Try to acquire refresh lock
    const lockAcquired = await this.acquireRefreshLock(userId);

    if (!lockAcquired) {
      // Another request is refreshing, wait and retry reading session
      logger.debug(
        "[TOKEN_REFRESH] Refresh lock held, waiting for completion",
        {
          userId: userId.substring(0, 8),
        },
      );

      for (let i = 0; i < MAX_LOCK_RETRIES; i++) {
        await this.sleep(LOCK_RETRY_MS);

        // Check if session was updated by the other request
        const currentExpiry = req.session?.expiresAt || 0;
        const timeUntilExpiry = currentExpiry - Date.now();

        if (timeUntilExpiry > REFRESH_THRESHOLD_SECONDS * 1000) {
          logger.debug(
            "[TOKEN_REFRESH] Token refreshed by concurrent request",
            {
              userId: userId.substring(0, 8),
              retries: i + 1,
            },
          );
          return; // Token was refreshed successfully
        }
      }

      // Lock released but token not refreshed, fall through to refresh ourselves
      logger.warn(
        "[TOKEN_REFRESH] Lock released but token not refreshed, proceeding",
        {
          userId: userId.substring(0, 8),
        },
      );
    }

    // Perform refresh
    try {
      logger.info("[TOKEN_REFRESH] Starting token refresh", {
        userId: userId.substring(0, 8),
      });

      const credentials = await apsAuthService.refreshPublicToken(refreshToken);

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

        // Clear session (safe after null checks)
        req.session!.token = undefined;
        req.session!.refreshToken = undefined;
        req.session!.expiresAt = undefined;

        throw new ApsError(
          ApsErrorCode.APS_REFRESH_REQUIRED,
          401,
          "Session expired. Please re-authenticate.",
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

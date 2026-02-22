/**
 * APS Outbound Rate Limiting
 * Control rate of requests to APS APIs
 *
 * Hito 2: Prevent APS rate limiting and reduce costs
 * CRITICAL: Fail-closed to prevent cost storms if Redis fails
 */

import { redis } from "../../lib/redis";
import { ApsError, ApsErrorCode } from "./aps-error";
import { logger } from "../../lib/logger";

export interface RateLimitConfig {
  tokensPerInterval: number; // e.g., 90 for 90 requests
  intervalSeconds: number; // e.g., 60 for 1 minute
  maxCardinality: number; // Max entries in zset before hard block
}

export class ApsOutboundRateLimiter {
  private readonly globalConfig: RateLimitConfig = {
    tokensPerInterval: 90, // 90 requests per minute (APS limit is ~100)
    intervalSeconds: 60,
    maxCardinality: 200, // Safety limit for zset size
  };

  private readonly userConfig: RateLimitConfig = {
    tokensPerInterval: 30, // 30 requests per minute per user
    intervalSeconds: 60,
    maxCardinality: 100,
  };

  /**
   * Check and consume global budget
   * FAIL CLOSED: Throws 503 if Redis unavailable
   */
  async checkGlobal(requestId?: string): Promise<void> {
    const key = `aps:ratelimit:global`;
    const allowed = await this.checkLimit(key, this.globalConfig, requestId);

    if (!allowed) {
      throw new ApsError(
        ApsErrorCode.APS_RATE_LIMITED,
        429,
        "APS global rate limit exceeded. Please try again later.",
        {
          apsStatus: 429,
        },
      );
    }
  }

  /**
   * Check and consume per-user budget
   * FAIL CLOSED: Throws 503 if Redis unavailable
   */
  async checkUser(userId: string, requestId?: string): Promise<void> {
    const key = `aps:ratelimit:user:${userId}`;
    const allowed = await this.checkLimit(key, this.userConfig, requestId);

    if (!allowed) {
      throw new ApsError(
        ApsErrorCode.APS_RATE_LIMITED,
        429,
        "APS user rate limit exceeded. Please try again later.",
        {
          apsStatus: 429,
        },
      );
    }
  }

  /**
   * Generic rate limit check using sliding window
   * FAIL CLOSED: Throws on Redis error
   */
  private async checkLimit(
    key: string,
    config: RateLimitConfig,
    requestId?: string,
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const windowStart = now - config.intervalSeconds * 1000;

      // Pipeline for atomic operations
      const pipeline = redis.pipeline();

      // 1. Remove old entries outside window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // 2. Count current entries in window
      pipeline.zcard(key);

      // 3. Get cardinality BEFORE adding
      pipeline.zcard(key);

      const results = await pipeline.exec();

      if (!results || results.length !== 3) {
        logger.error("[APS_RATE_LIMIT] Redis pipeline failed - FAIL CLOSED", {
          key: key.substring(0, 30),
          requestId,
          timestamp: new Date().toISOString(),
        });
        // FAIL CLOSED: Block request if Redis fails
        throw new ApsError(
          ApsErrorCode.APS_UPSTREAM,
          503,
          "Rate limiting service unavailable",
          { apsStatus: 503 },
        );
      }

      const currentCount = results[1][1] as number;
      const cardinality = results[2][1] as number;

      // Safety: Hard block if zset grows too large (indicates cleanup issue)
      if (cardinality >= config.maxCardinality) {
        logger.error("[APS_RATE_LIMIT] Cardinality limit exceeded", {
          key: key.substring(0, 30),
          cardinality,
          maxCardinality: config.maxCardinality,
          requestId,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      // Check if over rate limit
      if (currentCount >= config.tokensPerInterval) {
        logger.warn("[APS_RATE_LIMIT] Rate limit exceeded", {
          key: key.substring(0, 30),
          currentCount,
          limit: config.tokensPerInterval,
          requestId,
        });
        return false;
      }

      // Add current request
      await redis.zadd(key, now, `${now}-${Math.random()}`);

      // Set TTL to auto-cleanup (window + buffer)
      await redis.expire(key, config.intervalSeconds + 120);

      logger.debug("[APS_RATE_LIMIT] Request allowed", {
        key: key.substring(0, 30),
        currentCount: currentCount + 1,
        limit: config.tokensPerInterval,
      });

      return true;
    } catch (error) {
      // Check if it's already an ApsError (from our fail-closed logic)
      if (error instanceof ApsError) {
        throw error;
      }

      // FAIL CLOSED: Any Redis error blocks the request
      logger.error(
        "[APS_RATE_LIMIT] Redis error - FAIL CLOSED, blocking request",
        {
          key: key.substring(0, 30),
          error: error instanceof Error ? error.message : String(error),
          requestId,
        },
      );

      throw new ApsError(
        ApsErrorCode.APS_UPSTREAM,
        503,
        "Rate limiting service unavailable",
        { apsStatus: 503 },
      );
    }
  }

  /**
   * Get current usage for monitoring
   */
  async getUsage(userId?: string): Promise<{ count: number; limit: number }> {
    try {
      const key = userId
        ? `aps:ratelimit:user:${userId}`
        : `aps:ratelimit:global`;
      const config = userId ? this.userConfig : this.globalConfig;

      const now = Date.now();
      const windowStart = now - config.intervalSeconds * 1000;

      // Count entries in current window
      const count = await redis.zcount(key, windowStart, now);

      return {
        count,
        limit: config.tokensPerInterval,
      };
    } catch {
      // Monitoring endpoint can fail open
      return {
        count: 0,
        limit: userId
          ? this.userConfig.tokensPerInterval
          : this.globalConfig.tokensPerInterval,
      };
    }
  }
}

export const apsOutboundRateLimiter = new ApsOutboundRateLimiter();

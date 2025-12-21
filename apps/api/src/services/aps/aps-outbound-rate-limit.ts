/**
 * APS Outbound Rate Limiting
 * Control rate of requests to APS APIs
 * 
 * Hito 2: Prevent APS rate limiting and reduce costs
 */

import { redis } from "../../lib/redis";
import { ApsError, ApsErrorCode } from "./aps-error";

export interface RateLimitConfig {
    tokensPerInterval: number; // e.g., 90 for 90 requests
    intervalSeconds: number; // e.g., 60 for 1 minute
}

export class ApsOutboundRateLimiter {
    private readonly globalConfig: RateLimitConfig = {
        tokensPerInterval: 90, // 90 requests per minute (APS limit is ~100)
        intervalSeconds: 60,
    };

    private readonly userConfig: RateLimitConfig = {
        tokensPerInterval: 30, // 30 requests per minute per user
        intervalSeconds: 60,
    };

    /**
     * Check and consume global budget
     */
    async checkGlobal(): Promise<void> {
        const key = `aps:ratelimit:global`;
        const allowed = await this.checkLimit(key, this.globalConfig);

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
     */
    async checkUser(userId: string): Promise<void> {
        const key = `aps:ratelimit:user:${userId}`;
        const allowed = await this.checkLimit(key, this.userConfig);

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
     */
    private async checkLimit(
        key: string,
        config: RateLimitConfig,
    ): Promise<boolean> {
        try {
            const now = Date.now();
            const windowStart = now - config.intervalSeconds * 1000;

            // Use Redis sorted set for sliding window
            const pipeline = redis.pipeline();

            // Remove old entries
            pipeline.zremrangebyscore(key, 0, windowStart);

            // Count current entries
            pipeline.zcard(key);

            // Add current request (tentatively)
            pipeline.zadd(key, now, `${now}-${Math.random()}`);

            // Set expiration
            pipeline.expire(key, config.intervalSeconds + 60);

            const results = await pipeline.exec();

            if (!results) {
                console.warn("[APS_RATE_LIMIT] Redis pipeline failed, allowing request");
                return true; // Fail open
            }

            const currentCount = results[1][1] as number;

            // If we're over the limit, remove the tentative entry
            if (currentCount >= config.tokensPerInterval) {
                await redis.zrem(key, results[2][1] as string);
                console.warn("[APS_RATE_LIMIT] Rate limit exceeded", {
                    key: key.substring(0, 30),
                    currentCount,
                    limit: config.tokensPerInterval,
                    timestamp: new Date().toISOString(),
                });
                return false;
            }

            return true;
        } catch (error) {
            console.error("[APS_RATE_LIMIT] Check error, failing open", {
                key: key.substring(0, 30),
                error: error instanceof Error ? error.message : String(error),
            });
            return true; // Fail open on error
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
        } catch (error) {
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

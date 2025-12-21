/**
 * APS Cache Service
 * Redis cache-aside pattern for APS responses
 * 
 * Hito 2: Reduce APS API calls with TTL-based caching
 */

import { redis, RedisKeys } from "../../lib/redis";

export interface ApsCacheOptions {
    ttl?: number; // TTL in seconds, default 60
    skipCache?: boolean;
}

/**
 * Generate cache key for APS operations
 */
export const ApsCacheKeys = {
    hubs: (userId: string) => `aps:hubs:user:${userId}`,
    projects: (userId: string, hubId: string) =>
        `aps:projects:user:${userId}:hub:${hubId}`,
    folderContents: (userId: string, projectId: string, folderId: string) =>
        `aps:folder:user:${userId}:project:${projectId}:folder:${folderId}`,
    notFound: (key: string) => `${key}:notfound`, // Separate key for 404s
};

export class ApsCacheService {
    private readonly defaultTTL = 60; // 60 seconds default
    private readonly notFoundTTL = 30; // 30 seconds for 404s

    /**
     * Get cached value
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const cached = await redis.get(key);
            if (!cached) return null;

            return JSON.parse(cached) as T;
        } catch (error) {
            console.error("[APS_CACHE] Get error", {
                key: key.substring(0, 50),
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    /**
     * Set cached value
     */
    async set<T>(
        key: string,
        value: T,
        options: ApsCacheOptions = {},
    ): Promise<boolean> {
        try {
            const ttl = options.t || this.defaultTTL;
            await redis.setex(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error("[APS_CACHE] Set error", {
                key: key.substring(0, 50),
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Cache 404 response (short TTL)
     */
    async setNotFound(key: string): Promise<boolean> {
        try {
            const notFoundKey = ApsCacheKeys.notFound(key);
            await redis.setex(notFoundKey, this.notFoundTTL, "1");
            return true;
        } catch (error) {
            console.error("[APS_CACHE] SetNotFound error", {
                key: key.substring(0, 50),
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Check if key is marked as not found
     */
    async isNotFound(key: string): Promise<boolean> {
        try {
            const notFoundKey = ApsCacheKeys.notFound(key);
            const exists = await redis.exists(notFoundKey);
            return exists === 1;
        } catch (error) {
            return false;
        }
    }

    /**
     * Invalidate cache for a specific key
     */
    async invalidate(key: string): Promise<boolean> {
        try {
            await redis.del(key);
            await redis.del(ApsCacheKeys.notFound(key));
            return true;
        } catch (error) {
            console.error("[APS_CACHE] Invalidate error", {
                key: key.substring(0, 50),
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    /**
     * Invalidate cache pattern (e.g., all hubs for a user)
     */
    async invalidatePattern(pattern: string): Promise<number> {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length === 0) return 0;

            return await redis.del(...keys);
        } catch (error) {
            console.error("[APS_CACHE] InvalidatePattern error", {
                pattern: pattern.substring(0, 50),
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}

export const apsCacheService = new ApsCacheService();

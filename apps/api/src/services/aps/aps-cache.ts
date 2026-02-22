/**
 * APS Cache Service
 * Redis cache-aside pattern with deduplication
 *
 * Hito 2: Reduce APS API calls with TTL-based caching and stampede prevention
 */

import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";

export interface ApsCacheOptions {
  ttl?: number; // TTL in seconds
  skipCache?: boolean;
  scope?: string; // OAuth scope for cache key
  schemaVersion?: string; // Response schema version
}

/**
 * Generate cache key for APS operations
 * Includes userId, scope, and schema version for proper isolation
 */
export const ApsCacheKeys = {
  hubs: (userId: string, scope: string, version = "v1") =>
    `aps:${version}:${scope}:hubs:user:${userId}`,

  projects: (userId: string, hubId: string, scope: string, version = "v1") =>
    `aps:${version}:${scope}:projects:user:${userId}:hub:${hubId}`,

  folderContents: (
    userId: string,
    projectId: string,
    folderId: string,
    scope: string,
    version = "v1",
  ) =>
    `aps:${version}:${scope}:folder:user:${userId}:project:${projectId}:folder:${folderId}`,

  notFound: (key: string) => `${key}:notfound`,
  lock: (key: string) => `${key}:lock`,
  inflight: (key: string) => `${key}:inflight`,
};

export class ApsCacheService {
  private readonly defaultTTL = 60; // 60 seconds default
  private readonly notFoundTTL = 30; // 30 seconds for 404s
  private readonly lockTTL = 5; // 5 seconds for stampede prevention
  private readonly lockRetryMs = 100; // 100ms between lock retries
  private readonly maxLockRetries = 20; // Max 2 seconds waiting

  /**
   * Get cached value with deduplication
   * Prevents cache stampede with Redis locks
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: ApsCacheOptions = {},
  ): Promise<T> {
    // 1. Try cache first
    if (!options.skipCache) {
      const cached = await this.get<T>(key);
      if (cached) {
        logger.debug("[APS_CACHE] Cache hit", {
          key: key.substring(0, 50),
        });
        return cached;
      }

      // Check if marked as not found
      if (await this.isNotFound(key)) {
        logger.debug("[APS_CACHE] Cache hit (404)", {
          key: key.substring(0, 50),
        });
        throw new Error("Resource not found (cached)");
      }
    }

    logger.debug("[APS_CACHE] Cache miss", {
      key: key.substring(0, 50),
    });

    // 2. Try to acquire lock for deduplication
    const lockKey = ApsCacheKeys.lock(key);
    const lockAcquired = await this.acquireLock(lockKey);

    if (!lockAcquired) {
      // Another request is fetching, wait and retry cache
      logger.debug("[APS_CACHE] Lock held by another request, waiting", {
        key: key.substring(0, 50),
      });

      for (let i = 0; i < this.maxLockRetries; i++) {
        await this.sleep(this.lockRetryMs);

        const cached = await this.get<T>(key);
        if (cached) {
          logger.debug("[APS_CACHE] Cache hit after lock wait", {
            key: key.substring(0, 50),
            retries: i + 1,
          });
          return cached;
        }
      }

      // Lock released but no cache, fall through to fetch
      logger.warn("[APS_CACHE] Lock released but cache miss, fetching", {
        key: key.substring(0, 50),
      });
    }

    // 3. Fetch from upstream
    try {
      const value = await fetcher();

      // 4. Store in cache
      const ttl = options.ttl || this.defaultTTL;
      await this.set(key, value, { ttl });

      return value;
    } catch (error) {
      // Handle 404 specifically
      if (
        error instanceof Error &&
        (error.message.includes("404") || error.message.includes("not found"))
      ) {
        await this.setNotFound(key);
      }
      throw error;
    } finally {
      // 5. Release lock
      if (lockAcquired) {
        await this.releaseLock(lockKey);
      }
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error("[APS_CACHE] Get error", {
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
      const ttl = options.ttl || this.defaultTTL;
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error("[APS_CACHE] Set error", {
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
      logger.error("[APS_CACHE] SetNotFound error", {
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
    } catch {
      return false;
    }
  }

  /**
   * Acquire lock for cache stampede prevention
   */
  private async acquireLock(key: string): Promise<boolean> {
    try {
      const result = await redis.set(key, "1", "EX", this.lockTTL, "NX");
      return result === "OK";
    } catch {
      return false;
    }
  }

  /**
   * Release lock
   */
  private async releaseLock(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.warn("[APS_CACHE] Lock release error", {
        key: key.substring(0, 50),
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

  /**
   * Invalidate cache for a specific key
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      await redis.del(ApsCacheKeys.notFound(key));
      return true;
    } catch (error) {
      logger.error("[APS_CACHE] Invalidate error", {
        key: key.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Invalidate cache pattern (e.g., all hubs for a user)
   * Uses SCAN instead of KEYS to avoid blocking Redis in production
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys: string[] = [];
      const stream = redis.scanStream({ match: pattern, count: 100 });

      await new Promise<void>((resolve, reject) => {
        stream.on("data", (batch: string[]) => {
          keys.push(...batch);
        });
        stream.on("end", () => resolve());
        stream.on("error", (err: Error) => reject(err));
      });

      if (keys.length === 0) return 0;
      return await redis.del(...keys);
    } catch (error) {
      logger.error("[APS_CACHE] InvalidatePattern error", {
        pattern: pattern.substring(0, 50),
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }
}

export const apsCacheService = new ApsCacheService();

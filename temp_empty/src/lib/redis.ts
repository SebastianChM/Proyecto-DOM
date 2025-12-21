/**
 * Redis Client - Professional Implementation
 * Singleton pattern with automatic reconnection and error handling
 */

import Redis from "ioredis";

/**
 * Cliente Redis singleton profesional
 * Maneja reconexión automática y logging
 */
class RedisClient {
  private static instance: Redis | null = null;

  private constructor() {}

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      const redisConfig = {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 10) {
            console.error("❌ Redis: Max retries reached, giving up");
            return null;
          }
          const delay = Math.min(times * 100, 3000);
          console.warn(`⚠️  Redis: Retry attempt ${times}, waiting ${delay}ms`);
          return delay;
        },
        enableOfflineQueue: true,
        lazyConnect: false,
        // Configuración adicional para producción
        enableReadyCheck: true,
        connectTimeout: 10000,
        keepAlive: 30000,
      };

      RedisClient.instance = new Redis(redisConfig);

      // Event listeners para monitoreo
      RedisClient.instance.on("connect", () => {
        console.log("🔄 Redis: Connecting...");
      });

      RedisClient.instance.on("ready", () => {
        console.log("✅ Redis: Connected and ready");
      });

      RedisClient.instance.on("error", (error) => {
        console.error("❌ Redis: Connection error:", error.message);
      });

      RedisClient.instance.on("close", () => {
        console.warn("⚠️  Redis: Connection closed");
      });

      RedisClient.instance.on("reconnecting", (delay: number) => {
        console.log(`🔄 Redis: Reconnecting in ${delay}ms...`);
      });

      RedisClient.instance.on("end", () => {
        console.warn("⚠️  Redis: Connection ended");
      });
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
      console.log("✅ Redis: Disconnected gracefully");
    }
  }

  static getStatus(): string {
    return RedisClient.instance?.status || "disconnected";
  }
}

export const redis = RedisClient.getInstance();

/**
 * Helper para generar keys consistentes
 * Centraliza la estrategia de naming de keys
 */
export const RedisKeys = {
  // Cache keys
  userPermissions: (userId: string, projectId?: string) =>
    projectId
      ? `cache:permissions:${userId}:${projectId}`
      : `cache:permissions:${userId}`,

  projectsList: (userId: string, filters?: string) =>
    `cache:projects:list:${userId}${filters ? `:${filters}` : ""}`,

  projectDetail: (projectId: string) => `cache:project:${projectId}`,

  fileMetadata: (fileId: string) => `cache:file:${fileId}`,

  filesList: (projectId: string) => `cache:files:list:${projectId}`,

  userProfile: (userId: string) => `cache:user:${userId}`,

  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,

  userSession: (userId: string) => `session:user:${userId}`,

  // Rate limiting keys
  rateLimit: (identifier: string, endpoint: string) =>
    `ratelimit:${endpoint}:${identifier}`,

  authAttempts: (identifier: string) => `auth:attempts:${identifier}`,

  // Lock keys (para prevenir race conditions)
  lock: (resource: string, resourceId: string) =>
    `lock:${resource}:${resourceId}`,

  processingLock: (jobId: string) => `lock:processing:${jobId}`,

  // Queue keys (Bull usa internamente, pero útil documentar)
  queue: (queueName: string) => `bull:${queueName}`,

  // Temporary data
  temp: (key: string) => `temp:${key}`,

  // Notifications
  notifications: (userId: string) => `notifications:${userId}`,

  unreadCount: (userId: string) => `notifications:unread:${userId}`,
};

/**
 * Cache Service - Wrapper profesional para operaciones de cache
 * Implementa cache-aside pattern y manejo de errores
 */
export class CacheService {
  private defaultTTL = 300; // 5 minutos por defecto

  /**
   * Obtiene un valor del cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;

      return JSON.parse(value) as T;
    } catch (error: unknown) {
      console.error(
        `❌ Cache get error for key ${key}:`,
        (error as Error).message,
      );
      return null;
    }
  }

  /**
   * Guarda un valor en cache con TTL
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number = this.defaultTTL,
  ): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error: unknown) {
      console.error(
        `❌ Cache set error for key ${key}:`,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Elimina una key del cache
   */
  async del(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error: unknown) {
      console.error(
        `❌ Cache delete error for key ${key}:`,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Elimina múltiples keys que coincidan con un patrón
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;

      return await redis.del(...keys);
    } catch (error: unknown) {
      console.error(
        `❌ Cache invalidate pattern error for ${pattern}:`,
        (error as Error).message,
      );
      return 0;
    }
  }

  /**
   * Verifica si una key existe
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error: unknown) {
      console.error(
        `❌ Cache exists error for key ${key}:`,
        (error as Error).message,
      );
      return false;
    }
  }

  /**
   * Cache-aside pattern: obtiene del cache o ejecuta fetcher
   * Si no existe en cache, ejecuta fetcher y guarda el resultado
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTTL,
  ): Promise<T> {
    // 1. Intentar obtener del cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Si no existe, obtener de la fuente original
    const value = await fetcher();

    // 3. Guardar en cache para futuras consultas
    await this.set(key, value, ttl);

    return value;
  }

  /**
   * Incrementa un contador atómicamente
   */
  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const value = await redis.incr(key);

      // Si es la primera vez, establecer TTL
      if (value === 1 && ttl) {
        await redis.expire(key, ttl);
      }

      return value;
    } catch (error: unknown) {
      console.error(
        `❌ Cache increment error for key ${key}:`,
        (error as Error).message,
      );
      return 0;
    }
  }

  /**
   * Obtiene múltiples keys de una vez
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];

      const values = await redis.mget(...keys);
      return values.map((v) => (v ? (JSON.parse(v) as T) : null));
    } catch (error: unknown) {
      console.error(`❌ Cache mget error:`, (error as Error).message);
      return keys.map(() => null);
    }
  }

  /**
   * Guarda múltiples keys de una vez
   */
  async mset(
    items: Array<{ key: string; value: unknown; ttl?: number }>,
  ): Promise<boolean> {
    try {
      const pipeline = redis.pipeline();

      for (const item of items) {
        const ttl = item.ttl || this.defaultTTL;
        pipeline.setex(item.key, ttl, JSON.stringify(item.value));
      }

      await pipeline.exec();
      return true;
    } catch (error: unknown) {
      console.error(`❌ Cache mset error:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Obtiene TTL restante de una key (en segundos)
   */
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error: unknown) {
      console.error(
        `❌ Cache TTL error for key ${key}:`,
        (error as Error).message,
      );
      return -1;
    }
  }
}

export const cacheService = new CacheService();

/**
 * Lock Service - Para prevenir race conditions
 */
export class LockService {
  /**
   * Adquiere un lock distribuido
   */
  async acquire(
    resource: string,
    resourceId: string,
    ttl: number = 30,
  ): Promise<boolean> {
    try {
      const key = RedisKeys.lock(resource, resourceId);
      const result = await redis.set(key, "1", "EX", ttl, "NX");
      return result === "OK";
    } catch (error: unknown) {
      console.error(`❌ Lock acquire error:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Libera un lock
   */
  async release(resource: string, resourceId: string): Promise<boolean> {
    try {
      const key = RedisKeys.lock(resource, resourceId);
      await redis.del(key);
      return true;
    } catch (error: unknown) {
      console.error(`❌ Lock release error:`, (error as Error).message);
      return false;
    }
  }

  /**
   * Ejecuta una función con lock (patrón try-finally)
   */
  async withLock<T>(
    resource: string,
    resourceId: string,
    fn: () => Promise<T>,
    ttl: number = 30,
  ): Promise<T> {
    const acquired = await this.acquire(resource, resourceId, ttl);

    if (!acquired) {
      throw new Error(`Failed to acquire lock for ${resource}:${resourceId}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(resource, resourceId);
    }
  }
}

export const lockService = new LockService();

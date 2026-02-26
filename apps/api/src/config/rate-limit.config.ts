/**
 * Unified Rate Limiting System with Redis Store
 * Production-ready with proper failure handling
 * Hito 1 - Security Hardening
 */

import { Request, Response, NextFunction } from "express";
import { redis, RedisKeys } from "../lib/redis";
import { env } from "./env";
import { logger } from "../lib/logger";

// ==================== Types ====================

export interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
  /**
   * Strict mode: Si Redis falla, rechazar request con 503
   * False: Usar fallback en memoria con umbral bajo
   */
  strictMode: boolean;
  /**
   * Per-user limiting: Usar userId si disponible, sino IP
   */
  perUser?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

// ==================== In-Memory Fallback Store ====================

/**
 * Fallback store para cuando Redis no está disponible.
 * Solo para rutas NO críticas. Auth y Admin siempre rechazan (strictMode).
 * Uses per-endpoint thresholds (conservative: ~half of Redis-backed values).
 */
class MemoryFallbackStore {
  private store: Map<string, { count: number; resetAt: number }> = new Map();
  private fallbackWarningLogged = false;

  /**
   * Per-endpoint thresholds for memory fallback.
   * These are intentionally lower than Redis-backed limits as a safety margin.
   */
  private readonly TIER_THRESHOLDS: Record<string, number> = {
    auth: 3,              // Redis: 5 (strict, but define for safety)
    admin: 15,            // Redis: 30 (strict, but define for safety)
    upload: 10,           // Redis: 20
    conversion: 15,       // Redis: 30
    derivatives: 25,      // Redis: 50
    api: 50,              // Redis: 100
    webhook: 50,          // Redis: 100
    heavy_operation: 5,   // Redis: 10
  };

  private readonly DEFAULT_THRESHOLD = 10;

  getThreshold(endpoint: string): number {
    return this.TIER_THRESHOLDS[endpoint] ?? this.DEFAULT_THRESHOLD;
  }

  check(
    key: string,
    windowMs: number,
    endpoint: string,
  ): { count: number; allowed: boolean; threshold: number } {
    const now = Date.now();
    const threshold = this.getThreshold(endpoint);

    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      // Window expired or first request: start fresh
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      this.logFallbackWarning();
      return { count: 1, allowed: true, threshold };
    }

    // Within window: increment and check
    entry.count += 1;
    const allowed = entry.count <= threshold;

    // Limpieza periódica (probabilistic, ~every 1000 requests)
    if (Math.random() < 0.001) {
      this.cleanup(now);
    }

    this.logFallbackWarning();
    return { count: entry.count, allowed, threshold };
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Log warning once when memory fallback is first activated.
   * Avoids spamming logs on every request.
   */
  private logFallbackWarning(): void {
    if (!this.fallbackWarningLogged) {
      logger.warn(
        "[RATE_LIMIT] Memory fallback ACTIVE — Redis unavailable. " +
          "Per-endpoint thresholds in effect (reduced limits). " +
          "This warning is logged once until Redis recovers.",
      );
      this.fallbackWarningLogged = true;
    }
  }

  /** Called when Redis recovers to reset the one-time warning flag. */
  resetWarning(): void {
    this.fallbackWarningLogged = false;
  }
}

const memoryFallback = new MemoryFallbackStore();

// ==================== Rate Limiter Service ====================

export class RateLimiterService {
  private redisAvailable = true;
  private lastRedisCheck = 0;
  private readonly REDIS_CHECK_INTERVAL = 30000; // 30s

  /**
   * Verifica rate limit usando Redis con sliding window
   */
  private async checkLimitRedis(
    identifier: string,
    endpoint: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key = RedisKeys.rateLimit(identifier, endpoint);
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      // Pipeline para operaciones atómicas
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      pipeline.expire(key, windowSeconds + 60);

      const results = await pipeline.exec();

      if (!results) {
        throw new Error("Redis pipeline execution failed");
      }

      const currentCount = results[1][1] as number;
      const isAllowed = currentCount < maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount - 1);

      // Calcular reset time
      const oldestTimestamp = await redis.zrange(key, 0, 0, "WITHSCORES");
      const resetTime =
        oldestTimestamp.length > 0
          ? parseInt(oldestTimestamp[1]) + windowSeconds * 1000
          : now + windowSeconds * 1000;

      return {
        allowed: isAllowed,
        limit: maxRequests,
        remaining,
        resetTime: new Date(resetTime),
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[RATE_LIMIT] Redis error", {
        error: msg,
        endpoint,
      });

      // Marcar Redis como no disponible
      this.redisAvailable = false;
      this.lastRedisCheck = now;

      throw error; // Re-throw para que lo maneje el middleware
    }
  }

  /**
   * Verifica rate limit usando memoria (fallback de emergencia)
   * Solo para rutas NO críticas. Usa umbrales por endpoint (reducidos).
   */
  private checkLimitMemory(
    identifier: string,
    endpoint: string,
    windowSeconds: number,
  ): RateLimitResult {
    const key = `${identifier}:${endpoint}`;
    const windowMs = windowSeconds * 1000;
    const now = Date.now();

    const { count, allowed, threshold } = memoryFallback.check(
      key,
      windowMs,
      endpoint,
    );

    logger.debug("[RATE_LIMIT] Memory fallback check", {
      endpoint,
      identifier: identifier.substring(0, 8) + "...",
      count,
      limit: threshold,
    });

    return {
      allowed,
      limit: threshold,
      remaining: Math.max(0, threshold - count),
      resetTime: new Date(now + windowMs),
      retryAfter: windowSeconds,
    };
  }

  /**
   * Middleware principal de rate limiting
   */
  createMiddleware(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Identificador: userId si está autenticado y perUser=true, sino IP
        const identifier =
          config.perUser && req.user?.id
            ? `user:${req.user.id}`
            : `ip:${req.ip || "unknown"}`;

        let result: RateLimitResult;
        let usedFallback = false;

        try {
          result = await this.checkLimitRedis(
            identifier,
            config.endpoint,
            config.maxRequests,
            config.windowSeconds,
          );

          // Redis funcionando, marcar como disponible
          if (!this.redisAvailable) {
            logger.info("[RATE_LIMIT] Redis restored");
            this.redisAvailable = true;
            memoryFallback.resetWarning();
          }
        } catch (redisError: unknown) {
          // Redis falló - log error for debugging
          const errMsg =
            redisError instanceof Error
              ? redisError.message
              : String(redisError);
          logger.warn(
            "[RATE_LIMIT] Redis check failed, proceeding with fallback logic",
            {
              error: errMsg.substring(0, 100),
            },
          );

          if (config.strictMode) {
            // Modo estricto: rechazar request
            logger.error(
              "[RATE_LIMIT] Rejecting request - Redis unavailable (strict mode)",
              {
                endpoint: config.endpoint,
                path: req.path,
                requestId: req.headers["x-request-id"],
              },
            );

            return res.status(503).json({
              error: "Service temporarily unavailable",
              message:
                "Rate limiting service is unavailable. Please try again later.",
              code: "RATE_LIMIT_SERVICE_UNAVAILABLE",
            });
          }

          // Modo no estricto: usar fallback en memoria con umbral bajo
          result = this.checkLimitMemory(
            identifier,
            config.endpoint,
            config.windowSeconds,
          );
          usedFallback = true;
        }

        // Headers estándar de rate limit (RFC 6585)
        res.setHeader("X-RateLimit-Limit", result.limit);
        res.setHeader("X-RateLimit-Remaining", result.remaining);
        res.setHeader("X-RateLimit-Reset", result.resetTime.toISOString());

        if (usedFallback) {
          res.setHeader("X-RateLimit-Fallback", "memory");
        }

        if (!result.allowed) {
          res.setHeader("Retry-After", result.retryAfter);

          // Log intento bloqueado SIN datos sensibles
          logger.warn("[RATE_LIMIT] Request blocked", {
            endpoint: config.endpoint,
            path: req.path,
            method: req.method,
            identifier: identifier.substring(0, 15) + "...",
            userId: req.user?.id || "anonymous",
            requestId: req.headers["x-request-id"],
            status: 429,
            limit: result.limit,
            retryAfter: result.retryAfter,
          });

          return res.status(429).json({
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter,
            resetTime: result.resetTime.toISOString(),
            limit: result.limit,
            code: "RATE_LIMIT_EXCEEDED",
          });
        }

        next();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[RATE_LIMIT] Middleware error", {
          error: msg,
          endpoint: config.endpoint,
          path: req.path,
        });

        // Error inesperado: en modo estricto rechazar, sino permitir
        if (config.strictMode) {
          return res.status(503).json({
            error: "Service temporarily unavailable",
            code: "RATE_LIMIT_ERROR",
          });
        }

        next();
      }
    };
  }

  /**
   * AUTH ROUTES: /api/auth/login, /api/auth/callback
   * Estricto: 5 intentos / 5 minutos
   * Strict mode: Si Redis falla, rechaza con 503
   */
  authLimiter() {
    return this.createMiddleware({
      endpoint: "auth",
      maxRequests: env.NODE_ENV === "production" ? 5 : 50,
      windowSeconds: 5 * 60,
      strictMode: true, // NO tolerar caída de Redis
      perUser: false, // Por IP (pre-autenticación)
    });
  }

  /**
   * ADMIN ROUTES: /api/admin/*
   * Estricto: 30 intentos / minuto
   * Strict mode: Si Redis falla, rechaza con 503
   */
  adminLimiter() {
    return this.createMiddleware({
      endpoint: "admin",
      maxRequests: 30,
      windowSeconds: 60,
      strictMode: true, // NO tolerar caída de Redis
      perUser: true, // Por usuario autenticado
    });
  }

  /**
   * UPLOAD ROUTES: /api/files/upload
   * Estricto: 20 uploads / hora por usuario
   * Fallback con umbral bajo si Redis falla
   */
  uploadLimiter() {
    return this.createMiddleware({
      endpoint: "upload",
      maxRequests: 20,
      windowSeconds: 60 * 60,
      strictMode: false, // Fallback permitido
      perUser: true, // Por usuario
    });
  }

  /**
   * CONVERSION ROUTES: /api/conversion/*
   * Estricto: 30 conversiones / hora por usuario
   * Fallback con umbral bajo si Redis falla
   */
  conversionLimiter() {
    return this.createMiddleware({
      endpoint: "conversion",
      maxRequests: 30,
      windowSeconds: 60 * 60,
      strictMode: false, // Fallback permitido
      perUser: true, // Por usuario
    });
  }

  /**
   * DERIVATIVES ROUTES: /api/aps/derivatives/*
   * Moderado: 50 requests / hora por usuario
   * Fallback permitido
   */
  derivativesLimiter() {
    return this.createMiddleware({
      endpoint: "derivatives",
      maxRequests: 50,
      windowSeconds: 60 * 60,
      strictMode: false,
      perUser: true,
    });
  }

  /**
   * API GENERAL: Todas las demás rutas
   * General: 100 requests / minuto
   * Fallback permitido
   */
  apiLimiter() {
    return this.createMiddleware({
      endpoint: "api",
      maxRequests: 100,
      windowSeconds: 60,
      strictMode: false, // Fallback permitido
      perUser: false, // Por IP (más permisivo)
    });
  }

  /**
   * WEBHOOKS: /api/webhooks/*
   * Moderado: 100 requests / minuto por IP
   * Fallback permitido
   */
  webhookLimiter() {
    return this.createMiddleware({
      endpoint: "webhook",
      maxRequests: 100,
      windowSeconds: 60,
      strictMode: false,
      perUser: false, // Por IP
    });
  }

  /**
   * HEAVY OPERATIONS: Validations, Compliance, Reports
   * Estricto: 10 operations / hora por usuario
   * Fallback permitido
   */
  heavyOperationLimiter() {
    return this.createMiddleware({
      endpoint: "heavy_operation",
      maxRequests: 10,
      windowSeconds: 60 * 60,
      strictMode: false,
      perUser: true,
    });
  }

  /**
   * Resetear límite (para testing o admin)
   */
  async reset(identifier: string, endpoint: string): Promise<boolean> {
    try {
      const key = RedisKeys.rateLimit(identifier, endpoint);
      await redis.del(key);
      logger.info("[RATE_LIMIT] Reset successful", {
        identifier: identifier.substring(0, 8) + "...",
        endpoint,
      });
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[RATE_LIMIT] Reset error", { error: msg });
      return false;
    }
  }
}

export const rateLimiter = new RateLimiterService();

// Extender Request type para incluir user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

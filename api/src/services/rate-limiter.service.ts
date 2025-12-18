/**
 * Rate Limiter Service - Professional Implementation
 * Uses Redis for distributed rate limiting with sliding window algorithm
 */

import { Request, Response, NextFunction } from 'express';
import { redis, RedisKeys } from '../lib/redis';

/**
 * Rate limiter profesional usando Redis
 * Implementa sliding window algorithm para rate limiting preciso
 */
export class RateLimiterService {
  /**
   * Verifica y registra request usando sliding window
   */
  async checkLimit(
    identifier: string,
    endpoint: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = RedisKeys.rateLimit(identifier, endpoint);
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    try {
      // Pipeline para operaciones atómicas (evita race conditions)
      const pipeline = redis.pipeline();

      // 1. Remover requests fuera de la ventana de tiempo
      pipeline.zremrangebyscore(key, 0, windowStart);

      // 2. Contar requests en la ventana actual
      pipeline.zcard(key);

      // 3. Agregar request actual con timestamp
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // 4. Setear expiración de la key (limpieza automática)
      pipeline.expire(key, windowSeconds + 60);

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      // Obtener conteo de requests (antes de agregar el actual)
      const currentCount = results[1][1] as number;
      const isAllowed = currentCount < maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount - 1);

      // Calcular tiempo de reset (cuándo expira la request más antigua)
      const oldestTimestamp = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldestTimestamp.length > 0
        ? parseInt(oldestTimestamp[1]) + (windowSeconds * 1000)
        : now + (windowSeconds * 1000);

      if (!isAllowed) {
        console.warn('⚠️  Rate limit exceeded', {
          identifier,
          endpoint,
          currentCount,
          maxRequests,
          window: `${windowSeconds}s`
        });
      }

      return {
        allowed: isAllowed,
        limit: maxRequests,
        remaining,
        resetTime: new Date(resetTime),
        retryAfter: Math.ceil((resetTime - now) / 1000)
      };

    } catch (error: any) {
      console.error('❌ Rate limiter error:', error.message, { identifier, endpoint });
      // Fail open: en caso de error de Redis, permitir request
      // (Preferible a bloquear todo el servicio)
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests,
        resetTime: new Date(now + windowSeconds * 1000),
        retryAfter: windowSeconds
      };
    }
  }

  /**
   * Crea middleware de rate limiting con configuración específica
   */
  createMiddleware(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Identificador: userId si está autenticado, sino IP
        const identifier = req.user?.id || req.ip || 'anonymous';

        // Endpoint: normalizar para agrupar routes similares
        const endpoint = config.endpoint ||
          req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id') // UUIDs
            .replace(/\/\d+/g, '/:id');             // IDs numéricos

        const result = await this.checkLimit(
          identifier,
          endpoint,
          config.maxRequests,
          config.windowSeconds
        );

        // Headers estándar de rate limit (RFC 6585)
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());

        if (!result.allowed) {
          res.setHeader('Retry-After', result.retryAfter);

          return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
            retryAfter: result.retryAfter,
            resetTime: result.resetTime.toISOString(),
            limit: result.limit
          });
        }

        next();
      } catch (error: any) {
        console.error('❌ Rate limit middleware error:', error.message);
        // En caso de error, permitir request (fail open)
        next();
      }
    };
  }

  /**
   * Rate limiter específico para autenticación (más estricto)
   */
  authLimiter() {
    return this.createMiddleware({
      endpoint: 'auth',
      maxRequests: 50,  // Aumentado para desarrollo
      windowSeconds: 5 * 60  // 5 minutos (más permisivo)
    });
  }

  /**
   * Rate limiter para APIs generales
   */
  apiLimiter() {
    return this.createMiddleware({
      maxRequests: 100,
      windowSeconds: 60  // 1 minuto
    });
  }

  /**
   * Rate limiter para uploads (más restrictivo)
   */
  uploadLimiter() {
    return this.createMiddleware({
      endpoint: 'upload',
      maxRequests: 100, // Increased from 10 for development
      windowSeconds: 60 * 60  // 1 hour
    });
  }

  /**
   * Rate limiter para operaciones pesadas
   */
  heavyOperationLimiter() {
    return this.createMiddleware({
      endpoint: 'heavy',
      maxRequests: 10000, // Drastically increased for dev safety
      windowSeconds: 60 * 60  // 1 hour
    });
  }

  /**
   * Resetear límite para un identificador específico (para testing o admin)
   */
  async reset(identifier: string, endpoint: string): Promise<boolean> {
    try {
      const key = RedisKeys.rateLimit(identifier, endpoint);
      await redis.del(key);
      console.log('✅ Rate limit reset', { identifier, endpoint });
      return true;
    } catch (error: any) {
      console.error('❌ Rate limit reset error:', error.message);
      return false;
    }
  }

  /**
   * Obtener estado actual de rate limit para un identificador
   */
  async getStatus(identifier: string, endpoint: string): Promise<RateLimitStatus | null> {
    try {
      const key = RedisKeys.rateLimit(identifier, endpoint);
      const count = await redis.zcard(key);
      const ttl = await redis.ttl(key);

      if (count === 0) return null;

      return {
        currentRequests: count,
        expiresIn: ttl
      };
    } catch (error: any) {
      console.error('❌ Rate limit status error:', error.message);
      return null;
    }
  }
}

export const rateLimiter = new RateLimiterService();

// ==================== Types ====================

export interface RateLimitConfig {
  endpoint?: string;
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

export interface RateLimitStatus {
  currentRequests: number;
  expiresIn: number;
}

// Extender Request type para incluir user
declare global {
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

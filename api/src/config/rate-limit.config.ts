/**
 * Rate Limiting Configuration
 * Prevents API abuse and DDoS attacks
 */

import rateLimit from 'express-rate-limit';

/**
 * Standard API rate limiter
 * Applies to most endpoints
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    // Skip rate limiting for successful requests in development
    skip: (req) => {
        return process.env.NODE_ENV === 'development' && req.path.includes('/health');
    }
});

/**
 * Strict limiter for authentication endpoints
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many authentication attempts from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: true // Don't count successful logins
});

/**
 * File upload limiter
 * Stricter to prevent storage abuse
 */
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Max 20 uploads per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Upload limit exceeded. Please try again later.',
        retryAfter: '1 hour'
    }
});

/**
 * Conversion/processing limiter
 * Prevents overloading APS API
 */
export const conversionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // Max 30 conversions per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Conversion limit exceeded. Please try again later.',
        retryAfter: '1 hour'
    }
});

/**
 * Strict limiter for expensive operations
 * Like validation, comparison, etc.
 */
export const heavyOperationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Only 10 heavy operations per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Operation limit exceeded. These are resource-intensive operations. Please try again later.',
        retryAfter: '1 hour'
    }
});

/**
 * Very permissive limiter for read-only operations
 * Get requests, listings, etc.
 */
export const readLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests, please slow down.',
        retryAfter: '1 minute'
    }
});

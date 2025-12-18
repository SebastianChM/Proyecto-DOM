/**
 * CORS Configuration
 * Restricts API access to specific trusted origins
 */

import { CorsOptions } from 'cors';

/**
 * List of allowed origins
 * Add your production and development URLs here
 */
const getAllowedOrigins = (): string[] => {
    const origins = [
        'http://localhost:3000',           // Local development
        'http://localhost:8080',           // API itself
        process.env.FRONTEND_URL,          // Production frontend
        process.env.NEXTAUTH_URL,          // NextAuth URL
        process.env.APS_CALLBACK_URL?.replace('/api/auth/callback', ''), // APS callback domain
        process.env.APS_WEBHOOK_URL,       // Ngrok Webhook URL
    ];

    // Filter out undefined/empty values
    return origins.filter((origin): origin is string => !!origin);
};

// Helper to check if origin is allowed (supports wildcards/ngrok)
const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
    if (allowedOrigins.includes(origin)) return true;
    // Allow any ngrok-free.app subdomain for development flexibility
    if (origin.endsWith('.ngrok-free.app')) return true;
    return false;
};

/**
 * CORS options with origin validation
 */
export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();

        // Block requests with no origin in production (Postman, curl, etc.)
        // Only allow from browsers with proper origin header
        if (!origin) {
            console.warn('🚫 CORS blocked request with no origin (production mode)');
            return callback(new Error('Requests without origin are not allowed in production'));
        }

        // Check if origin is in allowed list
        if (isOriginAllowed(origin, allowedOrigins)) {
            callback(null, true);
        } else {
            console.warn(`🚫 CORS blocked request from origin: ${origin}`);
            callback(new Error(`Not allowed by CORS. Origin ${origin} is not in the allowed list.`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // Cache preflight response for 10 minutes
};

/**
 * Development CORS (less restrictive)
 * Use only in development mode
 * Allows all origins AND requests without origin (Postman, curl, etc.)
 */
export const devCorsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // In development, allow all requests (with or without origin)
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

/**
 * Get appropriate CORS options based on environment
 */
export function getCorsOptions(): CorsOptions {
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDevelopment) {
        console.log('⚠️  Using development CORS (allows all origins)');
        return devCorsOptions;
    }

    console.log('✅ Using production CORS (restricted origins)');
    return corsOptions;
}

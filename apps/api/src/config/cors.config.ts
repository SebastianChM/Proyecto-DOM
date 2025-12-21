/**
 * CORS Configuration
 * Restricts API access to specific trusted origins
 */

import { CorsOptions } from "cors";
import { env } from "./env";

/**
 * Check if origin matches ngrok pattern
 */
function isNgrokOrigin(origin: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.app$/i.test(origin);
}

/**
 * Log CORS rejection for audit purposes
 * Does not log any sensitive data
 */
function logCorsRejection(origin: string | undefined, reason: string): void {
  console.warn(`🚫 [CORS] Blocked request`, {
    origin: origin || "no-origin",
    reason,
    timestamp: new Date().toISOString(),
  });
}

export const getCorsOptions = (): CorsOptions => {
  const allowedOrigins = env.corsOrigins;

  return {
    origin: (origin, callback) => {
      // Handle requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) {
        // Allow no-origin requests only if explicitly enabled via ALLOW_NO_ORIGIN
        if (env.ALLOW_NO_ORIGIN) {
          console.log(
            "✅ [CORS] Allowed request with no origin (ALLOW_NO_ORIGIN=true)",
          );
          return callback(null, true);
        }
        logCorsRejection(origin, "No origin header and ALLOW_NO_ORIGIN=false");
        return callback(new Error("CORS: Origin header required"));
      }

      // Check exact match in allowlist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check ngrok origin in development only
      if (
        env.NODE_ENV === "development" &&
        env.DEV_ALLOW_NGROK &&
        isNgrokOrigin(origin)
      ) {
        console.log(`✅ [CORS] Allowed ngrok origin: ${origin}`);
        return callback(null, true);
      }

      // Reject with clear message
      logCorsRejection(
        origin,
        `Not in allowlist: [${allowedOrigins.join(", ")}]`,
      );
      return callback(new Error(`CORS: Origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-Request-ID",
      "X-Webhook-Secret",
    ],
  };
};

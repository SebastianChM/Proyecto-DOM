/**
 * CORS Configuration
 * Restricts API access to specific trusted origins
 */

import { CorsOptions } from "cors";
import { env } from "./env";

export const getCorsOptions = (): CorsOptions => {
  // Parse allowed origins from env.CORS_ORIGINS (comma separated)
  // Example: "http://localhost:3000,http://localhost:8080"
  const allowedOrigins = env.CORS_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      // But usually in strict production you might block them.
      if (!origin) {
        if (env.ALLOW_NO_ORIGIN) return callback(null, true);
        return callback(new Error("Not allowed by CORS (No Origin)"));
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  };
};

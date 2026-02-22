/**
 * Application Constants
 *
 * This file centralizes all magic numbers and hardcoded values.
 * Import from here instead of using inline values.
 *
 * @example
 * import { CONSTANTS } from "../config/constants";
 * const url = CONSTANTS.FRONTEND.DEFAULT_URL;
 */

// =============================================================================
// FRONTEND CONFIGURATION
// =============================================================================
export const FRONTEND = {
  /** Default frontend URL for development fallback */
  DEFAULT_URL: "http://localhost:3000",
  /** Dashboard path after login */
  DASHBOARD_PATH: "/dashboard",
  /** Auth error path */
  AUTH_ERROR_PATH: "/auth/error",
} as const;

// =============================================================================
// SESSION & COOKIES
// =============================================================================
export const SESSION = {
  /** Cookie name for session */
  COOKIE_NAME: "dom-session",
  /** Session duration: 24 hours in milliseconds */
  DURATION_MS: 24 * 60 * 60 * 1000,
  /** Session duration: 1 hour in milliseconds (for token expiry) */
  ONE_HOUR_MS: 60 * 60 * 1000,
  /** Maximum cookie size in bytes (browser limit ~4KB) */
  MAX_COOKIE_SIZE_BYTES: 4000,
  /** Redis key prefix for sessions */
  REDIS_PREFIX: "dom:sess:",
} as const;

// =============================================================================
// RATE LIMITING
// =============================================================================
export const RATE_LIMIT = {
  /** User token rate limit window: 1 minute in ms */
  USER_TOKEN_WINDOW_MS: 60 * 1000,
  /** Max token requests per window */
  USER_TOKEN_MAX_REQUESTS: 10,
} as const;

// =============================================================================
// LOGGING & ERROR HANDLING
// =============================================================================
export const LOGGING = {
  /** Max characters for truncated log entries (URNs, workItemIds) */
  TRUNCATE_SHORT: 30,
  /** Max characters for truncated error messages */
  TRUNCATE_ERROR: 1000,
  /** Max characters for user-facing error details */
  TRUNCATE_USER_ERROR: 200,
} as const;

// =============================================================================
// APS (AUTODESK PLATFORM SERVICES)
// =============================================================================
export const APS = {
  /** APS API base URL */
  BASE_URL: "https://developer.api.autodesk.com",
  /** Default bucket name (fallback) */
  DEFAULT_BUCKET: "aps-assembly-configurator-dom-demo",
} as const;

// =============================================================================
// FILE UPLOAD
// =============================================================================
export const UPLOAD = {
  /** Allowed file extensions */
  ALLOWED_EXTENSIONS: ["rvt", "dwg", "pdf", "ifc", "nwc", "dwf"] as const,
  /** Upload destination folder */
  DESTINATION: "uploads/",
  /** Default max file size: 200MB */
  DEFAULT_MAX_SIZE_BYTES: 209715200,
} as const;

// =============================================================================
// LIMITS
// =============================================================================
export const LIMITS = {
  MAX_PROJECTS_PER_USER: 50,
  MAX_FILES_PER_PROJECT: 100,
  PROJECT_NAME_MIN_LENGTH: 3,
  PROJECT_NAME_MAX_LENGTH: 50,
} as const;

// =============================================================================
// WORKFLOW PERMISSIONS (Role hierarchy scores)
// =============================================================================
export const WORKFLOW_ROLES = {
  ADMIN: 100,
  OWNER: 80,
  EDITOR: 60,
  VIEWER_DOWNLOAD: 40,
  VIEWER: 20,
} as const;

// =============================================================================
// REDIS & CACHE
// =============================================================================
export const REDIS = {
  /** Default host */
  DEFAULT_HOST: "localhost",
  /** Default port */
  DEFAULT_PORT: 6379,
} as const;

// =============================================================================
// VIEWER TOKEN
// =============================================================================
export const VIEWER_TOKEN = {
  /** Lock TTL in seconds for distributed token refresh */
  LOCK_TTL_SECONDS: 10,
  /** Safety margin: renew when less than 60s remaining */
  SAFETY_MARGIN_SECONDS: 60,
} as const;

// =============================================================================
// NOTIFICATION THRESHOLDS
// =============================================================================
export const NOTIFICATION = {
  /** Issues threshold for HIGH priority */
  HIGH_PRIORITY_THRESHOLD: 10,
  /** Issues threshold for NORMAL priority */
  NORMAL_PRIORITY_THRESHOLD: 5,
} as const;

// =============================================================================
// LEGACY EXPORT (for backward compatibility)
// =============================================================================
export const APP_CONFIG = {
  APS: {
    BUCKET_KEY: process.env.APS_BUCKET || APS.DEFAULT_BUCKET,
    BASE_URL: APS.BASE_URL,
    WEBHOOK_URL: process.env.APS_WEBHOOK_URL,
  },
  UPLOAD: {
    ALLOWED_EXTENSIONS: [...UPLOAD.ALLOWED_EXTENSIONS],
    DESTINATION: UPLOAD.DESTINATION,
  },
  LIMITS: {
    MAX_FILE_SIZE_BYTES: parseInt(
      process.env.MAX_FILE_SIZE_BYTES || String(UPLOAD.DEFAULT_MAX_SIZE_BYTES),
    ),
    MAX_PROJECTS_PER_USER: LIMITS.MAX_PROJECTS_PER_USER,
    MAX_FILES_PER_PROJECT: LIMITS.MAX_FILES_PER_PROJECT,
    PROJECT_NAME_MIN_LENGTH: LIMITS.PROJECT_NAME_MIN_LENGTH,
    PROJECT_NAME_MAX_LENGTH: LIMITS.PROJECT_NAME_MAX_LENGTH,
  },
  DEMO_MODE: process.env.DEMO_MODE === "true",
};

// Unified export for easy imports
export const CONSTANTS = {
  FRONTEND,
  SESSION,
  RATE_LIMIT,
  LOGGING,
  APS,
  UPLOAD,
  LIMITS,
  WORKFLOW_ROLES,
  REDIS,
  VIEWER_TOKEN,
  NOTIFICATION,
} as const;

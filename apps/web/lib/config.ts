/**
 * Frontend Configuration
 *
 * Centralized configuration for the web application.
 * All environment-dependent values should be defined here.
 */

// =============================================================================
// API Configuration
// =============================================================================

export const API_CONFIG = {
  /**
   * Base URL for API requests.
   * In development: Uses localhost:8080
   * In production: Uses NEXT_PUBLIC_API_URL env variable
   */
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",

  /**
   * Socket.IO server URL for real-time updates
   */
  SOCKET_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
} as const;

// =============================================================================
// App Configuration
// =============================================================================

export const APP_CONFIG = {
  /**
   * Application name
   */
  NAME: "DOM BIM Platform",

  /**
   * Default pagination limit
   */
  DEFAULT_PAGE_SIZE: 10,

  /**
   * Max file size for uploads in bytes (200MB - synced with backend)
   */
  MAX_UPLOAD_SIZE_BYTES: 200 * 1024 * 1024,

  /**
   * Allowed file extensions for upload
   */
  ALLOWED_EXTENSIONS: ["rvt", "dwg", "pdf", "ifc", "nwc", "dwf"],
} as const;

// =============================================================================
// Time Constants (in milliseconds)
// =============================================================================

export const TIME = {
  POLLING_INTERVAL: 5000,
  SOCKET_RECONNECT_DELAY: 3000,
  TOAST_DURATION: 5000,
  DEBOUNCE_DELAY: 300,
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the full API endpoint URL
 */
export function getApiUrl(path: string): string {
  const base = API_CONFIG.BASE_URL;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Get file download URL
 */
export function getFileDownloadUrl(fileId: string): string {
  return getApiUrl(`/api/files/${fileId}/download`);
}

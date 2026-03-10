/**
 * 🔧 Configuración Centralizada de Axios
 *
 * Instancia de axios preconfigurada con:
 * - withCredentials: true (envía cookies de sesión)
 * - baseURL configurada
 * - Timeouts razonables
 */

import axios from "axios";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Session-expiration guard
// ---------------------------------------------------------------------------
// Module-level flag — prevents multiple concurrent 401 SESSION_EXPIRED
// responses from each triggering a redirect (e.g. dashboard fires 5 API
// calls, all return 401 simultaneously → only the first one redirects).
let isRedirectingToLogin = false;

/** @internal Exported only for tests — resets the redirect guard. */
export function _resetSessionExpiredGuard() {
  isRedirectingToLogin = false;
}

// Use empty string to leverage Next.js proxy/rewrites by default (works for both localhost and ngrok)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Crear instancia de axios con configuración por defecto
export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ✅ CRÍTICO: Envía cookies de sesión
  timeout: 30000, // 30 segundos
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para logging (solo en desarrollo)
if (process.env.NODE_ENV === "development") {
  apiClient.interceptors.request.use(
    (config) => {
      // console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      logger.warn("API Request Error", { error: error?.message });
      return Promise.reject(error);
    },
  );

  apiClient.interceptors.response.use(
    (response) => {
      // console.log(`✅ API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      // Only log actual network/server errors, not 4xx validation errors which are handled by UI
      if (error.response && error.response.status >= 500) {
        logger.error(
          `API Error: ${error.response.status} ${error.config?.url}`,
          { data: error.response.data },
        );
      } else if (!error.response) {
        logger.error("Network Error", { error: error.message });
      }
      return Promise.reject(error);
    },
  );
}

// ---------------------------------------------------------------------------
// Session-expiration interceptor (all environments)
// ---------------------------------------------------------------------------
// Single decision point for SESSION_EXPIRED handling.
//
// When the backend sessionRefresh middleware detects an unrecoverable token
// (invalid_grant, missing refreshToken), it clears the server session and
// returns 401 with { code: "SESSION_EXPIRED" }.  This interceptor:
//   1. Detects that specific code (ignores regular 401s)
//   2. Clears local auth state (localStorage)
//   3. Redirects to login (/) exactly once
//
// Guards against loops:
//   - isRedirectingToLogin flag   → one redirect per page lifetime
//   - pathname === "/"             → no redirect if already on login
//   - Regular 401 (no code)       → passes through, no redirect
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(undefined, (error) => {
  if (
    typeof window !== "undefined" &&
    !isRedirectingToLogin &&
    axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    error.response?.data?.code === "SESSION_EXPIRED" &&
    window.location.pathname !== "/"
  ) {
    isRedirectingToLogin = true;

    // Clear persisted auth hints so login page doesn't show stale user
    try {
      localStorage.removeItem("dom_last_user");
    } catch {
      // SSR / restricted storage — ignore
    }

    // Full navigation to login — clears all React state
    window.location.href = "/";
  }
  return Promise.reject(error);
});

export default apiClient;

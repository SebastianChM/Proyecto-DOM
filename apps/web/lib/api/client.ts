/**
 * Typed HTTP request wrapper around the existing apiClient (axios).
 *
 * Converts all axios errors into a uniform `ApiError` so consumers
 * get a predictable, typed error object instead of raw AxiosError.
 *
 * Handles:
 * - 204 / empty responses  → returns `undefined` (safe for `request<void>`)
 * - Non-JSON responses     → returns raw `response.data` as-is
 * - Axios errors           → mapped to `ApiError` with status/code/body
 * - Non-axios errors       → wrapped in `ApiError` with status 0
 */

import apiClient from "@/lib/axios-config";
import axios, { type AxiosRequestConfig } from "axios";
import { ApiError, type ApiErrorBody } from "./types";

// ---------------------------------------------------------------------------
// Core request function
// ---------------------------------------------------------------------------

/**
 * Execute an HTTP request via the shared apiClient and return `response.data`.
 *
 * For void / 204 responses, returns `undefined` (callers should use `request<void>`).
 * Never throws raw AxiosErrors — always converts to `ApiError`.
 */
export async function request<T = void>(
  config: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await apiClient.request<T>(config);

    // 204 No Content or empty body → return undefined cast as T.
    // This makes `request<void>(...)` safe without the caller needing guards.
    if (response.status === 204 || response.data === undefined || response.data === null) {
      return undefined as T;
    }

    return response.data;
  } catch (err: unknown) {
    throw toApiError(err);
  }
}

// ---------------------------------------------------------------------------
// Convenience shorthands
// ---------------------------------------------------------------------------

export const api = {
  get<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request<T>({ ...config, method: "GET", url });
  },

  post<T = void>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request<T>({ ...config, method: "POST", url, data });
  },

  put<T = void>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request<T>({ ...config, method: "PUT", url, data });
  },

  patch<T = void>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return request<T>({ ...config, method: "PATCH", url, data });
  },

  delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return request<T>({ ...config, method: "DELETE", url });
  },
};

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Convert any caught value into a typed `ApiError`.
 *
 * - AxiosError with response → extracts status + body
 * - AxiosError without response (network) → status 0, code NETWORK_ERROR
 * - Plain Error → status 0, code UNKNOWN
 * - Non-Error throw → status 0, code UNKNOWN
 */
function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const rawBody = err.response?.data;

    // Only treat as ApiErrorBody if it looks like an object with `error` key
    const body: ApiErrorBody | null =
      rawBody != null && typeof rawBody === "object" && "error" in rawBody
        ? (rawBody as ApiErrorBody)
        : rawBody != null
          ? { error: typeof rawBody === "string" ? rawBody : String(rawBody) }
          : null;

    const code =
      status === 0  ? "NETWORK_ERROR"
      : status === 400 ? "VALIDATION_ERROR"
      : status === 401 ? "UNAUTHORIZED"
      : status === 403 ? "FORBIDDEN"
      : status === 404 ? "NOT_FOUND"
      : status === 429 ? "RATE_LIMITED"
      : status >= 500  ? "SERVER_ERROR"
      : "REQUEST_ERROR";

    return new ApiError(status, code, body, err);
  }

  // Non-axios error (shouldn't happen, but be safe)
  if (err instanceof Error) {
    return new ApiError(0, "UNKNOWN", { error: err.message }, err);
  }

  return new ApiError(0, "UNKNOWN", { error: String(err) }, err);
}

/**
 * Redaction & PII Masking Utility
 *
 * Sanitizes log metadata to prevent leaking secrets, tokens, and PII.
 * Applied automatically by the logger before serializing meta to JSON.
 *
 * - Sensitive keys → "[REDACTED]"
 * - Emails → masked (first 2 chars + "***@" + domain)
 * - userId/user strings → truncated to 8 chars
 * - Recurses into known nested keys up to MAX_DEPTH
 */

import { CONSTANTS } from "../config/constants";

// ── Sensitive keys (lowercase). Value is fully replaced. ────────────
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "access_token",
  "refresh_token",
  "refreshtoken",
  "token",
  "password",
  "secret",
  "apikey",
  "api_key",
  "sessionsecret",
  "session_secret",
  "aps_client_secret",
  "webhook_secret",
  "x-webhook-secret",
  "client_secret",
]);

// ── Keys whose object values should be recursed into ────────────────
const RECURSE_KEYS = new Set([
  "headers",
  "session",
  "auth",
  "details",
  "data",
  "meta",
]);

// ── PII keys ────────────────────────────────────────────────────────
const EMAIL_KEYS = new Set(["email", "useremail", "user_email"]);
const ID_KEYS = new Set(["userid", "user", "ownerid", "owner"]);

const REDACTED = "[REDACTED]";

/**
 * Mask an email address: "sebastian@dom.com" → "se***@dom.com"
 * Falls back to REDACTED if the format is unexpected.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return REDACTED;
  const prefix = email.substring(
    0,
    Math.min(CONSTANTS.OBSERVABILITY.EMAIL_VISIBLE_CHARS, at),
  );
  return `${prefix}***${email.substring(at)}`;
}

/**
 * Truncate an identifier: "550e8400-e29b-41d4-a716" → "550e8400…"
 */
export function truncateId(
  id: string,
  len: number = CONSTANTS.OBSERVABILITY.ID_TRUNCATE_LENGTH,
): string {
  if (id.length <= len) return id;
  return `${id.substring(0, len)}…`;
}

/**
 * Recursively redact sensitive values from a metadata object.
 * - Does NOT mutate the original object.
 * - Recurses into keys listed in RECURSE_KEYS, up to maxDepth.
 * - Primitive values on sensitive keys are replaced with "[REDACTED]".
 * - PII keys are masked/truncated.
 */
export function redactMeta(
  meta: Record<string, unknown>,
  depth: number = 0,
): Record<string, unknown> {
  const maxDepth = CONSTANTS.OBSERVABILITY.REDACT_MAX_DEPTH;
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(meta)) {
    const val = meta[key];
    const keyLower = key.toLowerCase();

    // 1. Fully redact sensitive keys
    if (SENSITIVE_KEYS.has(keyLower)) {
      out[key] = REDACTED;
      continue;
    }

    // 2. Mask email PII
    if (EMAIL_KEYS.has(keyLower) && typeof val === "string") {
      out[key] = maskEmail(val);
      continue;
    }

    // 3. Truncate user/id PII
    if (ID_KEYS.has(keyLower) && typeof val === "string") {
      out[key] = truncateId(val);
      continue;
    }

    // 4. Recurse into known nested objects (within depth limit)
    if (
      depth < maxDepth &&
      RECURSE_KEYS.has(keyLower) &&
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val)
    ) {
      out[key] = redactMeta(val as Record<string, unknown>, depth + 1);
      continue;
    }

    // 5. Pass through everything else unchanged
    out[key] = val;
  }

  return out;
}

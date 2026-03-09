/**
 * External Transport Initializer
 *
 * Wires an optional external error-tracking transport (Sentry) into the
 * structured logger via setTransport().  100 % optional — the app starts
 * normally when SENTRY_DSN is absent or when the SDK is not installed.
 *
 * Policy:
 *   error  → Sentry.captureException / captureMessage
 *   warn   → Sentry.addBreadcrumb (lightweight context)
 *   info   → ignored by transport
 *   debug  → ignored by transport
 */

import { env } from "./env";
import { setTransport, type LogLevel } from "../lib/logger";

/**
 * Attempt to initialise the external transport.
 *
 * Returns a human-readable status for the startup banner:
 *   "none"       — no DSN configured, transport skipped
 *   "configured" — Sentry SDK loaded and initialised
 *   "disabled"   — DSN present but SDK unavailable / init failed
 */
export async function initTransport(): Promise<
  "none" | "configured" | "disabled"
> {
  if (!env.SENTRY_DSN) return "none";

  let Sentry: typeof import("@sentry/node");

  try {
    Sentry = await import("@sentry/node");
  } catch {
    console.warn(
      "⚠️  [TRANSPORT] SENTRY_DSN is set but @sentry/node is not installed. " +
        "Install it with: npm i @sentry/node. Transport disabled.",
    );
    return "disabled";
  }

  try {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
      // Keep payload small — avoid sending local variables / request bodies
      attachStacktrace: true,
      maxBreadcrumbs: 30,
    });

    setTransport((level: LogLevel, message: string, meta?) => {
      if (level === "error") {
        // If meta contains an `error` field that looks like a message, forward it
        const errorMsg =
          meta?.error && typeof meta.error === "string"
            ? meta.error
            : undefined;
        Sentry.captureMessage(errorMsg ? `${message}: ${errorMsg}` : message, {
          level: "error",
          extra: meta,
        });
      } else if (level === "warn") {
        Sentry.addBreadcrumb({
          category: "logger.warn",
          message,
          level: "warning",
          data: meta,
        });
      }
      // info / debug → not forwarded to Sentry
    });

    return "configured";
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(
      `⚠️  [TRANSPORT] Sentry init failed: ${detail}. Transport disabled.`,
    );
    return "disabled";
  }
}

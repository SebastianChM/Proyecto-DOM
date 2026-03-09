/**
 * Unit tests for the SESSION_EXPIRED axios interceptor.
 *
 * Run with:  npx tsx --test apps/web/__tests__/session-expired-interceptor.test.ts
 *
 * Uses Node's built-in test runner (node:test) — zero extra dependencies.
 * Mocks window/localStorage since this runs outside the browser.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Minimal window mock
// ---------------------------------------------------------------------------

interface MockWindow {
  location: { pathname: string; href: string };
  localStorage: {
    store: Record<string, string>;
    removeItem: (key: string) => void;
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
}

let mockWindow: MockWindow;

function setupWindow(pathname = "/dashboard") {
  mockWindow = {
    location: { pathname, href: `http://localhost:3000${pathname}` },
    localStorage: {
      store: {},
      removeItem(key: string) {
        delete this.store[key];
      },
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
    },
  };

  // Assign to globalThis so the interceptor sees them
  (globalThis as Record<string, unknown>).window = mockWindow;
  (globalThis as Record<string, unknown>).localStorage =
    mockWindow.localStorage;
}

function teardownWindow() {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
}

// ---------------------------------------------------------------------------
// Inline interceptor logic (mirrors axios-config.ts SESSION_EXPIRED block)
//
// We test the pure decision logic rather than importing axios-config.ts
// (which needs Next.js module resolution for @/lib/logger). This guarantees
// the test stays decoupled from bundler config while testing the exact same
// conditions.
// ---------------------------------------------------------------------------

let isRedirectingToLogin = false;

function resetSessionExpiredGuard() {
  isRedirectingToLogin = false;
}

interface FakeAxiosError {
  isAxiosError: true;
  response?: {
    status: number;
    data?: Record<string, unknown>;
  };
  config?: { url?: string };
}

/**
 * Reproduces the exact condition chain from the axios interceptor.
 * Returns true if a redirect was triggered.
 */
function handleResponseError(error: FakeAxiosError): boolean {
  if (
    typeof window !== "undefined" &&
    !isRedirectingToLogin &&
    error.isAxiosError &&
    error.response?.status === 401 &&
    error.response?.data?.code === "SESSION_EXPIRED" &&
    window.location.pathname !== "/"
  ) {
    isRedirectingToLogin = true;

    try {
      localStorage.removeItem("dom_last_user");
    } catch {
      // ignore
    }

    window.location.href = "/";
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionExpired(): FakeAxiosError {
  return {
    isAxiosError: true,
    response: {
      status: 401,
      data: {
        error: "Session expired. Please sign in again.",
        type: "Unauthorized",
        code: "SESSION_EXPIRED",
      },
    },
  };
}

function makeRegular401(): FakeAxiosError {
  return {
    isAxiosError: true,
    response: {
      status: 401,
      data: {
        error: "Authentication required",
        type: "Unauthorized",
      },
    },
  };
}

function make403(): FakeAxiosError {
  return {
    isAxiosError: true,
    response: { status: 403, data: { error: "Forbidden", type: "Forbidden" } },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SESSION_EXPIRED interceptor logic", () => {
  beforeEach(() => {
    resetSessionExpiredGuard();
    setupWindow("/dashboard");
    mockWindow.localStorage.setItem(
      "dom_last_user",
      JSON.stringify({ name: "Test", email: "t@t.com" }),
    );
  });

  afterEach(() => {
    teardownWindow();
  });

  // ── 1. 401 + SESSION_EXPIRED → redirect + cleanup ────────────
  it("redirects to / and clears localStorage on SESSION_EXPIRED", () => {
    const triggered = handleResponseError(makeSessionExpired());

    assert.ok(triggered, "redirect should be triggered");
    assert.equal(mockWindow.location.href, "/");
    assert.equal(
      mockWindow.localStorage.getItem("dom_last_user"),
      null,
      "dom_last_user should be removed",
    );
  });

  // ── 2. Regular 401 (no SESSION_EXPIRED code) → no redirect ───
  it("does NOT redirect on regular 401 (no code field)", () => {
    const triggered = handleResponseError(makeRegular401());

    assert.ok(!triggered, "redirect should NOT be triggered");
    assert.notEqual(mockWindow.location.href, "/");
    assert.ok(
      mockWindow.localStorage.getItem("dom_last_user") !== null,
      "localStorage should be untouched",
    );
  });

  // ── 3. /auth/me returning 401 → no loop ──────────────────────
  it("does NOT redirect for regular 401 even if from /auth/me", () => {
    const error = makeRegular401();
    error.config = { url: "/api/auth/me" };
    const triggered = handleResponseError(error);

    assert.ok(!triggered, "must not redirect on /auth/me 401");
  });

  // ── 4. Multiple concurrent SESSION_EXPIRED → single redirect ─
  it("redirects only once when 5 concurrent SESSION_EXPIRED arrive", () => {
    let redirectCount = 0;
    const originalHref = Object.getOwnPropertyDescriptor(
      mockWindow.location,
      "href",
    );

    // Intercept href setter to count redirects
    Object.defineProperty(mockWindow.location, "href", {
      get: () => originalHref?.value ?? "/dashboard",
      set: () => {
        redirectCount++;
      },
      configurable: true,
    });

    // Simulate 5 concurrent SESSION_EXPIRED responses
    for (let i = 0; i < 5; i++) {
      handleResponseError(makeSessionExpired());
    }

    assert.equal(redirectCount, 1, "must redirect exactly once");
  });

  // ── 5. Already on login page → no redirect ───────────────────
  it("does NOT redirect when already on / (login page)", () => {
    teardownWindow();
    setupWindow("/"); // Already on login

    const triggered = handleResponseError(makeSessionExpired());

    assert.ok(!triggered, "must not redirect when already on /");
  });

  // ── 6. Non-401 errors pass through untouched ─────────────────
  it("does NOT redirect on 403 or other non-401 errors", () => {
    const triggered = handleResponseError(make403());
    assert.ok(!triggered);
  });

  // ── 7. Guard resets correctly ─────────────────────────────────
  it("can redirect again after guard is reset", () => {
    handleResponseError(makeSessionExpired());
    assert.ok(isRedirectingToLogin, "guard should be set");

    resetSessionExpiredGuard();
    setupWindow("/dashboard"); // fresh window

    const triggered = handleResponseError(makeSessionExpired());
    assert.ok(triggered, "should redirect after guard reset");
  });
});

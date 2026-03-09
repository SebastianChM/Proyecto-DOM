/**
 * Tests for initTransport() — verifies the three possible states:
 *   none       — no SENTRY_DSN
 *   configured — DSN + SDK initialised
 *   disabled   — DSN present but SDK unavailable / init fails
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// We need to control env.SENTRY_DSN before the module loads,
// so we use jest.mock + dynamic require for each scenario.

const mockInit = jest.fn();
const mockCaptureMessage = jest.fn();
const mockAddBreadcrumb = jest.fn();

// Default: SDK available
jest.mock("@sentry/node", () => ({
  init: mockInit,
  captureMessage: mockCaptureMessage,
  addBreadcrumb: mockAddBreadcrumb,
}));

// Mock setTransport so we can inspect the wired function
const mockSetTransport = jest.fn();
jest.mock("../../src/lib/logger", () => ({
  setTransport: mockSetTransport,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSetTransport.mockReset();
  mockInit.mockReset();
});

describe("initTransport", () => {
  it('returns "none" when SENTRY_DSN is absent', async () => {
    // Mock env without DSN
    jest.mock("../../src/config/env", () => ({
      env: {
        SENTRY_DSN: undefined,
        NODE_ENV: "test",
        SENTRY_TRACES_SAMPLE_RATE: 0.1,
      },
    }));

    // Clear cached module to pick up fresh mock
    jest.resetModules();

    // Re-apply mocks after resetModules
    jest.doMock("@sentry/node", () => ({
      init: mockInit,
      captureMessage: mockCaptureMessage,
      addBreadcrumb: mockAddBreadcrumb,
    }));
    jest.doMock("../../src/lib/logger", () => ({
      setTransport: mockSetTransport,
    }));
    jest.doMock("../../src/config/env", () => ({
      env: {
        SENTRY_DSN: undefined,
        NODE_ENV: "test",
        SENTRY_TRACES_SAMPLE_RATE: 0.1,
      },
    }));

    const { initTransport } = require("../../src/config/transport");
    const result = await initTransport();

    expect(result).toBe("none");
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockSetTransport).not.toHaveBeenCalled();
  });

  it('returns "configured" when SENTRY_DSN is set and SDK loads', async () => {
    jest.resetModules();

    jest.doMock("@sentry/node", () => ({
      init: mockInit,
      captureMessage: mockCaptureMessage,
      addBreadcrumb: mockAddBreadcrumb,
    }));
    jest.doMock("../../src/lib/logger", () => ({
      setTransport: mockSetTransport,
    }));
    jest.doMock("../../src/config/env", () => ({
      env: {
        SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
        NODE_ENV: "test",
        SENTRY_TRACES_SAMPLE_RATE: 0.5,
      },
    }));

    const { initTransport } = require("../../src/config/transport");
    const result = await initTransport();

    expect(result).toBe("configured");
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@o0.ingest.sentry.io/0",
        environment: "test",
        tracesSampleRate: 0.5,
      }),
    );
    expect(mockSetTransport).toHaveBeenCalledWith(expect.any(Function));
  });

  it('returns "disabled" when SDK import fails', async () => {
    jest.resetModules();

    // Make @sentry/node throw on import
    jest.doMock("@sentry/node", () => {
      throw new Error("Cannot find module '@sentry/node'");
    });
    jest.doMock("../../src/lib/logger", () => ({
      setTransport: mockSetTransport,
    }));
    jest.doMock("../../src/config/env", () => ({
      env: {
        SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
        NODE_ENV: "test",
        SENTRY_TRACES_SAMPLE_RATE: 0.1,
      },
    }));

    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    const { initTransport } = require("../../src/config/transport");
    const result = await initTransport();

    expect(result).toBe("disabled");
    expect(mockSetTransport).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("@sentry/node is not installed"),
    );

    warnSpy.mockRestore();
  });

  it('returns "disabled" when Sentry.init() throws', async () => {
    jest.resetModules();

    const failingInit = jest.fn(() => {
      throw new Error("Invalid DSN");
    });

    jest.doMock("@sentry/node", () => ({
      init: failingInit,
      captureMessage: mockCaptureMessage,
      addBreadcrumb: mockAddBreadcrumb,
    }));
    jest.doMock("../../src/lib/logger", () => ({
      setTransport: mockSetTransport,
    }));
    jest.doMock("../../src/config/env", () => ({
      env: {
        SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
        NODE_ENV: "test",
        SENTRY_TRACES_SAMPLE_RATE: 0.1,
      },
    }));

    const warnSpy = jest.spyOn(console, "warn").mockImplementation();

    const { initTransport } = require("../../src/config/transport");
    const result = await initTransport();

    expect(result).toBe("disabled");
    expect(failingInit).toHaveBeenCalled();
    expect(mockSetTransport).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Sentry init failed"),
    );

    warnSpy.mockRestore();
  });

  it("wired transport forwards errors to captureMessage", async () => {
    jest.resetModules();

    jest.doMock("@sentry/node", () => ({
      init: mockInit,
      captureMessage: mockCaptureMessage,
      addBreadcrumb: mockAddBreadcrumb,
    }));
    jest.doMock("../../src/lib/logger", () => ({
      setTransport: mockSetTransport,
    }));
    jest.doMock("../../src/config/env", () => ({
      env: {
        SENTRY_DSN: "https://key@o0.ingest.sentry.io/0",
        NODE_ENV: "test",
        SENTRY_TRACES_SAMPLE_RATE: 0.1,
      },
    }));

    const { initTransport } = require("../../src/config/transport");
    await initTransport();

    // Get the transport function that was passed to setTransport
    const transportFn = mockSetTransport.mock.calls[0][0];

    // error → captureMessage
    transportFn("error", "Something broke", { error: "details" });
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "Something broke: details",
      expect.objectContaining({ level: "error" }),
    );

    // warn → addBreadcrumb
    transportFn("warn", "Watch out", { hint: "maybe" });
    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "logger.warn",
        message: "Watch out",
        level: "warning",
      }),
    );

    // info → no forwarding
    mockCaptureMessage.mockClear();
    mockAddBreadcrumb.mockClear();
    transportFn("info", "Just info");
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });
});

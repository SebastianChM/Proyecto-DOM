import express from "express";
import dashboardRouter from "./routes/dashboard";
import cors from "cors";
import helmet from "helmet";
import crypto from "crypto";

import { rateLimiter } from "./config/rate-limit.config";

// Load and validate environment variables (Fail fast)
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { initTransport } from "./config/transport";
import path from "path";

// Routes
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import filesRouter from "./routes/files";
import syncRoutes from "./routes/files/sync.routes";
import projectsRouter from "./routes/projects";
import projectMembersRouter from "./routes/project-members";
import conversionRouter from "./routes/conversion";
import apsRouter from "./routes/aps";
import translationRouter from "./routes/translation";
import viewerRouter from "./routes/viewer";
import validationRouter from "./routes/validation";
import notificationsRouter from "./routes/notifications";
import reportsRouter from "./routes/reports";
import webhooksRouter from "./routes/webhooks";
import {
  v2RulesRouter as complianceV2Router,
  v2RunsRouter as complianceRunsRouter,
  v2ExportRouter as complianceExportRouter,
} from "./routes/compliance";
import dataSourcesRouter from "./routes/data-sources";
import workflowsRouter from "./routes/workflows";
import designAutomationCallbackRouter from "./routes/design-automation-callback";
import auditRouter from "./routes/audit";
import { complianceV3Router } from "./routes/compliance-v3";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

process.on("uncaughtException", (error) => {
  logger.error("[PROCESS] UNCAUGHT EXCEPTION", {
    error: error instanceof Error ? error.message : String(error),
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("[PROCESS] UNHANDLED REJECTION", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

const app = express();
const PORT = env.PORT;

// Import configurations
import { getCorsOptions } from "./config/cors.config";
import { redis as redisClient } from "./lib/redis";
import { basicAuth, sessionRefresh } from "./middleware/auth";
import { requireAdmin } from "./middleware/authorization";

// ===== REQUEST ID MIDDLEWARE =====
app.use((req, res, next) => {
  const requestId =
    (req.headers["x-request-id"] as string) || crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

// ===== TRUST PROXY =====
if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
  logger.info("[PROXY] Trust proxy enabled");
}

// Redis: Using singleton from lib/redis.ts (UNIFIED CONNECTION)
// Session store and all other consumers share the same Redis instance.

// ===== HELMET (Security Headers) =====
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    hsts:
      env.NODE_ENV === "production" && env.HSTS_ENABLED
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
  }),
);

// ===== HEALTH (mounted before CORS — Docker healthchecks send no Origin) =====
import healthRouter from "./routes/health";
app.use("/health", healthRouter);

// ===== CORS =====
app.use(cors(getCorsOptions()));

// ===== HTTP LIFECYCLE LOGGING =====
import { httpLogger } from "./middleware/http-logger";
app.use(httpLogger);

// ===== BODY PARSERS =====
// Reduced limits from 50mb for security
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files for mock downloads
app.use("/downloads", express.static(path.join(__dirname, "../downloads")));

// ===== SESSION =====
import session from "express-session";
import RedisStore from "connect-redis";

// ...

// ===== SESSION =====
// Using Redis Store for unlimited session size (fixes auth loop)
app.use(
  session({
    store: new RedisStore({
      client: redisClient,
      prefix: "dom:sess:",
    }),
    name: "dom-session",
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: env.COOKIE_SECURE, // Controlled by env
      sameSite: env.COOKIE_SAMESITE as "strict" | "lax" | "none",
    },
  }),
);

// ===== PUBLIC ROUTES =====
app.get("/", (req, res) => {
  res.send(
    '<h1>🚀 DOM BIM Platform API</h1><p>Status: Online</p><p>Check <a href="/health">/health</a> for status.</p>',
  );
});

// ===== DEBUG ROUTES (Protected with ADMIN) =====
if (env.ENABLE_DEBUG_ROUTES) {
  app.get("/debug/aps-config", basicAuth, requireAdmin, (req, res) => {
    logger.info("[AUDIT] Debug route accessed", {
      user: req.session?.user?.email,
    });
    res.json({
      hasClientId: !!env.APS_CLIENT_ID,
      hasClientSecret: !!env.APS_CLIENT_SECRET,
      callbackUrl: env.APS_CALLBACK_URL,
      clientIdPreview: env.APS_CLIENT_ID
        ? env.APS_CLIENT_ID.substring(0, 10) + "..."
        : "MISSING",
      bucket: env.APS_BUCKET,
    });
  });
}

// ===== ADMIN STATUS ROUTE =====
// Admin routes: Strict rate limiting with NO fallback
app.get(
  "/api/admin/status",
  rateLimiter.adminLimiter(),
  basicAuth,
  requireAdmin,
  (req, res) => {
    logger.info("[AUDIT] Admin status accessed", {
      user: req.session?.user?.email,
    });
    res.json({
      status: "ok",
      environment: env.NODE_ENV,
      adminEmailsConfigured: env.adminEmails.length,
      corsOriginsConfigured: env.corsOrigins.length,
      rateLimitStore: "redis", // Always Redis in new system
      trustProxy: env.TRUST_PROXY,
      hstsEnabled: env.HSTS_ENABLED,
      timestamp: new Date().toISOString(),
    });
  },
);

// ===== SESSION REFRESH (global) =====
// Transparently refreshes APS tokens approaching expiry.
// Never blocks unauthenticated requests — those pass through to route handlers.
app.use(sessionRefresh);

// ===== CORE ROUTES =====
// Auth routes: Strict rate limiting with NO fallback
app.use("/api/auth", rateLimiter.authLimiter(), authRouter);

app.use("/api/users", rateLimiter.apiLimiter(), usersRouter);

// Files: sync-status needs its own permissive limiter (polled frequently by frontend)
app.use("/api/files", rateLimiter.apiLimiter(), syncRoutes);
// Files: generic API limiter on all routes; strict upload limiter is applied
// at route level only for POST /api/files/upload.
app.use("/api/files", rateLimiter.apiLimiter(), filesRouter);

app.use("/api/projects", rateLimiter.apiLimiter(), projectsRouter);
app.use("/api/project-members", rateLimiter.apiLimiter(), projectMembersRouter);

// ===== SERVICE ROUTES =====
app.use(
  "/api/validation",
  rateLimiter.heavyOperationLimiter(),
  validationRouter,
);
app.use("/api/notifications", rateLimiter.apiLimiter(), notificationsRouter);
app.use("/api/reports", rateLimiter.heavyOperationLimiter(), reportsRouter);

// Conversion routes: Specific conversion limiter
app.use("/api/conversion", rateLimiter.conversionLimiter(), conversionRouter);
app.use("/api/translation", rateLimiter.apiLimiter(), translationRouter);

app.use("/api/viewer", rateLimiter.apiLimiter(), viewerRouter);
app.use("/api/dashboard", rateLimiter.apiLimiter(), dashboardRouter);

// APS routes: Derivatives limiter for specific routes
app.use("/api/aps", rateLimiter.derivativesLimiter(), apsRouter);

// Webhooks: Apply raw body capture BEFORE routes
import { captureRawBody } from "./middleware/raw-body.middleware";
app.use("/api/webhooks", captureRawBody);
app.use("/api/webhooks", rateLimiter.webhookLimiter(), webhooksRouter);

// Design Automation Callbacks (Hito 5)
app.use(
  "/api/callbacks",
  rateLimiter.apiLimiter(),
  designAutomationCallbackRouter,
);
app.use("/api/compliance-v2", rateLimiter.apiLimiter(), complianceV2Router);
app.use(
  "/api/compliance-v2/runs",
  rateLimiter.heavyOperationLimiter(),
  complianceRunsRouter,
);
app.use(
  "/api/compliance-v2/export",
  rateLimiter.apiLimiter(),
  complianceExportRouter,
);
app.use("/api/compliance-v3", rateLimiter.apiLimiter(), complianceV3Router);
app.use(
  "/api/data-sources",
  rateLimiter.heavyOperationLimiter(),
  dataSourcesRouter,
);
app.use("/api/workflows", rateLimiter.apiLimiter(), workflowsRouter);
app.use("/api/audit", rateLimiter.apiLimiter(), auditRouter);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// BullBoard — Queue monitoring UI
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queues as AppQueues } from "./lib/queue";

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [
    new BullMQAdapter(AppQueues.conversionMd),
    new BullMQAdapter(AppQueues.conversionDa),
    new BullMQAdapter(AppQueues.validation),
    new BullMQAdapter(AppQueues.apsWebhooks),
    new BullMQAdapter(AppQueues.designAutomationCallback),
  ],
  serverAdapter: bullBoardAdapter,
});
app.use("/admin/queues", basicAuth, bullBoardAdapter.getRouter());

// Error handling
import { errorHandler } from "./middleware/error-handler";
app.use(errorHandler);

import { modelDerivativeService } from "./services/aps/model-derivative.service";
import { createServer } from "http";
import { socketService } from "./lib/socket";

const httpServer = createServer(app);

// Start workers if enabled
if (env.RUN_WORKERS) {
  logger.info("[SERVER] Starting embedded workers...");
  import("./workers/conversion.worker"); // Workers auto-initialize on import
  import("./workers/webhook-worker");
  import("./workers/design-automation-callback.worker");
  import("./workers/validation.worker");
} else {
  logger.info(
    "[SERVER] Embedded worker disabled (RUN_WORKERS=false). Expecting dedicated worker process.",
  );
}

// Start server if run directly
if (require.main === module) {
  (async () => {
    try {
      // Initialize external transport (Sentry) — safe no-op if unconfigured
      const transportStatus = await initTransport();
      logger.info("[TRANSPORT] Status", { status: transportStatus });

      // Verify Redis connection BEFORE listening
      await redisClient.ping();
      logger.info("[REDIS] Connected and operational");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[REDIS] Connection failed", { error: msg });
      // Fail Fast in development
      if (env.NODE_ENV === "development") {
        logger.error("[REDIS] Redis is required in development. Exiting...");
        process.exit(1);
      }
      logger.warn(
        "[SERVER] Continuing without Redis — cache features will be disabled (Production Fallback)",
      );
    }

    httpServer.listen(PORT, async () => {
      logger.info("[SERVER] DOM BIM API running", {
        port: PORT,
        environment: env.NODE_ENV,
        workerMode: env.RUN_WORKERS ? "Embedded" : "Dedicated",
        trustProxy: env.TRUST_PROXY,
        hsts: env.HSTS_ENABLED,
      });

      // Initialize Socket.IO
      socketService.initialize(httpServer);
      logger.info("[SOCKET] Initialized");

      // Warm up formats cache on startup (Optional)
      if (env.APS_WARMUP_ON_START) {
        try {
          logger.debug("[APS] Pre-fetching supported formats...");
          await modelDerivativeService.getFormats();
          logger.info("[APS] Formats cache warmed up");
        } catch (error) {
          logger.warn(
            "[APS] Failed to warm up formats cache (will retry on demand)",
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    });
  })().catch((err) => {
    logger.error("[SERVER] Fatal Error during startup", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("[SERVER] SIGTERM received, shutting down gracefully...");
  try {
    await redisClient.quit();
    logger.info("[REDIS] Connection closed");
  } catch (error) {
    logger.error("[REDIS] Error closing connection", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("[SERVER] SIGINT received, shutting down gracefully...");
  try {
    await redisClient.quit();
    logger.info("[REDIS] Connection closed");
  } catch (error) {
    logger.error("[REDIS] Error closing connection", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  process.exit(0);
});

export default app;

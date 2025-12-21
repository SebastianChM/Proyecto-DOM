import express from "express";
import dashboardRouter from "./routes/dashboard";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
// import cookieSession from "cookie-session"; // Replaced by express-session
import crypto from "crypto";

import { rateLimiter } from "./config/rate-limit.config";

// Load and validate environment variables (Fail fast)
import { env } from "./config/env";
import path from "path";

// Routes
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import filesRouter from "./routes/files";
import projectsRouter from "./routes/projects";
import projectMembersRouter from "./routes/project-members";
import conversionRouter from "./routes/conversion";
import comparisonRouter from "./routes/comparison";
import apsProxyRouter from "./routes/aps-proxy";
import translationRouter from "./routes/translation";
import viewerRouter from "./routes/viewer";
import validationRouter from "./routes/validation";
import validationsRouter from "./routes/validations";
import notificationsRouter from "./routes/notifications";
import validationRunnerRouter from "./routes/validation-runner";
import reportsRouter from "./routes/reports";
import webhooksRouter from "./routes/webhooks";
import complianceRouter from "./routes/compliance";
import complianceV2Router from "./routes/compliance-rules";
import complianceRunsRouter from "./routes/compliance-runs";
import complianceExportRouter from "./routes/compliance-export";
import dataSourcesRouter from "./routes/data-sources";
import workflowsRouter from "./routes/workflows";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const app = express();
const PORT = env.PORT;

// Import configurations
import { getCorsOptions } from "./config/cors.config";
import { Redis } from "ioredis";
import { basicAuth } from "./middleware/auth";
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
  console.log("🔒 [PROXY] Trust proxy enabled");
}

// Redis Client Factory
let redisClient: Redis;
if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL);
} else {
  redisClient = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    family: 4, // Force IPv4
  });
}
export const redis = redisClient;

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

// ===== CORS =====
app.use(cors(getCorsOptions()));

// ===== LOGGING =====
app.use(morgan("dev"));

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

import healthRouter from "./routes/health";
app.use("/health", healthRouter);

// ===== DEBUG ROUTES (Protected with ADMIN) =====
if (env.ENABLE_DEBUG_ROUTES) {
  app.get("/debug/aps-config", basicAuth, requireAdmin, (req, res) => {
    // Audit log for debug route access
    console.log(
      `🔍 [AUDIT] Debug route accessed by ${req.session?.user?.email}`,
    );
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
    console.log(
      `🔍 [AUDIT] Admin status accessed by ${req.session?.user?.email}`,
    );
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

// ===== CORE ROUTES =====
// Auth routes: Strict rate limiting with NO fallback
app.use("/api/auth", rateLimiter.authLimiter(), authRouter);

app.use("/api/users", rateLimiter.apiLimiter(), usersRouter);

// Files: Upload limiter for POST, api limiter for GET
app.use("/api/files", rateLimiter.uploadLimiter(), filesRouter);

app.use("/api/projects", rateLimiter.apiLimiter(), projectsRouter);
app.use("/api/project-members", rateLimiter.apiLimiter(), projectMembersRouter);

// ===== SERVICE ROUTES =====
app.use(
  "/api/validation",
  rateLimiter.heavyOperationLimiter(),
  validationRouter,
);
app.use("/api/validations", rateLimiter.apiLimiter(), validationsRouter);
app.use("/api/notifications", rateLimiter.apiLimiter(), notificationsRouter);
app.use(
  "/api/validation-runner",
  rateLimiter.heavyOperationLimiter(),
  validationRunnerRouter,
);
app.use("/api/reports", rateLimiter.heavyOperationLimiter(), reportsRouter);

// Conversion routes: Specific conversion limiter
app.use("/api/conversion", rateLimiter.conversionLimiter(), conversionRouter);
app.use("/api/translation", rateLimiter.conversionLimiter(), translationRouter);

app.use("/api/viewer", rateLimiter.apiLimiter(), viewerRouter);
app.use(
  "/api/comparison",
  rateLimiter.heavyOperationLimiter(),
  comparisonRouter,
);
app.use("/api/dashboard", rateLimiter.apiLimiter(), dashboardRouter);

// APS routes: Derivatives limiter for specific routes
app.use("/api/aps", rateLimiter.derivativesLimiter(), apsProxyRouter);

app.use("/api/webhooks", rateLimiter.webhookLimiter(), webhooksRouter);
app.use(
  "/api/compliance",
  rateLimiter.heavyOperationLimiter(),
  complianceRouter,
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
app.use(
  "/api/data-sources",
  rateLimiter.heavyOperationLimiter(),
  dataSourcesRouter,
);
app.use("/api/workflows", rateLimiter.apiLimiter(), workflowsRouter);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling
import { errorHandler } from "./middleware/error-handler";
app.use(errorHandler);

import { modelDerivativeService } from "./services/aps/model-derivative.service";
import { createServer } from "http";
import { socketService } from "./lib/socket";
import { conversionWorker } from "./workers/conversion.worker";

const httpServer = createServer(app);

// Start the worker (Only if enabled)
if (env.RUN_WORKERS) {
  console.log("🔧 Starting embedded worker...");
  conversionWorker.start();
} else {
  console.log(
    "ℹ️  Embedded worker disabled (RUN_WORKERS=false). Expecting dedicated worker process.",
  );
}

// Start server if run directly
if (require.main === module) {
  (async () => {
    try {
      // Verify Redis connection BEFORE listening
      await redis.ping();
      console.log("✅ Redis: Connected and operational");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("❌ Redis: Connection failed -", msg);
      // Fail Fast in development
      if (env.NODE_ENV === "development") {
        console.error("🚨 Redis is required in development. Exiting...");
        process.exit(1);
      }
      console.warn(
        "⚠️ Server will continue but cache features will be disabled (Production Fallback)",
      );
    }

    httpServer.listen(PORT, async () => {
      console.log(`🚀 DOM BIM API running on port ${PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(
        `   Worker Mode: ${env.RUN_WORKERS ? "Embedded" : "Dedicated"}`,
      );
      console.log(`   Trust Proxy: ${env.TRUST_PROXY}`);
      console.log(`   HSTS: ${env.HSTS_ENABLED}`);

      // Initialize Socket.IO
      socketService.initialize(httpServer);
      console.log("   Socket.IO: Initialized");

      // Warm up formats cache on startup (Optional)
      if (env.APS_WARMUP_ON_START) {
        try {
          console.log("Pre-fetching supported formats from APS...");
          await modelDerivativeService.getFormats();
          console.log("Formats cache warmed up");
        } catch (error) {
          console.warn(
            "Failed to warm up formats cache (will retry on demand):",
            error,
          );
        }
      }
    });
  })().catch((err) => {
    console.error("❌ Fatal Error during startup:", err);
    process.exit(1);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  try {
    await redis.quit();
    console.log("Redis connection closed");
  } catch (error) {
    console.error("Error closing Redis:", error);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  try {
    await redis.quit();
    console.log("Redis connection closed");
  } catch (error) {
    console.error("Error closing Redis:", error);
  }
  process.exit(0);
});

export default app;

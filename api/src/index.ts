import express from "express";
import dashboardRouter from "./routes/dashboard";
import cors from "cors";

import helmet from "helmet";

import morgan from "morgan";
import cookieSession from "cookie-session";
import { rateLimiter } from "./services/rate-limiter.service";

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
import reportsRouter from "./routes/reports"; // Import Reports Router
import webhooksRouter from "./routes/webhooks"; // Import Webhooks Router
import complianceRouter from "./routes/compliance"; // Compliance Engine
import complianceV2Router from "./routes/compliance-rules"; // Compliance Engine V2 - Professional Rules
import complianceRunsRouter from "./routes/compliance-runs"; // Compliance Runs V2
import complianceExportRouter from "./routes/compliance-export"; // Compliance Export
import dataSourcesRouter from "./routes/data-sources"; // Data Extraction for Compliance
import workflowsRouter from "./routes/workflows"; // Workflow Engine
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

const app = express();
const PORT = env.PORT;

// Import configurations
import { getCorsOptions } from "./config/cors.config";
import { Redis } from "ioredis";

// Redis Client Factory
let redisClient: Redis;
if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL);
} else {
  redisClient = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });
}
export const redis = redisClient;

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin resource sharing for downloads
  }),
);
app.use(cors(getCorsOptions()));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files for mock downloads
app.use("/downloads", express.static(path.join(__dirname, "../downloads")));

// Session
app.use(
  cookieSession({
    name: "dom-session",
    keys: [env.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }),
);

// Public routes (no auth required)
app.get("/", (req, res) => {
  res.send(
    '<h1>🚀 DOM BIM Platform API</h1><p>Status: Online</p><p>Check <a href="/health">/health</a> for status.</p>',
  );
});

import healthRouter from "./routes/health";
app.use("/health", healthRouter);

// Debug endpoint - verificar configuración APS (Protected)
if (env.ENABLE_DEBUG_ROUTES) {
  app.get("/debug/aps-config", (req, res) => {
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
// Core Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use(
  "/api/files",
  rateLimiter.uploadLimiter
    ? rateLimiter.uploadLimiter()
    : rateLimiter.apiLimiter(),
  filesRouter,
); // Use upload limiter if available
app.use("/api/projects", rateLimiter.apiLimiter(), projectsRouter);
app.use("/api/project-members", rateLimiter.apiLimiter(), projectMembersRouter);

// Service Routes
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
app.use(
  "/api/conversion",
  rateLimiter.heavyOperationLimiter(),
  conversionRouter,
);
app.use(
  "/api/translation",
  rateLimiter.heavyOperationLimiter(),
  translationRouter,
);
app.use("/api/viewer", rateLimiter.apiLimiter(), viewerRouter);
app.use(
  "/api/comparison",
  rateLimiter.heavyOperationLimiter(),
  comparisonRouter,
);
app.use("/api/dashboard", rateLimiter.apiLimiter(), dashboardRouter);
app.use("/api/aps", apsProxyRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/compliance", complianceRouter);
app.use("/api/compliance-v2", rateLimiter.apiLimiter(), complianceV2Router); // Professional Rule-Based Validation
app.use(
  "/api/compliance-v2/runs",
  rateLimiter.heavyOperationLimiter(),
  complianceRunsRouter,
); // Compliance Runs
app.use(
  "/api/compliance-v2/export",
  rateLimiter.apiLimiter(),
  complianceExportRouter,
); // Compliance Export
app.use(
  "/api/data-sources",
  rateLimiter.heavyOperationLimiter(),
  dataSourcesRouter,
); // Data Extraction
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

// Start the worker (Only if enabled, otherwise dedicated worker process handles it)
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
    } catch (error: any) {
      console.error("❌ Redis: Connection failed -", error.message);
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

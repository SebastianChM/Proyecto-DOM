import { Router } from "express";
import prisma from "../lib/prisma";
import { redis } from "../lib/redis";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
    services: {
      database: "unknown",
      redis: "unknown",
    },
    env: env.NODE_ENV,
  };

  let status = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = "up";
  } catch {
    health.services.database = "down";
    status = 503;
    // Sanitized log - no connection strings or sensitive details
    logger.error("[HEALTH] Database check failed", {
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
    });
  }

  try {
    await redis.ping();
    health.services.redis = "up";
  } catch {
    health.services.redis = "down";
    status = 503;
    // Sanitized log - no connection strings or sensitive details
    logger.error("[HEALTH] Redis check failed", {
      timestamp: new Date().toISOString(),
      requestId: req.headers["x-request-id"],
    });
  }

  // Return 503 if any critical service is down
  res.status(status).json(health);
});

export default router;

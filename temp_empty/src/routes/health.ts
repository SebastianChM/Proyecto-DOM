import { Router } from "express";
import prisma from "../lib/prisma";
import { redis } from "../lib/redis";
import { env } from "../config/env";

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
  } catch (e: unknown) {
    health.services.database = "down";
    status = 503;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Health Check DB Failed:", msg);
  }

  try {
    await redis.ping();
    health.services.redis = "up";
  } catch (e: unknown) {
    health.services.redis = "down";
    status = 503;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Health Check Redis Failed:", msg);
  }

  // Return 503 if any critical service is down
  res.status(status).json(health);
});

export default router;

import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { modelDerivativeService } from "../services/aps/model-derivative.service";
import { apsAuthService } from "../services/aps/auth.service";
import { apsDataManagementService } from "../services/aps/data-management.service";
import { env } from "../config/env";

const router = Router();

/**
 * Webhook Secret Validation Middleware
 * Uses timing-safe comparison to prevent timing attacks
 */
function validateWebhookSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secret = req.headers["x-webhook-secret"] as string;

  // Skip validation ONLY if explicit flag is set (for local testing)
  if (env.SKIP_WEBHOOK_VALIDATION) {
    if (env.NODE_ENV === "production") {
      console.error(
        "🚨 [WEBHOOK] SKIP_WEBHOOK_VALIDATION=true in production is FORBIDDEN!",
      );
      return res.status(500).json({ error: "Security misconfiguration" });
    }
    console.warn(
      "⚠️ [WEBHOOK] Secret validation SKIPPED (SKIP_WEBHOOK_VALIDATION=true)",
    );
    return next();
  }

  // Require secret in all environments (no automatic bypass)
  if (!env.WEBHOOK_SECRET || env.WEBHOOK_SECRET.length < 16) {
    console.error(
      "🚨 [WEBHOOK] WEBHOOK_SECRET not configured or too short (min 16 chars)",
    );
    return res.status(500).json({ error: "Webhook configuration error" });
  }

  if (!secret) {
    console.warn("🚫 [WEBHOOK] Missing X-Webhook-Secret header", {
      path: req.path,
      ip: req.ip,
      requestId: req.headers["x-request-id"],
      timestamp: new Date().toISOString(),
    });
    return res.status(401).json({ error: "Webhook secret required" });
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const secretBuffer = Buffer.from(env.WEBHOOK_SECRET);
    const providedBuffer = Buffer.from(secret);

    if (
      secretBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(secretBuffer, providedBuffer)
    ) {
      console.warn("🚫 [WEBHOOK] Invalid secret provided", {
        path: req.path,
        ip: req.ip,
        requestId: req.headers["x-request-id"],
        timestamp: new Date().toISOString(),
      });
      return res.status(403).json({ error: "Invalid webhook secret" });
    }
  } catch {
    console.warn("🚫 [WEBHOOK] Secret comparison failed", {
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return res.status(403).json({ error: "Invalid webhook secret" });
  }

  next();
}

// Apply secret validation to all webhook routes
router.use(validateWebhookSecret);

/**
 * Handle Design Automation Callbacks
 * POST /api/webhooks/aps/callback
 */
router.post("/aps/callback", async (req, res) => {
  try {
    console.log("📨 Received APS Webhook Callback");

    // Log receipt without exposing full payload
    const payload = req.body;
    console.log("📦 Webhook received:", {
      id: payload?.id,
      status: payload?.status,
      hasPayload: !!payload,
    });

    // Validate payload structure
    if (!payload || !payload.id || !payload.status) {
      console.warn("⚠️ Invalid webhook payload received");
      return res.status(400).json({ error: "Invalid payload" });
    }

    const workItemId = payload.id;
    const status = payload.status;

    console.log(
      `🔄 Processing callback for WorkItem: ${workItemId}, Status: ${status}`,
    );

    // Find the conversion associated with this work item
    const conversion = await prisma.conversion.findFirst({
      where: {
        resultUrn: {
          contains: `da-workitem:${workItemId}`,
        },
      },
    });

    if (!conversion) {
      console.warn(`⚠️ No conversion found for WorkItem ID: ${workItemId}`);
      return res
        .status(200)
        .json({ message: "Conversion not tracked or already deleted" });
    }

    console.log(
      `✅ Found conversion ${conversion.id} for WorkItem ${workItemId}`,
    );

    if (status === "success") {
      console.log(`🎉 Design Automation job completed successfully`);

      const parts = conversion.resultUrn?.split(":");
      const outputObjectKey = parts && parts.length >= 3 ? parts[2] : null;

      if (outputObjectKey) {
        const bucketKey = env.APS_BUCKET;

        await prisma.conversion.update({
          where: { id: conversion.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            resultUrn: `oss:${bucketKey}/${outputObjectKey}`,
            resultUrl: `/api/conversion/${conversion.id}/download`,
          },
        });
        console.log(`✅ Conversion ${conversion.id} updated to COMPLETED`);
      } else {
        console.error(
          `❌ Could not parse output key from stored URN: ${conversion.resultUrn}`,
        );
        await prisma.conversion.update({
          where: { id: conversion.id },
          data: { status: "FAILED" },
        });
      }
    } else if (status === "failed" || status === "cancelled") {
      console.error(`❌ Design Automation job failed or cancelled`);
      await prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: "FAILED" },
      });
    } else {
      console.log(`ℹ️ Received update for status: ${status} (No action taken)`);
    }

    res.status(200).json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error processing webhook:", msg);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Handle Data Management Webhooks (dm.version.added)
 * POST /api/webhooks/aps/data/callback
 */
router.post("/aps/data/callback", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📨 Received APS Data Management Webhook");

    // Initial Validation - don't log full payload
    if (!payload || !payload.hook || !payload.payload) {
      return res.status(200).end();
    }

    const eventType = payload.hook.event;
    const eventPayload = payload.payload;

    if (eventType === "dm.version.added") {
      console.log(
        `🆕 New Version Detected! Project: ${eventPayload.project}, Resource: ${eventPayload.resourceUrn?.substring(0, 20)}...`,
      );

      const projectId = eventPayload.project;
      const versionId = eventPayload.version;
      const urn = eventPayload.resourceUrn;

      const localProjectId = payload.hook.scope?.workflowAttribute?.projectId;
      const uploaderId = payload.hook.scope?.workflowAttribute?.userId;

      if (!localProjectId) {
        console.warn(
          "⚠️ Received webhook without local projectId map. Ignoring.",
        );
        return res.status(200).end();
      }

      let fileName = `Autodesk File ${versionId.substring(0, 8)}`;
      let fileType = "RVT";
      let fileSize = 0;

      try {
        const internalToken = await apsAuthService.getInternalToken();
        if (internalToken) {
          const versionDetails = await apsDataManagementService.getVersion(
            projectId,
            versionId,
            internalToken,
          );
          if (versionDetails) {
            fileName =
              versionDetails.name || versionDetails.fileName || fileName;
            if (fileName.includes(".")) {
              const ext = fileName.split(".").pop();
              if (ext) fileType = ext.toUpperCase();
            }
            fileSize = versionDetails.storageSize || 0;
            console.log(`📄 Fetched metadata: ${fileName} (${fileSize} bytes)`);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          "⚠️ Failed to fetch detailed version info, using placeholders:",
          msg,
        );
      }

      const existingFile = await prisma.file.findFirst({
        where: { apsUrn: urn },
      });

      if (existingFile) {
        console.log(`ℹ️ File version already exists: ${existingFile.name}`);
      } else {
        console.log(
          `📝 Registering new file version in Project ${localProjectId}`,
        );

        await prisma.file.create({
          data: {
            name: fileName,
            originalName: fileName,
            type: fileType,
            size: fileSize,
            apsUrn: urn,
            status: "UPLOADED",
            projectId: localProjectId,
            origin: "ACC",
            uploadedBy: uploaderId,
          },
        });

        console.log(`🔄 Triggering translation for new version...`);
        try {
          await modelDerivativeService.translateToSVF2(urn);

          await prisma.file.updateMany({
            where: { apsUrn: urn },
            data: { status: "TRANSLATING" },
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("❌ Failed to auto-trigger translation:", msg);
        }
      }
    }

    res.status(200).end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Error processing Data webhook:", msg);
    res.status(500).end();
  }
});

export default router;

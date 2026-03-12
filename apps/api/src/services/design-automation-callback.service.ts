import prisma from "../lib/prisma";
import { Queues } from "../lib/queue";
import { logger } from "../lib/logger";
import { env } from "../config/env";

export interface DesignAutomationCallbackPayload {
  workItemId: string;
  status: string;
  reportUrl?: string;
}

export class DesignAutomationCallbackError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DesignAutomationCallbackError";
  }
}

const DA_CALLBACK_PATH = "/api/callbacks/design-automation/callback";

export function resolveDesignAutomationCallbackUrl(): string | null {
  const candidates = [env.APS_WEBHOOK_URL, env.APS_CALLBACK_URL].filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      return `${parsed.origin}${DA_CALLBACK_PATH}`;
    } catch {
      // Ignore invalid URL candidates and continue.
    }
  }

  return null;
}

export function normalizeDesignAutomationCallbackPayload(
  rawPayload: Record<string, unknown>,
): DesignAutomationCallbackPayload {
  const workItemId = String(rawPayload.workItemId ?? rawPayload.id ?? "").trim();
  const status = String(rawPayload.status ?? "").trim();
  const reportUrl = rawPayload.reportUrl
    ? String(rawPayload.reportUrl)
    : undefined;

  if (!workItemId || !status) {
    throw new DesignAutomationCallbackError(
      "Invalid payload: workItemId and status required",
      400,
      "INVALID_PAYLOAD",
    );
  }

  return { workItemId, status, reportUrl };
}

export async function enqueueDesignAutomationCallback(
  callback: DesignAutomationCallbackPayload,
  requestMeta: Record<string, unknown>,
): Promise<{
  conversionId: string;
  duplicate: boolean;
  dedupeKey: string;
}> {
  const normalizedStatus = callback.status.toLowerCase();

  // CRITICAL: Exact match ONLY (no substring search)
  const conversion = await prisma.conversion.findFirst({
    where: { workItemId: callback.workItemId },
  });

  if (!conversion) {
    throw new DesignAutomationCallbackError(
      "Conversion not found for workItemId",
      404,
      "CONVERSION_NOT_FOUND",
    );
  }

  const dedupeKey = `DA:${callback.workItemId}:${normalizedStatus}`;

  const existingDelivery = await prisma.conversion.findFirst({
    where: { dedupeKey },
  });

  if (existingDelivery) {
    logger.debug("[DA_CALLBACK] Duplicate callback detected", {
      ...requestMeta,
      conversionId: existingDelivery.id,
      dedupeKey,
    });

    return {
      conversionId: existingDelivery.id,
      duplicate: true,
      dedupeKey,
    };
  }

  await prisma.conversion.update({
    where: { id: conversion.id },
    data: { dedupeKey },
  });

  await Queues.designAutomationCallback.add("process-da-callback", {
    conversionId: conversion.id,
    workItemId: callback.workItemId,
    status: normalizedStatus,
    reportUrl: callback.reportUrl,
  });

  return {
    conversionId: conversion.id,
    duplicate: false,
    dedupeKey,
  };
}

export async function processDesignAutomationCallbackJob(data: {
  conversionId: string;
  workItemId: string;
  status: string;
  reportUrl?: string;
}) {
  const { conversionId, status, reportUrl } = data;
  const normalizedStatus = status.toLowerCase();

  const conversion = await prisma.conversion.findUnique({
    where: { id: conversionId },
  });

  if (!conversion) {
    logger.error("[DA_CALLBACK_WORKER] Conversion not found", {
      conversionId,
      workItemId: data.workItemId,
    });
    return { success: false, error: "Conversion not found" };
  }

  if (normalizedStatus === "completed" || normalizedStatus === "success") {
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        completedAt: new Date(),
        resultUrl: reportUrl || conversion.resultUrl,
        lastError: null,
      },
    });

    logger.info("[DA_CALLBACK_WORKER] Conversion completed", {
      conversionId,
      workItemId: data.workItemId,
      hasReportUrl: !!reportUrl,
    });

    return { success: true, status: "COMPLETED" };
  }

  if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
    await prisma.conversion.update({
      where: { id: conversionId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        completedAt: new Date(),
        lastError: `DA work item ${normalizedStatus}`,
      },
    });

    logger.warn("[DA_CALLBACK_WORKER] Conversion failed", {
      conversionId,
      workItemId: data.workItemId,
      status: normalizedStatus,
    });

    return { success: false, status: "FAILED" };
  }

  logger.debug("[DA_CALLBACK_WORKER] Non-terminal callback status", {
    conversionId,
    workItemId: data.workItemId,
    status: normalizedStatus,
  });

  return { success: true, status: "PROCESSING" };
}

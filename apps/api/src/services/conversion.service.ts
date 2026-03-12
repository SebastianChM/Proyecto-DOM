/**
 * Conversion Service
 *
 * Centralizes all business logic for file conversions:
 * - Single & Batch creation
 * - Status checking
 * - Download logic (OSS vs Model Derivative vs Local)
 * - Save to Project logic
 *
 * Replaces fragmented logic in:
 * - routes/conversion/batch.routes.ts
 * - routes/conversion/single.routes.ts
 * - routes/conversion/status.routes.ts
 */

import prisma from "../lib/prisma";
import { modelDerivativeService } from "./aps/model-derivative.service";
import { apsOssService } from "./aps/oss.service";
import { Queues, ConversionJobData } from "../lib/queue";
import axios from "axios";
import archiver from "archiver";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { logger } from "../lib/logger";

// Supported formats
const SUPPORTED_CONVERSIONS = {
  modelDerivative: {
    toPdf: ["dwg", "dxf"],
    toIfc: ["rvt", "nwc", "nwd", "ifc"],
  },
  designAutomation: {
    toPdf: ["rvt"],
  },
};

export class ConversionService {
  /**
   * Expose supported conversions as source-extension -> target formats.
   * This contract is consumed by the frontend capability checks.
   */
  getSupportedFormats(): Record<string, string[]> {
    const formats: Record<string, Set<string>> = {};

    const add = (sourceExt: string, targetFormat: string) => {
      if (!formats[sourceExt]) formats[sourceExt] = new Set<string>();
      formats[sourceExt].add(targetFormat);
    };

    for (const ext of SUPPORTED_CONVERSIONS.modelDerivative.toPdf) {
      add(ext, "pdf");
    }
    for (const ext of SUPPORTED_CONVERSIONS.designAutomation.toPdf) {
      add(ext, "pdf");
    }
    for (const ext of SUPPORTED_CONVERSIONS.modelDerivative.toIfc) {
      add(ext, "ifc");
    }

    return Object.fromEntries(
      Object.entries(formats).map(([ext, targets]) => [
        ext,
        Array.from(targets).sort(),
      ]),
    );
  }
  /**
   * Determine the best conversion method based on file extension and target format
   */
  getConversionMethod(
    fileExtension: string,
    targetFormat: string,
  ): "modelDerivative" | "designAutomation" | null {
    const ext = fileExtension.toLowerCase();
    const format = targetFormat.toLowerCase();

    if (format === "pdf") {
      if (SUPPORTED_CONVERSIONS.modelDerivative.toPdf.includes(ext)) {
        return "modelDerivative";
      }
      if (SUPPORTED_CONVERSIONS.designAutomation.toPdf.includes(ext)) {
        return "designAutomation";
      }
    }
    if (format === "ifc") {
      if (SUPPORTED_CONVERSIONS.modelDerivative.toIfc.includes(ext)) {
        return "modelDerivative";
      }
    }
    return null;
  }

  /**
   * Create a batch of conversions
   */
  async createBatch(userId: string, fileIds: string[], format: string) {
    // Create batch record
    const batch = await prisma.conversionBatch.create({
      data: {
        userId,
        totalCount: fileIds.length,
      },
    });

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
    });

    const conversions: string[] = [];
    const errors: { fileId: string; error: string }[] = [];

    for (const file of files) {
      try {
        const fileExtension = file.name.split(".").pop() || "";
        const method = this.getConversionMethod(fileExtension, format);

        if (!method) {
          errors.push({
            fileId: file.id,
            error: `Conversión no soportada para ${fileExtension}`,
          });
          continue;
        }

        if (!file.apsUrn || file.apsUrn === "UPLOADING") {
          errors.push({
            fileId: file.id,
            error: "Archivo aún subiendo",
          });
          continue;
        }

        const conversion = await prisma.conversion.create({
          data: {
            fileId: file.id,
            batchId: batch.id,
            targetFormat: format.toLowerCase(),
            method: method,
            status: "PENDING",
          },
        });

        conversions.push(conversion.id);

        // Enqueue job immediately
        const queue =
          method === "designAutomation"
            ? Queues.conversionDa
            : Queues.conversionMd;

        await queue.add("convert", {
          conversionId: conversion.id,
          batchId: batch.id,
          userId,
          method,
          targetFormat: format.toLowerCase(),
          priority: 5,
        } as ConversionJobData);

        // Update status to QUEUED
        await prisma.conversion.update({
          where: { id: conversion.id },
          data: { status: "QUEUED", queuedAt: new Date() },
        });
      } catch (error) {
        errors.push({
          fileId: file.id,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    return {
      batchId: batch.id,
      enqueued: conversions.length,
      failed: errors.length,
      errors,
    };
  }

  /**
   * Start a single file conversion
   */
  async createSingle(userId: string, fileId: string, format: string) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error("File not found");

    const fileExtension = file.name.split(".").pop() || "";
    const method = this.getConversionMethod(fileExtension, format);

    if (!method)
      throw new Error(`Conversión no soportada para ${fileExtension}`);

    // Check concurrency limits
    const activeCount = await prisma.conversion.count({
      where: {
        file: { uploadedBy: userId },
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (activeCount >= 50) throw new Error("Too many active conversions");

    // Deduplication check
    const existing = await prisma.conversion.findFirst({
      where: {
        fileId,
        targetFormat: format,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (existing) return existing;

    const conversion = await prisma.conversion.create({
      data: {
        fileId,
        targetFormat: format,
        method: method,
        status: "PENDING",
      },
    });

    // Handle Local Mock Mode
    if (file.apsUrn?.startsWith("local-")) {
      await this.mockLocalConversion(conversion.id, format);
      return conversion;
    }

    // Enqueue
    const queue =
      method === "designAutomation" ? Queues.conversionDa : Queues.conversionMd;

    await queue.add("convert", {
      conversionId: conversion.id,
      userId,
      method,
      targetFormat: format,
      priority: 10, // Higher priority for single
    } as ConversionJobData);

    return conversion;
  }

  /**
   * Helper for local mock conversions
   */
  private async mockLocalConversion(conversionId: string, format: string) {
    await prisma.conversion.update({
      where: { id: conversionId },
      data: { status: "PROCESSING" },
    });

    setTimeout(async () => {
      await prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          resultUrn: `local-mock-${format}`,
          resultUrl: `/api/conversion/${conversionId}/download`,
        },
      });
    }, 1000);
  }

  /**
   * Get download info (Stream or Buffer) for a completed conversion
   * Unifies logic for OSS, ModelDerivatives, and Local files
   */
  async getDownloadData(conversionId: string) {
    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: { file: true },
    });

    if (!conversion || !conversion.resultUrn) {
      throw new Error("Conversion result not found");
    }

    // 1. Local Mode
    if (conversion.resultUrn.startsWith("local-mock-")) {
      const localPath = path.resolve(
        process.cwd(),
        "downloads",
        `mock-result.${conversion.targetFormat}`,
      );
      if (!fs.existsSync(localPath)) throw new Error("Local mock file missing");

      return {
        stream: fs.createReadStream(localPath),
        filename: `${conversion.file.name}.${conversion.targetFormat}`,
        contentType:
          conversion.targetFormat === "pdf"
            ? "application/pdf"
            : "application/octet-stream",
        length: fs.statSync(localPath).size,
      };
    }

    // 2. OSS (Design Automation)
    if (conversion.resultUrn.startsWith("oss:")) {
      const [, bucketAndKey] = conversion.resultUrn.split("oss:");
      const [, ...keyParts] = bucketAndKey.split("/");
      const objectKey = keyParts.join("/");

      const signedUrl = await apsOssService.getSignedUrl(objectKey);
      if (!signedUrl) throw new Error("Could not generate signed URL");

      const response = await axios.get(signedUrl, { responseType: "stream" });
      return {
        stream: response.data as Readable,
        filename: `${conversion.file.name}.${conversion.targetFormat}`,
        contentType: "application/pdf", // Mostly PDF for DA
        length: parseInt(response.headers["content-length"] || "0"),
      };
    }

    // 3. Model Derivative
    const { url, headers } =
      await modelDerivativeService.getDerivativeDownloadInfo(
        conversion.file.apsUrn!,
        conversion.resultUrn,
      );

    // We fetch as stream to be memory efficient
    const response = await axios.get(url, { headers, responseType: "stream" });

    return {
      stream: response.data as Readable,
      filename: `${conversion.file.name}.${conversion.targetFormat}`,
      contentType: "application/octet-stream",
      length: parseInt(response.headers["content-length"] || "0"),
    };
  }

  /**
   * Save a conversion result back to the project as a new File
   */
  async saveToProject(conversionId: string) {
    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: { file: true },
    });

    if (!conversion || !conversion.resultUrn)
      throw new Error("Result not found");

    const newFilename = `${conversion.file.name.replace(/\.[^/.]+$/, "")}.${conversion.targetFormat}`;

    // We need buffer for upload to OSS (server-side copy is complex to abstract here, sticking to reliable upload)
    // For optimization, we can implement server-side copy special case here later.

    // Get data using our own helper (stream)
    const download = await this.getDownloadData(conversionId);

    // Convert stream to buffer for upload (OSS service expects buffer currently)
    // TODO: Refactor OSS Service to accept Streams for better performance
    const chunks: Buffer[] = [];
    for await (const chunk of download.stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const uploaded = await apsOssService.uploadBuffer(buffer, newFilename);

    if (!uploaded) throw new Error("Upload failed");

    const urn = uploaded.objectId
      ? apsOssService.getDerivativeUrn(uploaded.objectId)
      : `local-${Date.now()}`;

    const newFile = await prisma.file.create({
      data: {
        name: newFilename,
        originalName: newFilename,
        size: buffer.length,
        type: conversion.targetFormat === "pdf" ? "PDF" : "OTHER",
        apsUrn: urn,
        s3Key: uploaded.objectKey || newFilename,
        projectId: conversion.file.projectId,
        uploadedBy: conversion.file.uploadedBy,
        status: "UPLOADED",
      },
    });

    // Translate for viewing if needed
    if (newFile.apsUrn && !newFile.apsUrn.startsWith("local-")) {
      modelDerivativeService
        .translateToSVF2(newFile.apsUrn)
        .catch((err: unknown) => {
          logger.error("[CONVERSION] SVF2 translation failed", {
            error: err instanceof Error ? err.message : String(err),
            fileId: newFile.id,
          });
        });
    }

    return newFile;
  }

  async getConversionStatus(conversionId: string) {
    const conversion = await prisma.conversion.findUnique({
      where: { id: conversionId },
      include: { file: true },
    });
    return conversion;
  }

  async getBatchDownloadArchive(batchId: string) {
    const batch = await prisma.conversionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error("BATCH_NOT_FOUND");
    }

    const completedConversions = await prisma.conversion.findMany({
      where: {
        batchId,
        status: "COMPLETED",
      },
      include: {
        file: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (completedConversions.length === 0) {
      throw new Error("BATCH_DOWNLOAD_NOT_READY");
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const usedNames = new Map<string, number>();

    for (const conversion of completedConversions) {
      try {
        const { stream, filename } = await this.getDownloadData(conversion.id);
        const safeName = filename.replace(/[/:*?"<>|]/g, "_");

        const currentCount = usedNames.get(safeName) ?? 0;
        usedNames.set(safeName, currentCount + 1);

        const parsed = path.parse(safeName);
        const uniqueName =
          currentCount === 0
            ? safeName
            : `${parsed.name}-${currentCount}${parsed.ext}`;

        archive.append(stream, { name: uniqueName });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        logger.warn("[CONVERSION] Failed to include conversion in batch archive", {
          batchId,
          conversionId: conversion.id,
          error: message,
        });

        archive.append(
          `Conversion ${conversion.id} could not be downloaded: ${message}\n`,
          {
            name: `errors/${conversion.id}.txt`,
          },
        );
      }
    }

    const archiveFilename = `conversion-batch-${batchId.slice(0, 8)}.zip`;

    return {
      archive,
      filename: archiveFilename,
    };
  }

  async getBatchStatus(batchId: string) {
    const batch = await prisma.conversionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) throw new Error("Batch not found");

    // Calculate aggregated counts
    const statusCounts = await prisma.conversion.groupBy({
      by: ["status"],
      where: { batchId },
      _count: true,
    });

    const counts = statusCounts.reduce(
      (acc, item) => {
        acc[item.status.toLowerCase()] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Get failures info
    const failures = await prisma.conversion.findMany({
      where: { batchId, status: "FAILED" },
      select: {
        file: { select: { name: true } },
        lastError: true,
      },
      take: 100,
    });

    const pending = counts.pending || 0;
    const queued = counts.queued || 0;
    const processing = counts.processing || 0;
    const completed = counts.completed || 0;
    const failed = counts.failed || 0;

    const summary = {
      pending: pending + queued,
      processing,
      completed,
      failed,
      queued,
    };

    const finalised = summary.completed + summary.failed;
    const progress =
      batch.totalCount > 0
        ? Math.round((finalised / batch.totalCount) * 100)
        : 0;

    const status =
      finalised >= batch.totalCount
        ? summary.failed > 0 && summary.completed === 0
          ? "failed"
          : "completed"
        : summary.processing > 0 || summary.pending > 0
          ? "processing"
          : "pending";

    const errors = failures.map((f) => ({
      fileName: f.file.name,
      error: f.lastError?.substring(0, 200),
    }));

    const downloadUrl =
      status !== "processing" && summary.completed > 0
        ? "/api/conversion/batch/" + batchId + "/download"
        : undefined;

    return {
      batchId,
      status,
      summary,
      progress,
      errors,
      downloadUrl,
      zipUrl: downloadUrl,
      // Backward-compatible aliases for existing internal consumers
      total: batch.totalCount,
      counts: {
        pending: summary.pending,
        queued: summary.queued,
        processing: summary.processing,
        completed: summary.completed,
        failed: summary.failed,
      },
      failures: errors,
    };
  }
}

export const conversionService = new ConversionService();

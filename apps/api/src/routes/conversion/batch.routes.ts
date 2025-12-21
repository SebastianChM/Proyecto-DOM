/**
 * Conversion Module - Batch Routes
 *
 * Endpoints for batch file conversions
 */

import { Router, Request, Response } from "express";
import archiver from "archiver";
import {
  prisma,
  modelDerivativeService,
  apsOssService,
  axios,
  // BUCKET_KEY,
  activeBatches,
  cleanupOldBatches,
  // BatchInfo,
  withRetry,
  getConversionMethod,
} from "./helpers";

const router = Router();

/**
 * POST /batch
 * Create batch conversion - launches all conversions in parallel
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { fileIds, format } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: "fileIds array is required" });
    }

    if (!format || !["pdf", "ifc"].includes(format)) {
      return res.status(400).json({ error: "format must be pdf or ifc" });
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const conversions: {
      fileId: string;
      conversionId: string;
      fileName: string;
    }[] = [];
    const errors: { fileId: string; error: string }[] = [];

    // Fetch all files first
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
    });

    // Launch all conversions in parallel
    const conversionPromises = files.map(async (file) => {
      try {
        const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";

        // Check conversion method based on Autodesk documentation
        const conversionMethod = getConversionMethod(fileExtension, format);

        if (!conversionMethod) {
          return {
            fileId: file.id,
            error: `Conversión de ${fileExtension.toUpperCase()} a ${format.toUpperCase()} no soportada.`,
          };
        }

        // Design Automation not implemented in batch yet
        if (conversionMethod === "designAutomation") {
          return {
            fileId: file.id,
            error: `Archivos ${fileExtension.toUpperCase()} requieren Design Automation. Use conversión individual.`,
          };
        }

        if (!file.apsUrn || file.apsUrn === "UPLOADING") {
          return {
            fileId: file.id,
            error:
              "El archivo aún se está subiendo. Por favor espera unos segundos e intenta nuevamente.",
          };
        }

        const conversion = await prisma.conversion.create({
          data: {
            fileId: file.id,
            targetFormat: format,
            status: "PENDING",
          },
        });

        // Trigger the conversion with retry logic for 429 handling
        if (format === "ifc") {
          await withRetry(async () => {
            await modelDerivativeService.translateToIFC(file.apsUrn!);
            await prisma.conversion.update({
              where: { id: conversion.id },
              data: { status: "PROCESSING" },
            });
          }).catch((translateError: unknown) => {
            const err = translateError as { response?: { status: number } };
            // 409 means already in progress - that's OK
            if (err.response?.status !== 409) {
              throw translateError;
            }
          });
        } else if (format === "pdf") {
          await withRetry(async () => {
            await modelDerivativeService.translateToPDF(file.apsUrn!);
            await prisma.conversion.update({
              where: { id: conversion.id },
              data: { status: "PROCESSING" },
            });
          }).catch((translateError: unknown) => {
            const err = translateError as { response?: { status: number } };
            if (err.response?.status !== 409) {
              throw translateError;
            }
          });
        }

        return {
          fileId: file.id,
          conversionId: conversion.id,
          fileName: file.name,
        };
      } catch (error: unknown) {
        const err = error as { message?: string };
        return {
          fileId: file.id,
          error: err.message || "Failed to start conversion",
        };
      }
    });

    const results = await Promise.all(conversionPromises);

    results.forEach((result) => {
      if ("conversionId" in result) {
        conversions.push(
          result as { fileId: string; conversionId: string; fileName: string },
        );
      } else if ("error" in result) {
        errors.push(result as { fileId: string; error: string });
      }
    });

    // Store batch info
    activeBatches.set(batchId, {
      id: batchId,
      format,
      conversions,
      createdAt: new Date(),
      status: "processing",
    });

    cleanupOldBatches();

    console.log(
      `📦 Batch ${batchId} created with ${conversions.length} conversions, ${errors.length} errors`,
    );

    res.json({
      batchId,
      totalRequested: fileIds.length,
      started: conversions.length,
      failed: errors.length,
      conversions,
      errors,
      status: "processing",
    });
  } catch (error: unknown) {
    console.error("Batch conversion error:", error);
    res.status(500).json({
      error: "Failed to create batch conversion",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /batch/:batchId
 * Get batch status
 */
router.get("/:batchId", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = activeBatches.get(batchId);

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    // Check status of all conversions
    const conversionIds = batch.conversions.map((c) => c.conversionId);
    const conversions = await prisma.conversion.findMany({
      where: { id: { in: conversionIds } },
      include: { file: { select: { name: true } } },
    });

    const statusSummary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    const conversionDetails = conversions.map((c) => {
      const status = c.status.toLowerCase() as keyof typeof statusSummary;
      if (status in statusSummary) statusSummary[status]++;
      return {
        id: c.id,
        fileName: c.file.name,
        status: c.status,
        resultUrl:
          c.status === "COMPLETED" ? `/api/conversion/${c.id}/download` : null,
      };
    });

    // Update batch status
    if (statusSummary.completed === conversions.length) {
      batch.status = "completed";
    } else if (statusSummary.failed === conversions.length) {
      batch.status = "failed";
    }

    res.json({
      batchId,
      format: batch.format,
      status: batch.status,
      summary: statusSummary,
      conversions: conversionDetails,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Batch status error:", error);
    res.status(500).json({
      error: "Failed to get batch status",
      details: err.message || "Unknown error",
    });
  }
});

/**
 * GET /batch/:batchId/download
 * Download batch as ZIP
 */
router.get("/:batchId/download", async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = activeBatches.get(batchId);

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const conversionIds = batch.conversions.map((c) => c.conversionId);
    const completedConversions = await prisma.conversion.findMany({
      where: {
        id: { in: conversionIds },
        status: "COMPLETED",
      },
      include: { file: { select: { name: true, apsUrn: true } } },
    });

    if (completedConversions.length === 0) {
      return res
        .status(400)
        .json({ error: "No completed conversions to download" });
    }

    const archive = archiver("zip", { zlib: { level: 5 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="batch-${batch.format}-${Date.now()}.zip"`,
    );

    archive.pipe(res);

    for (const conversion of completedConversions) {
      if (!conversion.resultUrn) continue;

      try {
        const baseFileName = conversion.file.name.replace(/\.[^/.]+$/, "");
        const outputFileName = `${baseFileName}.${batch.format}`;

        let fileBuffer: Buffer | null = null;

        if (conversion.resultUrn.startsWith("oss:")) {
          const [, bucketAndKey] = conversion.resultUrn.split("oss:");
          const [, ...keyParts] = bucketAndKey.split("/");
          const objectKey = keyParts.join("/");

          const signedUrl = await apsOssService.getSignedUrl(objectKey);
          if (signedUrl) {
            const response = await axios.get(signedUrl, {
              responseType: "arraybuffer",
            });
            fileBuffer = Buffer.from(response.data);
          }
        } else {
          if (conversion.file.apsUrn) {
            fileBuffer = await modelDerivativeService.getDerivative(
              conversion.file.apsUrn,
              conversion.resultUrn,
            );
          }
        }

        if (fileBuffer) {
          archive.append(fileBuffer, { name: outputFileName });
          console.log(
            `✅ Added ${outputFileName} to ZIP (${fileBuffer.length} bytes)`,
          );
        }
      } catch (fetchError: unknown) {
        const err = fetchError as { message?: string };
        console.warn(
          `Failed to fetch file for conversion ${conversion.id}:`,
          err.message || "Unknown error",
        );
      }
    }

    await archive.finalize();
  } catch (error: unknown) {
    console.error("Batch download error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to create ZIP",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
});

export default router;

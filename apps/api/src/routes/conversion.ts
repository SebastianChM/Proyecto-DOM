/**
 * Unified Conversion Router
 *
 * Replaces the fragmented routes/conversion/ folder.
 * Delegates all logic to ConversionService.
 */
import { Router } from "express";
import { conversionService } from "../services/conversion.service";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, notFound } from "../lib/errors";
import { logger } from "../lib/logger";

const router = Router();

// Zod Schemas
const batchSchema = z.object({
  fileIds: z.array(z.string()).min(1),
  format: z.enum(["pdf", "ifc", "PDF", "IFC"]),
});

/**
 * GET /formats
 * Supported conversion formats (source extension -> target formats)
 */
router.get(
  "/formats",
  asyncHandler(async (_req, res) => {
    const formats = conversionService.getSupportedFormats();
    res.json({ formats });
  }),
);

/**
 * POST /batch
 * Create multiple conversions
 */
router.post(
  "/batch",
  asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id || "system";
    const { fileIds, format } = batchSchema.parse(req.body);
    const result = await conversionService.createBatch(
      userId,
      fileIds,
      format.toLowerCase(),
    );

    res.status(202).json({
      success: true,
      batchId: result.batchId,
      started: result.enqueued,
      enqueued: result.enqueued,
      failed: result.failed,
      errors: result.errors,
    });
  }),
);

/**
 * GET /batch/:batchId
 * Get batch status
 */
router.get(
  "/batch/:batchId",
  asyncHandler(async (req, res) => {
    const result = await conversionService.getBatchStatus(req.params.batchId as string);
    res.json(result);
  }),
);

/**
 * GET /batch/:batchId/download
 * Download all completed conversion results in batch as ZIP
 */
router.get(
  "/batch/:batchId/download",
  asyncHandler(async (req, res) => {
    try {
      const { archive, filename } = await conversionService.getBatchDownloadArchive(
        req.params.batchId as string,
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Type", "application/zip");

      archive.on("error", (err: Error) => {
        logger.error("[CONVERSION] Batch archive stream error", {
          ...logger.fromReq(req),
          error: err.message,
        });

        if (!res.headersSent) {
          res.status(500).json({
            error: "Batch download stream error",
            type: "InternalServerError",
          });
        } else {
          res.destroy();
        }
      });

      archive.pipe(res);
      await archive.finalize();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === "BATCH_NOT_FOUND") {
        throw notFound("Conversion batch not found", "BATCH_NOT_FOUND");
      }

      if (message === "BATCH_DOWNLOAD_NOT_READY") {
        throw badRequest(
          "No completed conversions available for batch download",
          "BATCH_DOWNLOAD_NOT_READY",
        );
      }

      throw error;
    }
  }),
);

/**
 * POST /:fileId
 * Single conversion
 */
router.post(
  "/:fileId",
  asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id || "system";
    const fileId = req.params.fileId as string;

    // Check if fileId is actually "batch" (collision protection if mapped at root)
    if (fileId === "batch") return;

    // Logic for single file trigger
    const format = req.body.format || "pdf";

    // Validate simple format string manually
    if (!["pdf", "ifc", "PDF", "IFC"].includes(format)) {
      throw badRequest("Invalid format. Supported: pdf, ifc", "INVALID_FORMAT");
    }

    const result = await conversionService.createSingle(
      userId,
      fileId,
      format.toLowerCase(),
    );

    const normalizedStatus = String(result.status || "PENDING").toUpperCase();
    const message =
      normalizedStatus === "PROCESSING"
        ? "Conversion already in progress"
        : normalizedStatus === "COMPLETED"
          ? "Conversion already completed"
          : "Conversion queued";

    res.status(202).json({
      success: true,
      message,
      conversion: {
        id: result.id,
        fileId: result.fileId,
        targetFormat: result.targetFormat,
        status: normalizedStatus,
        method: result.method,
      },
    });
  }),
);

/**
 * GET /:conversionId
 * Status for single conversion
 */
router.get(
  "/:conversionId",
  asyncHandler(async (req, res) => {
    const conversionId = req.params.conversionId as string;
    if (conversionId === "batch") return;

    const result = await conversionService.getConversionStatus(conversionId);

    if (!result) {
      throw notFound("Conversion not found", "CONVERSION_NOT_FOUND");
    }
    res.json(result);
  }),
);

/**
 * GET /:conversionId/download
 * Download Result
 */
router.get(
  "/:conversionId/download",
  asyncHandler(async (req, res) => {
    const conversion = await conversionService.getConversionStatus(
      req.params.conversionId as string,
    );
    if (!conversion || !conversion.resultUrn) {
      throw notFound("Conversion result not found", "CONVERSION_NOT_FOUND");
    }

    const { stream, filename, contentType, length } =
      await conversionService.getDownloadData(req.params.conversionId as string);

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", contentType);
    if (length) res.setHeader("Content-Length", length);

    // Stream safety: handle errors via event, not thrown after headers sent
    stream.on("error", (err: Error) => {
      logger.error("[CONVERSION] Download stream error", {
        ...logger.fromReq(req),
        error: err.message,
      });
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Stream error", type: "InternalServerError" });
      } else {
        res.destroy();
      }
    });

    stream.pipe(res);
  }),
);

/**
 * POST /:conversionId/save-to-project
 * Save result as new file
 */
router.post(
  "/:conversionId/save-to-project",
  asyncHandler(async (req, res) => {
    const result = await conversionService.saveToProject(
      req.params.conversionId as string,
    );
    res.json({ success: true, file: result });
  }),
);

/**
 * DELETE /:conversionId
 * Cancel a pending/queued conversion
 */
router.delete(
  "/:conversionId",
  asyncHandler(async (req, res) => {
    const conversionId = req.params.conversionId as string;
    const result = await conversionService.cancelConversion(conversionId);
    res.json({ success: true, ...result });
  }),
);

export default router;

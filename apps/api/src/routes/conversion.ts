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
    res.json(result);
  }),
);

/**
 * GET /batch/:batchId
 * Get batch status
 */
router.get(
  "/batch/:batchId",
  asyncHandler(async (req, res) => {
    const result = await conversionService.getBatchStatus(req.params.batchId);
    res.json(result);
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
    const fileId = req.params.fileId;

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
    res.json(result);
  }),
);

/**
 * GET /:conversionId
 * Status for single conversion
 */
router.get(
  "/:conversionId",
  asyncHandler(async (req, res) => {
    const { conversionId } = req.params;
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
    const { stream, filename, contentType, length } =
      await conversionService.getDownloadData(req.params.conversionId);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Content-Type", contentType);
    if (length) res.setHeader("Content-Length", length);

    // Stream safety: handle errors via event, not thrown after headers sent
    stream.on("error", (err: Error) => {
      logger.error("[CONVERSION] Download stream error", { error: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream error", type: "InternalServerError" });
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
      req.params.conversionId,
    );
    res.json({ success: true, file: result });
  }),
);

export default router;

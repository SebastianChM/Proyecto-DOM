/**
 * Unified Conversion Router
 *
 * Replaces the fragmented routes/conversion/ folder.
 * Delegates all logic to ConversionService.
 */
import { Router, Request, Response, NextFunction } from "express";
import { conversionService } from "../services/conversion.service";
import { z } from "zod";

const router = Router();

// Zod Schemas
const batchSchema = z.object({
  fileIds: z.array(z.string()).min(1),
  format: z.enum(["pdf", "ifc", "PDF", "IFC"]),
});

// Async Handler helper to avoid try/catch boilerplate
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * POST /batch
 * Create multiple conversions
 */
router.post(
  "/batch",
  asyncHandler(async (req, res) => {
    const userId = req.session?.user?.id || "system";
    try {
      const { fileIds, format } = batchSchema.parse(req.body);
      const result = await conversionService.createBatch(
        userId,
        fileIds,
        format.toLowerCase(),
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: "Validation Error", details: e.issues });
        return;
      }
      throw e;
    }
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
      res.status(400).json({ error: "Invalid format. Supported: pdf, ifc" });
      return;
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
      res.status(404).json({ error: "Conversion not found" });
      return;
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
    try {
      const { stream, filename, contentType, length } =
        await conversionService.getDownloadData(req.params.conversionId);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Type", contentType);
      if (length) res.setHeader("Content-Length", length);

      stream.pipe(res);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("not found")) {
        res.status(404).json({ error: e.message });
        return;
      }
      throw e;
    }
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

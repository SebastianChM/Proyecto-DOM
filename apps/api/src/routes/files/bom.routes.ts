import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { BimQueryService } from "../../services/bim-query.service";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound, conflict } from "../../lib/errors";

const router = Router();
const bimQueryService = new BimQueryService();

/**
 * @swagger
 * /files/{id}/bom:
 *   get:
 *     summary: Get BOM (Bill of Materials)
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: BOM data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: File not found or not processed
 *       500:
 *         description: Server error
 */
// Get BOM (Metadata + Properties)
router.get("/:id/bom", asyncHandler(async (req: Request, res: Response) => {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

    if (!file || !file.apsUrn) {
      throw notFound("File not found or not processed", "FILE_NOT_FOUND");
    }

    // Check if file is ready
    if (file.status !== "READY") {
      throw badRequest(
        "File not ready for BOM extraction. Current status: " + file.status,
        "FILE_NOT_READY"
      );
    }

    // If Local Mode, return mock BOM
    if (file.apsUrn.startsWith("local-")) {
      return res.json([
        {
          id: 1,
          name: "Mock Wall",
          category: "Walls",
          family: "Basic Wall",
          type: "Generic 200mm",
          material: "Concrete",
          volume: 10.5,
          area: 20,
          length: 5,
          count: 1,
        },
        {
          id: 2,
          name: "Mock Door",
          category: "Doors",
          family: "Single-Flush",
          type: "0915 x 2134mm",
          material: "Wood",
          volume: 2.1,
          area: 2,
          length: 0,
          count: 1,
        },
        {
          id: 3,
          name: "Mock Window",
          category: "Windows",
          family: "Fixed",
          type: "0915 x 1220mm",
          material: "Glass",
          volume: 1.2,
          area: 1.5,
          length: 0,
          count: 1,
        },
      ]);
    }

    logger.debug(`[FILES_BOM] Using URN: ${file.apsUrn}`);

    try {
      const bom = await bimQueryService.getBOM(file.apsUrn);
      logger.info(`[FILES_BOM] Processed ${bom.length} elements`);
      res.json(bom);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      // Handle APS Not Ready specific error
      if (errorMessage.includes("APS_MODEL_NOT_READY")) {
        throw conflict("Model properties are not yet extracted.", "APS_MODEL_NOT_READY");
      }
      throw error;
    }
}));

export default router;

/**
 * File Routes - Upload Operations
 *
 * Handles file upload and import from external sources (APS/ACC/BIM360)
 */

import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { fileService } from "../../services/files.service";
import { cacheService, RedisKeys } from "../../lib/redis";
import {
  isAllowedExtension,
  getAllowedExtensionsString,
  getFileType,
  prisma,
} from "../../lib/utils";
import { logger } from "../../lib/logger";

const router = Router();
const upload = multer({ dest: "uploads/" });

/**
 * @swagger
 * /files/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               projectId:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file or missing project ID
 *       500:
 *         description: Server error
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { projectId } = req.body;
    const forceLocal = req.query.forceLocal === "true";

    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    // Server-side validation
    if (!isAllowedExtension(req.file.originalname)) {
      // Clean up uploaded file immediately
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: "Unsupported file format",
        details: `Allowed formats: ${getAllowedExtensionsString()}`,
      });
    }

    const result = await fileService.handleFileUpload(
      req.file,
      projectId,
      forceLocal,
    );

    // Invalidate caches
    await Promise.all([
      cacheService.del(RedisKeys.projectDetail(projectId)),
      cacheService.invalidatePattern("cache:dashboard:stats:*"),
      cacheService.invalidatePattern("cache:files:recent:*"),
    ]);

    res.json({
      success: true,
      file: result.dbFile,
      urn: result.apsUrn,
      warning: result.uploadWarning,
      mode:
        result.fileStatus === "UPLOADING"
          ? "UPLOADING (background upload in progress)"
          : "APS",
      message: result.message,
    });
  } catch (error: unknown) {
    // Clean up local file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error instanceof Error ? error : new Error(String(error)));
  }
});

/**
 * @swagger
 * /files/import-aps:
 *   post:
 *     summary: Import file from APS (ACC/BIM360)
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - name
 *               - urn
 *             properties:
 *               projectId:
 *                 type: string
 *               name:
 *                 type: string
 *               urn:
 *                 type: string
 *     responses:
 *       200:
 *         description: File imported successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post("/import-aps", async (req, res) => {
  try {
    const {
      projectId,
      name,
      urn,
      apsProjectId,
      apsItemId,
      apsHubId,
      apsFolderId,
      apsStorageId,
      size,
    } = req.body;

    if (!projectId || !name || !urn) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if file already exists in this project (by APS Item ID)
    if (apsItemId) {
      const existingFile = await prisma.file.findFirst({
        where: {
          projectId: projectId,
          apsItemId: apsItemId,
        },
      });

      if (existingFile) {
        logger.info(
          `[FILES_UPLOAD] File ${name} already imported (ID: ${existingFile.id}). Returning existing record.`,
        );
        return res.json({
          success: true,
          file: existingFile,
          message: "File already imported",
        });
      }
    }

    // Create DB record with APS metadata
    const dbFile = await prisma.file.create({
      data: {
        name: name,
        originalName: name,
        type: getFileType("application/octet-stream", name),
        size: size || 0,
        s3Key: "IMPORTED_FROM_APS",
        apsUrn: urn,
        apsProjectId: apsProjectId || null,
        apsItemId: apsItemId || null,
        apsHubId: apsHubId || null,
        apsFolderId: apsFolderId || null,
        apsStorageId: apsStorageId || null,
        projectId,
        status: "READY",
      } as Parameters<typeof prisma.file.create>[0]["data"],
    });

    res.json({
      success: true,
      file: dbFile,
    });
  } catch (error: unknown) {
    logger.error("[FILES_UPLOAD] Import error", {
      error: error instanceof Error ? error.message : String(error),
    });
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Import failed", details: errorMessage });
  }
});

export default router;

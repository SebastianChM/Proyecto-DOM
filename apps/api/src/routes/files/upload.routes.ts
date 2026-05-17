/**
 * File Routes - Upload Operations
 *
 * Handles file upload and import from external sources (APS/ACC/BIM360)
 */

import { Router } from "express";
import multer from "multer";
import { unlink, access } from "fs/promises";
import { rateLimiter } from "../../config/rate-limit.config";
import { fileService } from "../../services/files.service";
import { cacheService, RedisKeys } from "../../lib/redis";
import {
  isAllowedExtension,
  getAllowedExtensionsString,
  getFileType,
  prisma,
} from "../../lib/utils";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest } from "../../lib/errors";

const router = Router();
const upload = multer({ dest: "uploads/" });

/** Best-effort async file cleanup — never throws. */
async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    await access(filePath);
    await unlink(filePath);
  } catch {
    // intentionally ignored — cleanup is best-effort
  }
}

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
router.post(
  "/upload",
  rateLimiter.uploadLimiter(),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest("No file uploaded", "FILE_UPLOAD_INVALID");
    }

    const { projectId } = req.body;
    const forceLocal = req.query.forceLocal === "true";

    if (!projectId) {
      await safeDeleteFile(req.file.path);
      throw badRequest("Project ID is required", "MISSING_PROJECT_ID");
    }

    // Server-side validation
    if (!isAllowedExtension(req.file.originalname)) {
      await safeDeleteFile(req.file.path);
      throw badRequest(
        "Unsupported file format",
        "FILE_FORMAT_UNSUPPORTED",
        `Allowed formats: ${getAllowedExtensionsString()}`,
      );
    }

    try {
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
      if (req.file) await safeDeleteFile(req.file.path);
      throw error;
    }
  }),
);

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
router.post(
  "/import-aps",
  asyncHandler(async (req, res) => {
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
      throw badRequest("Missing required fields", "MISSING_FIELDS");
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
          logger.fromReq(req),
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
  }),
);

export default router;

import prisma from "../lib/prisma";
import { apsOssService } from "./aps/oss.service";
import { modelDerivativeService } from "./aps/model-derivative.service";
import { APP_CONFIG } from "../config/constants";
import { getFileType } from "../lib/utils";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

export class FileService {
  /**
   * Handle file upload with ASYNCHRONOUS APS upload
   * Creates DB record immediately, responds fast, then uploads to APS in background
   */
  async handleFileUpload(
    file: Express.Multer.File,
    projectId: string,
    forceLocal: boolean = false,
  ) {
    // Check File Size Limit
    if (file.size > APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size exceeds limit of ${APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    // Check Project File Count Limit
    const fileCount = await prisma.file.count({
      where: { projectId },
    });

    if (fileCount >= APP_CONFIG.LIMITS.MAX_FILES_PER_PROJECT) {
      throw new Error(
        `Project file limit reached (${APP_CONFIG.LIMITS.MAX_FILES_PER_PROJECT} files max)`,
      );
    }

    const fileType = getFileType(file.mimetype, file.originalname);
    const isPdf = fileType === "PDF";
    const s3Key = `files/${projectId}/${Date.now()}-${file.originalname}`;

    // STEP 1: Create DB record IMMEDIATELY with UPLOADING status
    // This allows us to respond to the user quickly
    const dbFile = await prisma.file.create({
      data: {
        name: file.originalname,
        originalName: file.originalname,
        type: fileType,
        size: file.size,
        s3Key,
        apsUrn: "UPLOADING", // Will be updated after background upload
        projectId,
        localPath: path.resolve(file.path), // Save ABSOLUTE local path for resilience
        status: "UPLOADING", // New status to indicate upload in progress
      },
    });

    logger.debug("[FILES] File registered, starting background upload", {
      filename: file.originalname,
    });

    // STEP 2: Start BACKGROUND upload to APS (non-blocking)
    // The file path is still valid at this point since multer hasn't cleaned it up yet
    const filePath = file.path;
    const fileId = dbFile.id;

    // Use setImmediate to not block the response
    setImmediate(async () => {
      try {
        if (forceLocal) {
          throw new Error("Forced Local Mode");
        }

        // Upload to APS
        logger.debug("[FILES] Background APS upload started", {
          filename: file.originalname,
        });
        const startTime = Date.now();

        // OPTIMIZATION: Use uploadObject (Classic) instead of uploadStream (S3 Direct)
        // This avoids potential firewall/negotiation latency with S3 Signed URLs.
        const buffer = fs.readFileSync(filePath);
        const apsObject = await apsOssService.uploadObject(
          buffer,
          file.originalname,
        );

        const apsUrn = Buffer.from(
          (apsObject as { objectId?: string }).objectId || "",
        )
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const uploadTime = Date.now() - startTime;
        logger.info("[FILES] APS upload completed", {
          filename: file.originalname,
          durationMs: uploadTime,
        });

        // Update DB with the URN
        const newStatus = isPdf ? "READY" : "UPLOADED";
        await prisma.file.update({
          where: { id: fileId },
          data: {
            apsUrn,
            status: newStatus,
          },
        });

        // Trigger translation for non-PDF files
        if (!isPdf) {
          try {
            await modelDerivativeService.translateToSVF2(apsUrn);
            await prisma.file.update({
              where: { id: fileId },
              data: { status: "TRANSLATING" },
            });
            logger.debug("[FILES] Translation started", {
              filename: file.originalname,
            });
          } catch (translateError: unknown) {
            const err = translateError as { message?: string };
            logger.warn("[FILES] Translation failed to start", {
              filename: file.originalname,
              error: err.message || "Unknown error",
            });
          }

          // --- PREDICTIVE CONVERSION ---
          // Automatically start PDF conversion for DWG files to reduce wait time
          if (fileType === "DWG") {
            try {
              logger.debug("[FILES] Predictive Conversion: queueing PDF", {
                filename: file.originalname,
              });
              await prisma.conversion.create({
                data: {
                  fileId: fileId,
                  targetFormat: "pdf",
                  method: "modelDerivative", // DWG to PDF uses Model Derivative
                  status: "PENDING", // Worker will pick this up
                },
              });
            } catch (pcError: unknown) {
              logger.warn("[FILES] Predictive conversion failed to queue", {
                error: String(pcError),
              });
            }
          }
        }
      } catch (apsError: unknown) {
        const err = apsError as { message?: string };
        logger.error("[FILES] Background APS upload failed", {
          filename: file.originalname,
          error: err.message || "Unknown error",
        });

        if (APP_CONFIG.DEMO_MODE) {
          // In demo mode, use local fallback
          const localUrn = `local-${Date.now()}-${Buffer.from(file.originalname).toString("base64").replace(/=/g, "")}`;
          await prisma.file.update({
            where: { id: fileId },
            data: {
              apsUrn: localUrn,
              status: isPdf ? "READY" : "LOCAL_ONLY",
            },
          });
          logger.debug("[FILES] Using local fallback", {
            filename: file.originalname,
          });
        } else {
          // Mark as failed
          await prisma.file.update({
            where: { id: fileId },
            data: { status: "FAILED" },
          });
        }
      }
    });

    // STEP 3: Return IMMEDIATELY - don't wait for APS upload
    return {
      dbFile,
      apsUrn: "UPLOADING", // Will be updated in background
      uploadWarning: null,
      fileStatus: "UPLOADING",
      message: "File registered. Upload to cloud storage in progress...",
    };
  }
}

export const fileService = new FileService();

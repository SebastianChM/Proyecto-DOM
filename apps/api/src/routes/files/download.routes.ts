/**
 * File Routes - Download Operations
 *
 * Handles single file download and batch download (ZIP)
 */

import { Router } from "express";
import axios from "axios";
import archiver from "archiver";
import {
  RequestWithSession,
  getDownloadUrlForFile,
  prisma,
} from "../../lib/utils";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, unauthorized, notFound, forbidden } from "../../lib/errors";

const router = Router();

/**
 * @swagger
 * /files/{id}/download:
 *   get:
 *     summary: Download a file
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
 *         description: File content
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get("/:id/download", asyncHandler(async (req, res) => {
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

    if (!file) {
      throw notFound("File not found", "FILE_NOT_FOUND");
    }

    // Handle Local Mode
    if (file.apsUrn?.startsWith("local-")) {
      throw notFound("Local file download not implemented", "LOCAL_DOWNLOAD_UNSUPPORTED");
    }

    // Get user token for imported files
    const userAccessToken = (req as RequestWithSession).session?.user
      ?.apsAccessToken;

    // Get signed URL
    const signedUrl = await getDownloadUrlForFile(file, userAccessToken);

    if (!signedUrl) {
      // Check specific reasons
      if (file.s3Key === "IMPORTED_FROM_APS" && !userAccessToken) {
        throw unauthorized(
          "Please log in with your Autodesk account to view files from ACC/BIM360."
        );
      }
      throw notFound(
        "Unable to retrieve download URL. The file may no longer be accessible.",
        "DOWNLOAD_UNAVAILABLE"
      );
    }

    // Proxy the file download — errors after this point are stream errors
    const headers: Record<string, string> = {};
    if (file.s3Key === "IMPORTED_FROM_APS" && userAccessToken) {
      headers["Authorization"] = `Bearer ${userAccessToken}`;
    }

    try {
      const response = await axios.get(signedUrl, {
        responseType: "stream",
        headers,
      });

      // Set headers
      const contentType =
        file.type === "PDF" || file.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream";
      res.setHeader("Content-Type", contentType);

      const safeFilename = file.name.replace(/"/g, "");
      res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);

      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self' *");

      response.data.pipe(res);
    } catch (e: unknown) {
      // Stream/download errors — classify by upstream status
      const axiosError = e as {
        response?: { status?: number };
        statusCode?: number;
        message?: string;
      };
      const errorMessage = e instanceof Error ? e.message : String(e);

      if (
        errorMessage.includes("404") ||
        axiosError.response?.status === 404 ||
        axiosError.statusCode === 404
      ) {
        throw notFound(
          "The content is no longer available in Autodesk storage. Please re-upload or re-sync.",
          "FILE_EXPIRED"
        );
      }

      if (axiosError.response?.status === 403) {
        throw forbidden(
          "You do not have permission to access this file in APS."
        );
      }

      throw e;
    }
}));

/**
 * @swagger
 * /files/batch-download:
 *   post:
 *     summary: Batch download files as ZIP
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: ZIP file containing requested files
 */
router.post("/batch-download", asyncHandler(async (req, res) => {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw badRequest("No file IDs provided", "MISSING_FILE_IDS");
    }

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
    });

    if (files.length === 0) {
      throw notFound("No files found", "FILES_NOT_FOUND");
    }

    // Set headers for ZIP download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="files_archive_${Date.now()}.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.on("close", () => {
      // connection closed
    });

    archive.on("error", (err: unknown) => {
      logger.error("[FILES_DOWNLOAD] Archiver error", {
        error: err instanceof Error ? (err as Error).message : String(err),
      });
    });

    archive.pipe(res);

    // Process files sequentially — stream is already started
    const userAccessToken = (req as RequestWithSession).session?.user
      ?.apsAccessToken;

    for (const file of files) {
      try {
        if (!file.apsUrn) {
          archive.append(`Skipped ${file.name}: No URN.\n`, {
            name: `${file.name}.txt`,
          });
          continue;
        }

        if (file.apsUrn.startsWith("local-")) {
          archive.append(`Skipped ${file.name}: Local file not supported.\n`, {
            name: `${file.name}.txt`,
          });
          continue;
        }

        const signedUrl = await getDownloadUrlForFile(file, userAccessToken);

        if (!signedUrl) {
          archive.append(`Skipped ${file.name}: Download unavailable.\n`, {
            name: `${file.name}.txt`,
          });
          continue;
        }

        const headers: Record<string, string> = {};
        if (file.s3Key === "IMPORTED_FROM_APS" && userAccessToken) {
          headers["Authorization"] = `Bearer ${userAccessToken}`;
        }

        const response = await axios.get(signedUrl, {
          responseType: "stream",
          headers,
        });

        archive.append(response.data, { name: file.name });
      } catch (fileError: unknown) {
        const msg =
          fileError instanceof Error ? fileError.message : String(fileError);
        logger.error(`[FILES_DOWNLOAD] Error zipping file ${file.name}`, {
          error: msg,
        });
        archive.append(`Error: ${msg}\n`, { name: `${file.name}_error.txt` });
      }
    }

    await archive.finalize();
}));

export default router;

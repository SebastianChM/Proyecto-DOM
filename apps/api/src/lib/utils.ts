/**
 * Shared Utilities
 *
 * Central collection of helper functions, replacing:
 * - routes/files/utils.ts
 * - routes/auth/utils.ts
 * - routes/aps/utils.ts
 */

import { Request, Response } from "express";
import { ApsError } from "../services/aps/aps-error";
import { CONSTANTS, APP_CONFIG } from "../config/constants";
import prisma from "./prisma";
import { apsDataManagementService } from "../services/aps/data-management.service";
import { apsOssService } from "../services/aps/oss.service";
import { logger } from "./logger";

import { Session } from "express-session";

// Re-export prisma
export { prisma };

export interface SessionData {
  user?: {
    id?: string;
    apsAccessToken?: string;
  };
  apsToken?: string;
}

export interface RequestWithSession extends Request {
  file?: Express.Multer.File;
  session?: Session & Partial<SessionData>;
}

// ===================================
// APS Error Handler
// ===================================
export function handleApsError(
  error: unknown,
  req: Request,
  res: Response,
): void {
  const requestId = req.headers["x-request-id"] as string | undefined;

  if (error instanceof ApsError) {
    res.status(error.status).json({
      error: "APS_ERROR",
      code: error.code,
      message: error.message,
      requestId,
      status: error.status,
      ...(error.details && {
        apsRequestId: error.details.apsRequestId,
        apsErrorId: error.details.apsErrorId,
      }),
    });
    return;
  }

  logger.error(`[APS_ROUTE] Unexpected error in ${req.originalUrl}`, {
    error: error instanceof Error ? error.message : String(error),
    requestId,
  });

  res.status(500).json({
    error: "APS_ERROR",
    code: "APS_UPSTREAM",
    message: "An unexpected error occurred",
    requestId,
    status: 500,
  });
}

// ===================================
// Auth Helpers
// ===================================
export const getFrontendUrl = (): string => {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.FRONTEND_URL ||
    CONSTANTS.FRONTEND.DEFAULT_URL
  );
};

export const getDashboardUrl = (): string => {
  return `${getFrontendUrl()}${CONSTANTS.FRONTEND.DASHBOARD_PATH}`;
};

// ===================================
// File Helpers
// ===================================

export function getFileType(mimetype: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "rvt") return "RVT";
  if (ext === "dwg") return "DWG";
  if (ext === "pdf") return "PDF";
  if (ext === "ifc") return "IFC";
  if (ext === "nwc") return "NWC";
  if (ext === "dwf") return "DWF";
  return "OTHER";
}

export function isAllowedExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return (APP_CONFIG.UPLOAD.ALLOWED_EXTENSIONS as readonly string[]).includes(
    ext,
  );
}

export function getAllowedExtensionsString(): string {
  return APP_CONFIG.UPLOAD.ALLOWED_EXTENSIONS.join(", ").toUpperCase();
}

/**
 * Decode URN and extract object key for OSS operations
 */
export function extractObjectKeyFromUrn(
  urn: string,
  s3Key?: string | null,
): string | null {
  const decodedUrn = Buffer.from(urn, "base64").toString("utf-8");
  const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);

  if (match) {
    return match[1];
  }

  if (s3Key && s3Key !== "unknown_key" && s3Key !== "IMPORTED_FROM_APS") {
    const s3KeyParts = s3Key.split("/");
    return s3KeyParts[s3KeyParts.length - 1];
  }

  return null;
}

/**
 * Helper to get a signed download URL for a file
 */
export async function getDownloadUrlForFile(
  file: {
    s3Key?: string | null;
    apsProjectId?: string | null;
    apsItemId?: string | null;
    apsStorageId?: string | null;
    apsUrn?: string | null;
  },
  userAccessToken?: string,
): Promise<string | null> {
  // 1. Handle Imported Files (ACC/BIM360)
  if (file.s3Key === "IMPORTED_FROM_APS") {
    if (!userAccessToken) return null;

    if (file.apsProjectId && file.apsItemId) {
      try {
        const url = await apsDataManagementService.getItemDownloadUrl(
          file.apsProjectId,
          file.apsItemId,
          userAccessToken,
        );
        if (url) return url;
      } catch (err) {
        logger.warn("[FILES_UTILS] Failed DM API download url", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (file.apsStorageId) {
      if (file.apsStorageId.startsWith("https://")) {
        return file.apsStorageId;
      }
      const match = file.apsStorageId.match(
        /urn:adsk\.[a-z]+:os\.object:[^/]+\/(.+)/,
      );
      if (match) {
        try {
          return await apsOssService.getSignedUrl(match[1]);
        } catch (err) {
          logger.warn("[FILES_UTILS] Failed OSS signed url for storageId", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    return null;
  }

  // 2. Handle Regular Uploaded Files (OSS)
  if (file.apsUrn) {
    const objectKey = extractObjectKeyFromUrn(file.apsUrn, file.s3Key);
    if (objectKey) {
      return await apsOssService.getSignedUrl(objectKey);
    }
  }

  return null;
}

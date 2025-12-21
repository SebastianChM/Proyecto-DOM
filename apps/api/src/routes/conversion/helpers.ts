/**
 * Conversion Module - Shared Helpers and Types
 *
 * Shared utilities for conversion routes
 */

import prisma from "../../lib/prisma";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import { designAutomationService } from "../../services/aps/design-automation.service";
import { apsOssService } from "../../services/aps/oss.service";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

import { APP_CONFIG } from "../../config/constants";

// Re-export for use in route files
export {
  prisma,
  modelDerivativeService,
  designAutomationService,
  apsOssService,
  axios,
  fs,
  path,
};
export const BUCKET_KEY = APP_CONFIG.APS.BUCKET_KEY;

// Batch tracking type
export interface BatchInfo {
  id: string;
  format: string;
  conversions: { fileId: string; conversionId: string; fileName: string }[];
  createdAt: Date;
  status: "processing" | "completed" | "failed";
}

// In-memory batch tracking (could use Redis in production)
export const activeBatches = new Map<string, BatchInfo>();

/**
 * Clean up old batches (older than 1 hour)
 */
export function cleanupOldBatches(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, batch] of activeBatches) {
    if (batch.createdAt.getTime() < oneHourAgo) {
      activeBatches.delete(id);
    }
  }
}

/**
 * Retry with exponential backoff for handling 429 rate limits
 * Follows Autodesk best practices for API rate limiting
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const err = error as {
        response?: { status?: number; headers?: Record<string, string> };
        status?: number;
      };

      // Check if it's a 429 (Too Many Requests) error
      const status = err.response?.status || err.status || 0;

      if (status === 429 && attempt < maxRetries) {
        // Get retry-after header or use exponential backoff
        const retryAfter = err.response?.headers?.["retry-after"];
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelay * Math.pow(2, attempt);

        console.warn(
          `⚠️ Rate limited (429). Retry ${attempt + 1}/${maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // For 409 (Already in progress), don't retry - it's expected
      if (status === 409) {
        throw error;
      }

      // For other errors, retry with backoff
      if (attempt < maxRetries && status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `⚠️ Server error (${status}). Retry ${attempt + 1}/${maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Supported output formats based on Autodesk documentation
 */
export const SUPPORTED_CONVERSIONS = {
  // Model Derivative API supported conversions
  modelDerivative: {
    // DWG/DXF can be converted to PDF via Model Derivative
    toPdf: ["dwg", "dxf"],
    // Most BIM formats can be converted to IFC
    toIfc: ["rvt", "nwc", "nwd", "ifc"],
    // Viewer formats (SVF/SVF2)
    toViewer: [
      "rvt",
      "dwg",
      "dxf",
      "ifc",
      "nwc",
      "nwd",
      "step",
      "stp",
      "iges",
      "igs",
    ],
  },
  // Design Automation API required for these conversions
  designAutomation: {
    // RVT to PDF requires Design Automation with Revit plugin
    toPdf: ["rvt"],
  },
};

/**
 * Check if a conversion is supported and which API to use
 */
export function getConversionMethod(
  fileExtension: string,
  targetFormat: string,
): "modelDerivative" | "designAutomation" | null {
  const ext = fileExtension.toLowerCase();
  const format = targetFormat.toLowerCase();

  if (format === "pdf") {
    if (SUPPORTED_CONVERSIONS.modelDerivative.toPdf.includes(ext)) {
      return "modelDerivative";
    }
    if (SUPPORTED_CONVERSIONS.designAutomation.toPdf.includes(ext)) {
      return "designAutomation";
    }
  }

  if (format === "ifc") {
    if (SUPPORTED_CONVERSIONS.modelDerivative.toIfc.includes(ext)) {
      return "modelDerivative";
    }
  }

  return null;
}

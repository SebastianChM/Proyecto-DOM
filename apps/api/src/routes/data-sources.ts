/**
 * Data Sources API
 *
 * Endpoints for extracting structured data from PDF/Excel files
 * Part of Compliance Engine V2
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { unlink, access } from "fs/promises";
import prisma from "../lib/prisma";
import { dataExtractorService } from "../services/data-extractor.service";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, notFound, unauthorized } from "../lib/errors";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/datasources");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
      "application/vnd.ms-excel", // xls
      "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/**
 * POST /api/data-sources/extract
 * Upload a PDF/Excel file and extract structured data
 */
router.post(
  "/extract",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const { projectId } = req.body;
    const file = req.file;

    if (!file) {
      throw badRequest("No file uploaded", "FILE_UPLOAD_INVALID");
    }

    if (!projectId) {
      // Clean up uploaded file (async)
      await unlink(file.path).catch(() => {});
      throw badRequest("projectId is required", "MISSING_PROJECT_ID");
    }

    logger.info(
      `[DATA_SOURCES] Extracting from: ${file.originalname} (${file.mimetype})`,
    );

    let result;
    if (file.mimetype === "application/pdf") {
      result = await dataExtractorService.extractFromPDF(
        file.path,
        file.originalname,
      );
    } else {
      result = await dataExtractorService.extractFromExcel(
        file.path,
        file.originalname,
      );
    }

    // Save to database
    const dataSourceId = await dataExtractorService.saveDataSource(
      projectId,
      result,
    );

    // Clean up uploaded file after processing (async)
    await unlink(file.path).catch(() => {});

    res.status(201).json({
      id: dataSourceId,
      success: result.success,
      documentName: result.documentName,
      documentType: result.documentType,
      tablesCount: result.tables.length,
      tables: result.tables.map((t) => ({
        name: t.name,
        headers: t.headers,
        rowsCount: t.rows.length,
        confidence: t.confidence,
      })),
      metadata: result.metadata,
      errors: result.errors,
    });
  }),
);

/**
 * POST /api/data-sources/extract-from-file/:fileId
 * Extract data from an existing file in the system
 */
router.post(
  "/extract-from-file/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const fileId = req.params.fileId as string;
    const { projectId } = req.body;

    // Get file from database
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw notFound("File not found", "FILE_NOT_FOUND");
    }

    if (!file.s3Key) {
      throw badRequest("File does not have local storage", "FILE_NO_STORAGE");
    }

    const filePath = path.join(__dirname, "../../uploads", file.s3Key);

    const fileExists = await access(filePath)
      .then(() => true)
      .catch(() => false);
    if (!fileExists) {
      throw notFound("File not found on disk", "FILE_NOT_ON_DISK");
    }

    logger.info(`[DATA_SOURCES] Extracting from existing file: ${file.name}`);

    let result;
    if (file.type === "PDF") {
      result = await dataExtractorService.extractFromPDF(filePath, file.name);
    } else if (["EXCEL", "XLS", "XLSX"].includes(file.type)) {
      result = await dataExtractorService.extractFromExcel(filePath, file.name);
    } else {
      throw badRequest(
        `Unsupported file type: ${file.type}`,
        "UNSUPPORTED_FILE_TYPE",
      );
    }

    // Save to database
    const dataSourceId = await dataExtractorService.saveDataSource(
      projectId || file.projectId,
      result,
      fileId,
    );

    res.status(201).json({
      id: dataSourceId,
      success: result.success,
      documentName: result.documentName,
      documentType: result.documentType,
      tablesCount: result.tables.length,
      tables: result.tables.map((t) => ({
        name: t.name,
        headers: t.headers,
        rowsCount: t.rows.length,
        confidence: t.confidence,
      })),
      metadata: result.metadata,
      errors: result.errors,
    });
  }),
);

/**
 * GET /api/data-sources
 * List all data sources for a project
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const { projectId } = req.query;

    if (!projectId) {
      throw badRequest("projectId is required", "MISSING_PROJECT_ID");
    }

    const dataSources = await prisma.dataSource.findMany({
      where: { projectId: projectId as string },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        extractedAt: true,
        createdAt: true,
      },
    });

    res.json(dataSources);
  }),
);

/**
 * GET /api/data-sources/:id
 * Get a data source with full extracted data
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const id = req.params.id as string;

    const dataSource = await dataExtractorService.getDataSource(id);

    if (!dataSource) {
      throw notFound("Data source not found", "DATA_SOURCE_NOT_FOUND");
    }

    res.json(dataSource);
  }),
);

/**
 * GET /api/data-sources/:id/tables/:tableIndex
 * Get a specific table from a data source
 */
router.get(
  "/:id/tables/:tableIndex",
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const id = req.params.id as string;
    const tableIndex = req.params.tableIndex as string;
    const index = parseInt(tableIndex);

    const dataSource = await dataExtractorService.getDataSource(id);

    if (!dataSource) {
      throw notFound("Data source not found", "DATA_SOURCE_NOT_FOUND");
    }

    const extractedData = dataSource.extractedData as
      | { tables?: unknown[] }
      | undefined;
    const tables = extractedData?.tables || [];

    if (index < 0 || index >= tables.length) {
      throw notFound("Table not found", "TABLE_NOT_FOUND");
    }

    res.json(tables[index]);
  }),
);

/**
 * PUT /api/data-sources/:id/status
 * Update data source status (e.g., mark as reviewed)
 */
router.put(
  "/:id/status",
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const id = req.params.id as string;
    const { status } = req.body;

    if (!["PENDING", "EXTRACTED", "REVIEWED", "FAILED"].includes(status)) {
      throw badRequest("Invalid status", "INVALID_STATUS");
    }

    const updated = await prisma.dataSource.update({
      where: { id },
      data: {
        status,
        reviewedAt: status === "REVIEWED" ? new Date() : undefined,
      },
    });

    res.json(updated);
  }),
);

/**
 * DELETE /api/data-sources/:id
 * Delete a data source
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as { session?: { user?: { id?: string } } }).session?.user?.id) {
      throw unauthorized("Authentication required");
    }
    const id = req.params.id as string;

    await prisma.dataSource.delete({
      where: { id },
    });

    res.status(204).send();
  }),
);

export default router;

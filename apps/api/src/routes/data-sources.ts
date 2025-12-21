/**
 * Data Sources API
 *
 * Endpoints for extracting structured data from PDF/Excel files
 * Part of Compliance Engine V2
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { dataExtractorService } from "../services/data-extractor.service";

const router = Router();
const prisma = new PrismaClient();

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
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!projectId) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "projectId is required" });
      }

      console.log(
        `[DataSources] Extracting from: ${file.originalname} (${file.mimetype})`,
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

      // Clean up uploaded file after processing
      fs.unlinkSync(file.path);

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
    } catch (error: unknown) {
      const err = error as Error;
      console.error("[DataSources] Extraction error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * POST /api/data-sources/extract-from-file/:fileId
 * Extract data from an existing file in the system
 */
router.post(
  "/extract-from-file/:fileId",
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const { projectId } = req.body;

      // Get file from database
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      if (!file.s3Key) {
        return res
          .status(400)
          .json({ error: "File does not have local storage" });
      }

      const filePath = path.join(__dirname, "../../uploads", file.s3Key);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      console.log(`[DataSources] Extracting from existing file: ${file.name}`);

      let result;
      if (file.type === "PDF") {
        result = await dataExtractorService.extractFromPDF(filePath, file.name);
      } else if (["EXCEL", "XLS", "XLSX"].includes(file.type)) {
        result = await dataExtractorService.extractFromExcel(
          filePath,
          file.name,
        );
      } else {
        return res
          .status(400)
          .json({ error: `Unsupported file type: ${file.type}` });
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
    } catch (error: unknown) {
      const err = error as Error;
      console.error("[DataSources] Extraction error:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/data-sources
 * List all data sources for a project
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
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
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DataSources] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/data-sources/:id
 * Get a data source with full extracted data
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dataSource = await dataExtractorService.getDataSource(id);

    if (!dataSource) {
      return res.status(404).json({ error: "Data source not found" });
    }

    res.json(dataSource);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DataSources] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/data-sources/:id/tables/:tableIndex
 * Get a specific table from a data source
 */
router.get("/:id/tables/:tableIndex", async (req: Request, res: Response) => {
  try {
    const { id, tableIndex } = req.params;
    const index = parseInt(tableIndex);

    const dataSource = await dataExtractorService.getDataSource(id);

    if (!dataSource) {
      return res.status(404).json({ error: "Data source not found" });
    }

    const extractedData = dataSource.extractedData as
      | { tables?: unknown[] }
      | undefined;
    const tables = extractedData?.tables || [];

    if (index < 0 || index >= tables.length) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json(tables[index]);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DataSources] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/data-sources/:id/status
 * Update data source status (e.g., mark as reviewed)
 */
router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["PENDING", "EXTRACTED", "REVIEWED", "FAILED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await prisma.dataSource.update({
      where: { id },
      data: {
        status,
        reviewedAt: status === "REVIEWED" ? new Date() : undefined,
      },
    });

    res.json(updated);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DataSources] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/data-sources/:id
 * Delete a data source
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.dataSource.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[DataSources] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

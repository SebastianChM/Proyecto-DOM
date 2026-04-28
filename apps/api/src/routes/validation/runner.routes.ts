import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { Queues } from "../../lib/queue";
import {
  parserService,
  SpecificationItem,
} from "../../services/validation/parser.service";
import { modelDerivativeService } from "../../services/aps/model-derivative.service";
import {
  validationService,
  ValidationResult as ApiValidationResult,
} from "../../services/validation/validation.service";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound } from "../../lib/errors";

const router = Router();

// --- Routes ---

/**
 * POST /api/validation/run
 * Perform a full validation (Async via Worker)
 */
router.post(
  "/run",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      fileId,
      fileName,
      fileUrn,
      projectId,
      userId,
      etData,
      modelData,
      validationRules,
    } = req.body;

    // 1. Create validation run record (PENDING)
    const validationRun = await prisma.validationRun.create({
      data: {
        fileId,
        fileName,
        fileUrn,
        projectId,
        userId,
        validationType: "STRUCTURE", // Make dynamic if needed
        validationRules: validationRules
          ? JSON.stringify(validationRules)
          : null,
        status: "PENDING",
      },
    });

    // 2. Add job to queue
    await Queues.validation.add("validate", {
      validationRunId: validationRun.id,
      fileId,
      projectId,
      userId,
      etData,
      modelData,
    });

    res.status(202).json({
      success: true,
      message: "Validation job queued successfully",
      data: {
        validationRunId: validationRun.id,
        status: "PENDING",
      },
    });
  }),
);

/**
 * POST /api/validation/validate
 * Run validation comparing ET document with models (Legacy Synchronous Mode)
 * REFACTORED: Logic moved to ValidationService
 */
router.post(
  "/validate",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, etDocumentId } = req.body;

    if (!projectId || !etDocumentId) {
      throw badRequest(
        "projectId and etDocumentId are required",
        "MISSING_FIELDS",
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        files: {
          where: {
            type: { in: ["RVT", "DWG", "IFC", "NWC"] },
            status: "READY",
          },
        },
      },
    });

    if (!project) {
      throw notFound("Project not found", "PROJECT_NOT_FOUND");
    }

    const etDocument = await prisma.file.findUnique({
      where: { id: etDocumentId },
    });

    if (!etDocument) {
      throw notFound("ET document not found", "ET_DOCUMENT_NOT_FOUND");
    }

    logger.info(
      `[VALIDATION] Starting for project ${project.name}, Doc: ${etDocument.name}`,
    );

    // 1. Parse ET Document
    let specs: SpecificationItem[] = [];
    try {
      if (!etDocument.s3Key) throw new Error("Document S3 Key is missing");

      const parsedDoc = await parserService.parseDocument(
        etDocument.s3Key,
        "text/plain", // TODO: Detect mime type properly or store in DB
      );

      specs = parserService.extractSpecifications(parsedDoc.text);
      logger.info(`[VALIDATION] Extracted ${specs.length} specifications`);
    } catch (parseError) {
      logger.warn("[VALIDATION] Document parsing warning", {
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
      });
    }

    // 2. Create Validation Run Record
    let userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      userId = firstUser?.id || "system";
    }

    const validationRun = await prisma.validationRun.create({
      data: {
        fileId: etDocumentId,
        fileName: etDocument.name,
        projectId: projectId,
        userId: userId,
        status: "PROCESSING",
        validationType: "SPEC_COMPARE",
      },
    });

    let allResults: ApiValidationResult[] = [];
    const modelFiles = project.files.filter((f) => f.apsUrn);

    // 3. Process Validation
    for (const file of modelFiles) {
      if (!file.apsUrn) continue;
      try {
        logger.debug(`[VALIDATION] Fetching properties: ${file.name}`);
        const modelProps = await modelDerivativeService.getAllModelProperties(
          file.apsUrn,
        );

        const results = validationService.validateModel(
          specs,
          modelProps.data.collection,
          { name: file.name, id: file.id, urn: file.apsUrn },
        );

        allResults = [...allResults, ...results];
      } catch (err) {
        logger.error(`[VALIDATION] Failed to process model ${file.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4. Save Issues (Failures/Warnings)
    const issuesData = allResults
      .filter((r) => r.status !== "PASS")
      .map((r) => ({
        validationRunId: validationRun.id,
        type: r.status === "FAIL" ? "MISMATCH" : "UNDOCUMENTED",
        severity: r.status === "FAIL" ? "HIGH" : "MEDIUM",
        status: "OPEN",
        message: `${r.property}: Expected ${r.expectedValue}, Found ${r.actualValue}`,
        expectedValue: String(r.expectedValue),
        actualValue: String(r.actualValue),
        elementId: r.elementId,
        elementTag: r.elementName,
      }));

    if (issuesData.length > 0) {
      await prisma.validationIssue.createMany({
        data: issuesData,
      });
    }

    // 5. Update Run Status
    const summary = {
      total: allResults.length,
      pass: allResults.filter((r) => r.status === "PASS").length,
      fail: allResults.filter((r) => r.status === "FAIL").length,
      warning: allResults.filter((r) => r.status === "WARNING").length,
    };

    await prisma.validationRun.update({
      where: { id: validationRun.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalElements: summary.total,
        mismatchCount: summary.fail,
        undocumentedCount: summary.warning,
      },
    });

    res.json({
      runId: validationRun.id,
      summary,
      results: allResults,
    });
  }),
);

export default router;

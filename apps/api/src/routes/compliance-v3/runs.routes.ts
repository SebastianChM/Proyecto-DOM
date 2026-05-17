import { Router, Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { badRequest, notFound } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { complianceRunnerV3Service } from "../../services/compliance-v3/compliance-runner-v3.service";
import { reportService } from "../../services/reporting/report.service";
import prisma from "../../lib/prisma";
import {
  projectIdParamSchema,
  runIdParamSchema,
  evaluateSchema,
  listRunsQuerySchema,
  runIssuesQuerySchema,
} from "./schemas";

const router = Router();

function getUserId(req: Request): string | undefined {
  return req.session?.user?.id;
}

// POST /projects/:projectId/compliance/evaluate
router.post(
  "/projects/:projectId/compliance/evaluate",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = projectIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const bodyResult = evaluateSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw badRequest(
        "Validation failed",
        "VALIDATION_ERROR",
        bodyResult.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { projectId } = paramResult.data;
    const { modelUrn, discipline, dryRun } = bodyResult.data;

    logger.info("[RunsRoutes] Evaluate request", {
      projectId,
      modelUrn,
      discipline,
      dryRun,
    });

    const result = await complianceRunnerV3Service.evaluate(
      projectId,
      modelUrn,
      { discipline, dryRun },
      getUserId(req),
    );

    res.status(202).json(result);
  }),
);

// GET /compliance/runs/:runId
router.get(
  "/compliance/runs/:runId",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = runIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid runId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const { runId } = paramResult.data;
    const run = await complianceRunnerV3Service.getRunById(runId);

    logger.info("[RunsRoutes] Get run", { runId });

    res.json(run);
  }),
);

// GET /projects/:projectId/compliance/runs
router.get(
  "/projects/:projectId/compliance/runs",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = projectIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid projectId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const queryResult = listRunsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw badRequest(
        "Invalid query parameters",
        "VALIDATION_ERROR",
        queryResult.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { projectId } = paramResult.data;
    const { page, limit } = queryResult.data;

    logger.info("[RunsRoutes] List runs", { projectId, page, limit });

    const result = await complianceRunnerV3Service.listRunsByProject(
      projectId,
      { page, limit },
    );

    res.json(result);
  }),
);

// GET /compliance/runs/:runId/issues
router.get(
  "/compliance/runs/:runId/issues",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = runIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid runId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const queryResult = runIssuesQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw badRequest(
        "Invalid query parameters",
        "VALIDATION_ERROR",
        queryResult.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      );
    }

    const { runId } = paramResult.data;
    const { page, limit, severity } = queryResult.data;

    logger.info("[RunsRoutes] Get run issues", {
      runId,
      page,
      limit,
      severity,
    });

    const result = await complianceRunnerV3Service.getRunIssues(
      runId,
      { severity },
      { page, limit },
    );

    res.json(result);
  }),
);

// DELETE /compliance/runs/:runId
router.delete(
  "/compliance/runs/:runId",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = runIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid runId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const { runId } = paramResult.data;
    logger.info("[RunsRoutes] Delete run", { runId });

    await complianceRunnerV3Service.deleteRun(runId);

    res.status(204).end();
  }),
);

// GET /compliance/runs/:runId/export?format=pdf
router.get(
  "/compliance/runs/:runId/export",
  asyncHandler(async (req: Request, res: Response) => {
    const paramResult = runIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      throw badRequest(
        "Invalid runId",
        "VALIDATION_ERROR",
        paramResult.error.issues,
      );
    }

    const { runId } = paramResult.data;
    const format = req.query.format ?? "pdf";

    if (format !== "pdf") {
      throw badRequest(
        `Unsupported export format: ${format}. Only 'pdf' is supported.`,
        "UNSUPPORTED_FORMAT",
      );
    }

    // Load run with project and config → packs
    const run = await prisma.complianceRun.findUnique({
      where: { id: runId },
      include: {
        config: { include: { packs: { select: { name: true } } } },
      },
    });
    if (!run) {
      throw notFound(`ComplianceRun not found: ${runId}`, "RUN_NOT_FOUND");
    }

    // Load all issues for this run (no pagination — PDF needs full data)
    const issues = await prisma.complianceIssue.findMany({
      where: { runId },
      orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    });

    // Fetch project name
    const project = await prisma.project.findUnique({
      where: { id: run.projectId },
      select: { name: true },
    });

    const metadata = (run.metadata as Record<string, unknown> | null) ?? {};
    const totalElements =
      typeof metadata.totalElements === "number"
        ? metadata.totalElements
        : (run.totalElements ?? 0);
    const score =
      typeof metadata.complianceScore === "number"
        ? Math.round(metadata.complianceScore)
        : Math.round(run.complianceScore ?? 0);

    const mapIssue = (i: (typeof issues)[number]) => ({
      ruleName: i.ruleName,
      elementName: i.elementName,
      elementCategory: i.elementCategory,
      propertyName: i.propertyName,
      expectedValue: i.expectedValue,
      actualValue: i.actualValue,
    });

    const pdfBuffer = await reportService.generateComplianceReport({
      runId,
      projectName: project?.name ?? run.projectId,
      packName:
        run.config?.packs?.map((p) => p.name).join(", ") || "Compliance Pack",
      score,
      totalElements,
      criticalIssues: issues
        .filter((i) => i.severity === "CRITICAL")
        .map(mapIssue),
      warningIssues: issues
        .filter((i) => i.severity === "WARNING")
        .map(mapIssue),
      infoIssues: issues.filter((i) => i.severity === "INFO").map(mapIssue),
      generatedAt: new Date().toLocaleString("es-CL", {
        timeZone: "America/Santiago",
      }),
    });

    logger.info("[RunsRoutes] Compliance PDF exported", {
      runId,
      issueCount: issues.length,
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="compliance-${runId}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  }),
);

export default router;

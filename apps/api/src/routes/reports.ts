import { Router } from "express";
import prisma from "../lib/prisma";
import { reportService } from "../services/reporting/report.service";
import { ValidationIssue } from "@prisma/client";
import { asyncHandler } from "../lib/async-handler";
import { notFound } from "../lib/errors";

const router = Router();

// GET /api/reports/validation/:runId
router.get("/validation/:runId", asyncHandler(async (req, res) => {
    const { runId } = req.params;

    // 1. Fetch Data
    const run = await prisma.validationRun.findUnique({
      where: { id: runId },
      include: {
        issues: {
          orderBy: { severity: "desc" },
        },
      },
    });

    if (!run) {
      throw notFound("Validation run not found", "VALIDATION_RUN_NOT_FOUND");
    }

    // Fetch Project Name separately since relation is not defined in ValidationRun model for inclusion
    let projectName = "Unknown Project";
    if (run.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: run.projectId },
        select: { name: true },
      });
      if (project) projectName = project.name;
    }

    // 2. Prepare Data for Template
    const reportData = {
      projectName: projectName,
      generatedAt: new Date().toLocaleDateString(),
      runId: run.id.substring(0, 8),
      totalIssues: run.issues.length,
      missingCount: run.issues.filter(
        (i: ValidationIssue) => i.type === "MISSING_IN_MODEL",
      ).length,
      mismatchCount: run.issues.filter(
        (i: ValidationIssue) => i.type === "PROPERTY_MISMATCH",
      ).length,
      undocumentedCount: run.issues.filter(
        (i: ValidationIssue) => i.type === "UNDOCUMENTED_IN_TABLE",
      ).length,
      issues: run.issues.map((i: ValidationIssue) => ({
        elementTag: i.elementId || "N/A",
        elementType: i.elementType || "Unknown",
        severity: i.severity, // HIGH, MEDIUM, LOW
        message: i.message,
        description: i.description,
        expectedValue: i.expectedValue,
        actualValue: i.actualValue,
      })),
    };

    // 3. Generate PDF
    const pdfBuffer = await reportService.generateValidationReport(reportData);

    // 4. Send Response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=validation-report-${runId.substring(0, 8)}.pdf`,
    );
    res.send(pdfBuffer);
}));

export default router;

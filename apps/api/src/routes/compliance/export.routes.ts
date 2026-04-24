/**
 * Compliance Export API
 *
 * Endpoints for exporting compliance results to Excel and PDF
 * Part of Compliance Engine V2 - Hito 6
 */

import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { asyncHandler } from "../../lib/async-handler";
import { notFound } from "../../lib/errors";
import PDFDocument from "pdfkit";

const router = Router();

/**
 * GET /api/compliance-v2/export/:runId/excel
 * Export compliance run results to Excel format (CSV for simplicity)
 */
router.get("/:runId/excel", asyncHandler(async (req: Request, res: Response) => {
    const runId = req.params.runId as string;

    const run = await prisma.complianceRun.findUnique({
      where: { id: runId },
      include: {
        ruleset: true,
        issues: {
          orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
        },
      },
    });

    if (!run) {
      throw notFound("Run not found", "RUN_NOT_FOUND");
    }

    // Generate CSV content
    const csvRows: string[] = [];

    // Header row
    csvRows.push(
      [
        "Severidad",
        "Regla",
        "Elemento ID",
        "Elemento Nombre",
        "Categoría",
        "Propiedad",
        "Valor Esperado",
        "Valor Actual",
        "Desviación",
        "Estado",
      ].join(","),
    );

    // Data rows
    for (const issue of run.issues) {
      csvRows.push(
        [
          issue.severity,
          `"${issue.ruleName.replace(/"/g, '""')}"`,
          issue.elementId,
          `"${issue.elementName.replace(/"/g, '""')}"`,
          `"${issue.elementCategory.replace(/"/g, '""')}"`,
          issue.propertyName,
          `"${issue.expectedValue.replace(/"/g, '""')}"`,
          `"${issue.actualValue.replace(/"/g, '""')}"`,
          issue.deviation || "",
          issue.status,
        ].join(","),
      );
    }

    const csvContent = csvRows.join("\n");

    // Send as downloadable file
    const filename = `compliance_${run.ruleset.name.replace(/\s+/g, "_")}_${new Date(run.startedAt).toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
}));

/**
 * GET /api/compliance-v2/export/:runId/pdf
 * Export compliance run results to PDF format
 */
router.get("/:runId/pdf", asyncHandler(async (req: Request, res: Response) => {
    const runId = req.params.runId as string;

    const run = await prisma.complianceRun.findUnique({
      where: { id: runId },
      include: {
        ruleset: true,
        issues: {
          orderBy: [{ severity: "asc" }, { elementCategory: "asc" }],
        },
      },
    });

    if (!run) {
      throw notFound("Run not found", "RUN_NOT_FOUND");
    }

    const errorIssues = run.issues.filter((i) => i.severity === "ERROR" || i.severity === "CRITICAL");
    const warningIssues = run.issues.filter((i) => i.severity === "WARNING");
    const infoIssues = run.issues.filter((i) => i.severity === "INFO");

    const filename = `compliance_report_${run.ruleset.name.replace(/\s+/g, "_")}_${new Date(run.startedAt).toISOString().split("T")[0]}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    doc.pipe(res);

    // ---- Header ----
    doc.rect(0, 0, 595, 120).fill("#2563eb");
    doc.fillColor("#ffffff").fontSize(22).text("Reporte de Compliance", 50, 35);
    doc.fontSize(11).text(`${run.ruleset.name} • ${new Date(run.startedAt).toLocaleDateString("es-CL")}`, 50, 62);
    doc.fontSize(28).text(`${run.complianceScore ?? 0}%`, 450, 35, { width: 100, align: "right" });
    doc.fontSize(9).text("Score", 450, 68, { width: 100, align: "right" });

    // Model info
    if (run.modelName) {
      doc.fillColor("#0369a1").fontSize(10).text(`Modelo: ${run.modelName}`, 50, 90);
    }

    // ---- Summary stats ----
    const statsY = 140;
    doc.fillColor("#1e293b").fontSize(14).text("Resumen", 50, statsY);

    const stats = [
      { label: "Elementos", value: String(run.totalElements ?? 0), color: "#1e293b" },
      { label: "Errores", value: String(errorIssues.length), color: "#dc2626" },
      { label: "Advertencias", value: String(warningIssues.length), color: "#d97706" },
      { label: "Info", value: String(infoIssues.length), color: "#2563eb" },
    ];

    stats.forEach((stat, i) => {
      const x = 50 + i * 125;
      doc.rect(x, statsY + 20, 110, 50).fill("#f8fafc").stroke("#e2e8f0");
      doc.fillColor(stat.color).fontSize(20).text(stat.value, x, statsY + 28, { width: 110, align: "center" });
      doc.fillColor("#64748b").fontSize(8).text(stat.label, x, statsY + 52, { width: 110, align: "center" });
    });

    // ---- Issues table ----
    let y = statsY + 90;
    doc.fillColor("#1e293b").fontSize(14).text(`Issues (${run.issues.length})`, 50, y);
    y += 25;

    // Table header
    const cols = [50, 120, 230, 370, 470];
    const colWidths = [70, 110, 140, 100, 80];
    const headers = ["Severidad", "Regla", "Elemento", "Esperado", "Actual"];

    doc.rect(50, y, 495, 18).fill("#f1f5f9");
    doc.fillColor("#475569").fontSize(8);
    headers.forEach((h, i) => doc.text(h, cols[i] + 4, y + 5, { width: colWidths[i] }));
    y += 18;

    // Table rows
    doc.fontSize(7);
    for (const issue of run.issues) {
      if (y > 750) {
        doc.addPage();
        y = 50;
        doc.rect(50, y, 495, 18).fill("#f1f5f9");
        doc.fillColor("#475569").fontSize(8);
        headers.forEach((h, i) => doc.text(h, cols[i] + 4, y + 5, { width: colWidths[i] }));
        y += 18;
        doc.fontSize(7);
      }

      doc.rect(50, y, 495, 0.5).fill("#e2e8f0");

      const sevColor = issue.severity === "ERROR" || issue.severity === "CRITICAL" ? "#dc2626" : issue.severity === "WARNING" ? "#d97706" : "#2563eb";
      doc.fillColor(sevColor).text(issue.severity, cols[0] + 4, y + 4, { width: colWidths[0] });
      doc.fillColor("#334155").text(issue.ruleName, cols[1] + 4, y + 4, { width: colWidths[1] });
      doc.text(`${issue.elementName}\n${issue.elementCategory}`, cols[2] + 4, y + 2, { width: colWidths[2] });
      doc.text(issue.expectedValue, cols[3] + 4, y + 4, { width: colWidths[3] });
      doc.fillColor("#dc2626").text(issue.actualValue, cols[4] + 4, y + 4, { width: colWidths[4] });

      y += 22;
    }

    if (run.issues.length === 0) {
      doc.fillColor("#16a34a").fontSize(12).text("✓ Todos los elementos cumplen con las reglas", 50, y + 10, { align: "center", width: 495 });
    }

    // ---- Footer ----
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#94a3b8").fontSize(8)
        .text(`DOM BIM Platform • Generado ${new Date().toLocaleDateString("es-CL")} • Página ${i + 1}/${pages.count}`, 50, 780, { width: 495, align: "center" });
    }

    doc.end();
}));

/**
 * PUT /api/compliance-v2/export/:runId/save
 * Save run with model version and notes for historical tracking
 */
router.put("/:runId/save", asyncHandler(async (req: Request, res: Response) => {
    const runId = req.params.runId as string;
    const { runName, modelVersion, modelName } = req.body;

    const updated = await prisma.complianceRun.update({
      where: { id: runId },
      data: {
        name: runName ? `${runName} (${modelVersion})` : modelVersion,
        modelName: modelName || undefined,
      },
    });

    res.json({
      success: true,
      message: "Validación guardada en el historial",
      run: updated,
    });
}));

export default router;

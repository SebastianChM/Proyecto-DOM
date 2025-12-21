/**
 * Compliance Export API
 *
 * Endpoints for exporting compliance results to Excel and PDF
 * Part of Compliance Engine V2 - Hito 6
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

/**
 * GET /api/compliance-v2/export/:runId/excel
 * Export compliance run results to Excel format (CSV for simplicity)
 */
router.get("/:runId/excel", async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

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
      return res.status(404).json({ error: "Run not found" });
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
  } catch (error: unknown) {
    console.error("[ExportAPI] Excel export error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/compliance-v2/export/:runId/pdf
 * Export compliance run results to PDF format (HTML for now)
 */
router.get("/:runId/pdf", async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

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
      return res.status(404).json({ error: "Run not found" });
    }

    // Group issues by severity
    const criticalIssues = run.issues.filter((i) => i.severity === "CRITICAL");
    const warningIssues = run.issues.filter((i) => i.severity === "WARNING");
    const infoIssues = run.issues.filter((i) => i.severity === "INFO");

    // Generate HTML report
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Compliance - ${run.ruleset.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 40px; line-height: 1.5; }
        .container { max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 40px; border-radius: 12px 12px 0 0; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .score-box { display: inline-block; background: white; color: #2563eb; padding: 12px 24px; border-radius: 8px; margin-top: 20px; }
        .score-box .score { font-size: 32px; font-weight: bold; }
        .score-box .label { font-size: 12px; color: #64748b; }
        .content { padding: 40px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .stat { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
        .stat .value { font-size: 24px; font-weight: bold; color: #1e293b; }
        .stat .label { font-size: 12px; color: #64748b; }
        .stat.critical .value { color: #dc2626; }
        .stat.warning .value { color: #d97706; }
        .stat.info .value { color: #2563eb; }
        h2 { color: #1e293b; margin-bottom: 16px; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
        th { background: #f1f5f9; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
        tr:hover td { background: #f8fafc; }
        .severity { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
        .severity.critical { background: #fef2f2; color: #dc2626; }
        .severity.warning { background: #fffbeb; color: #d97706; }
        .severity.info { background: #eff6ff; color: #2563eb; }
        .footer { background: #f8fafc; padding: 24px 40px; border-radius: 0 0 12px 12px; text-align: center; color: #64748b; font-size: 12px; }
        .model-info { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
        .model-info h3 { color: #0369a1; font-size: 14px; margin-bottom: 8px; }
        .model-info p { color: #0c4a6e; font-size: 13px; }
        @media print { body { padding: 0; } .container { box-shadow: none; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Reporte de Validación de Compliance</h1>
            <p>${run.ruleset.name} • ${new Date(run.startedAt).toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            <div class="score-box">
                <div class="score">${run.complianceScore}%</div>
                <div class="label">Puntuación de Compliance</div>
            </div>
        </div>
        
        <div class="content">
            ${
              run.modelName
                ? `
            <div class="model-info">
                <h3>📁 Información del Modelo</h3>
                <p><strong>Modelo:</strong> ${run.modelName}</p>
                ${run.name ? `<p><strong>Versión:</strong> ${run.name}</p>` : ""}
            </div>
            `
                : ""
            }
            
            <div class="summary">
                <div class="stat">
                    <div class="value">${run.totalElements}</div>
                    <div class="label">Elementos Analizados</div>
                </div>
                <div class="stat critical">
                    <div class="value">${criticalIssues.length}</div>
                    <div class="label">Críticos</div>
                </div>
                <div class="stat warning">
                    <div class="value">${warningIssues.length}</div>
                    <div class="label">Advertencias</div>
                </div>
                <div class="stat info">
                    <div class="value">${infoIssues.length}</div>
                    <div class="label">Informativos</div>
                </div>
            </div>

            <h2>📊 Detalle de Issues (${run.issues.length} encontrados)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Severidad</th>
                        <th>Regla</th>
                        <th>Elemento</th>
                        <th>Esperado</th>
                        <th>Actual</th>
                    </tr>
                </thead>
                <tbody>
                    ${run.issues
                      .map(
                        (issue) => `
                    <tr>
                        <td><span class="severity ${issue.severity.toLowerCase()}">${issue.severity}</span></td>
                        <td>${issue.ruleName}</td>
                        <td>
                            <strong>${issue.elementName}</strong><br>
                            <small style="color:#64748b">${issue.elementCategory}</small>
                        </td>
                        <td>${issue.expectedValue}</td>
                        <td style="color:#dc2626">${issue.actualValue}</td>
                    </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            Generado por DOM BIM Platform • ${new Date().toLocaleDateString("es-CL")} ${new Date().toLocaleTimeString("es-CL")}
        </div>
    </div>
</body>
</html>
        `;

    const filename = `compliance_report_${run.ruleset.name.replace(/\s+/g, "_")}_${new Date(run.startedAt).toISOString().split("T")[0]}.html`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(htmlContent);
  } catch (error: unknown) {
    console.error("[ExportAPI] PDF (HTML) export error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/compliance-v2/export/:runId/save
 * Save run with model version and notes for historical tracking
 */
router.put("/:runId/save", async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
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
  } catch (error: unknown) {
    console.error("[ExportAPI] Save error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

import puppeteer from "puppeteer";
import handlebars from "handlebars";
import fs from "fs-extra";
import path from "path";
import { logger } from "../../lib/logger";

export interface ComplianceIssueRow {
  ruleName: string;
  elementName: string;
  elementCategory: string;
  propertyName: string;
  expectedValue: string;
  actualValue: string;
}

export interface ComplianceReportData {
  runId: string;
  projectName: string;
  packName: string;
  score: number;
  totalElements: number;
  criticalIssues: ComplianceIssueRow[];
  warningIssues: ComplianceIssueRow[];
  infoIssues: ComplianceIssueRow[];
  generatedAt: string;
}

export class ReportService {
  private templatePath: string;
  private complianceTemplatePath: string;

  constructor() {
    this.templatePath = path.join(
      __dirname,
      "../../templates/validation-report.hbs",
    );
    this.complianceTemplatePath = path.join(
      __dirname,
      "../../templates/compliance-report.hbs",
    );
  }

  /**
   * Generates a PDF buffer from the validation data.
   * @param data The data object to inject into the template
   * @returns Buffer containing the PDF data
   */
  async generateValidationReport(
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    try {
      // 1. Compile Template
      const templateHtml = await fs.readFile(this.templatePath, "utf-8");
      const template = handlebars.compile(templateHtml);
      const html = template(data);

      // 2. Launch Browser (Headless)
      // Note: In Docker/Production, you might need specific args like '--no-sandbox'
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // 3. Set Content and Render
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          bottom: "20mm",
          left: "20mm",
          right: "20mm",
        },
      });

      await browser.close();

      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error("[REPORT] Failed to generate PDF report", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Report generation failed");
    }
  }

  async generateComplianceReport(data: ComplianceReportData): Promise<Buffer> {
    const scoreColor =
      data.score >= 80 ? "#2e7d32" : data.score >= 50 ? "#e65100" : "#c62828";
    const criticalCount = data.criticalIssues.length;
    const warningCount = data.warningIssues.length;
    const infoCount = data.infoIssues.length;
    const hasIssues = criticalCount + warningCount + infoCount > 0;

    const templateData = {
      ...data,
      scoreColor,
      criticalCount,
      warningCount,
      infoCount,
      hasIssues,
    };

    try {
      const templateHtml = await fs.readFile(
        this.complianceTemplatePath,
        "utf-8",
      );
      const template = handlebars.compile(templateHtml);
      const html = template(templateData);

      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      });

      await browser.close();

      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error("[REPORT] Failed to generate compliance PDF", {
        runId: data.runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Compliance report generation failed");
    }
  }
}

export const reportService = new ReportService();

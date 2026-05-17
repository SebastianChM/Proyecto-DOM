import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import handlebars from "handlebars";
import fs from "fs-extra";
import path from "path";
import { logger } from "../../lib/logger";

const PDF_TIMEOUT_MS = 30_000; // explicit, auditable, matches Puppeteer default

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

  // Lazy-loaded compiled template cache — compiled once on first use,
  // then reused for every subsequent request (no disk I/O, no AST parse).
  private readonly templateCache = new Map<
    string,
    ReturnType<typeof handlebars.compile>
  >();

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

  /** Returns a compiled Handlebars template, reading from disk only once. */
  private async getCompiledTemplate(
    templatePath: string,
  ): Promise<ReturnType<typeof handlebars.compile>> {
    if (!this.templateCache.has(templatePath)) {
      const source = await fs.readFile(templatePath, "utf-8");
      this.templateCache.set(templatePath, handlebars.compile(source));
    }
    return this.templateCache.get(templatePath)!;
  }

  /**
   * Generates a PDF buffer from the validation data.
   * @param data The data object to inject into the template
   * @returns Buffer containing the PDF data
   */
  async generateValidationReport(
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    const template = await this.getCompiledTemplate(this.templatePath);
    const html = template(data);

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: PDF_TIMEOUT_MS,
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
        timeout: PDF_TIMEOUT_MS,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error("[REPORT] Failed to generate PDF report", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Report generation failed");
    } finally {
      // Always close the browser — prevents zombie Chrome processes on errors.
      if (browser) {
        await browser.close().catch((closeErr: unknown) => {
          logger.warn(
            "[REPORT] Failed to close browser after validation report",
            {
              error:
                closeErr instanceof Error ? closeErr.message : String(closeErr),
            },
          );
        });
      }
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

    let browser: Browser | null = null;
    try {
      const template = await this.getCompiledTemplate(
        this.complianceTemplatePath,
      );
      const html = template(templateData);

      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: PDF_TIMEOUT_MS,
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
        timeout: PDF_TIMEOUT_MS,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error("[REPORT] Failed to generate compliance PDF", {
        runId: data.runId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Compliance report generation failed");
    } finally {
      // Always close the browser — prevents zombie Chrome processes on errors.
      if (browser) {
        await browser.close().catch((closeErr: unknown) => {
          logger.warn(
            "[REPORT] Failed to close browser after compliance report",
            {
              error:
                closeErr instanceof Error ? closeErr.message : String(closeErr),
            },
          );
        });
      }
    }
  }
}

export const reportService = new ReportService();

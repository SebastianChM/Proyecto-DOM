/**
 * Data Extractor Service v2
 *
 * Extracts structured data (tables) from PDF and Excel files
 * Part of Compliance Engine V2 - Professional Rule-Based Validation
 */

// pdf-parse v1.1.1 - simple function-based API

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import * as fs from "fs";
import ExcelJS from "exceljs";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

export interface ExtractedTable {
  name: string;
  page?: number;
  headers: string[];
  rows: Record<string, string>[];
  confidence: number;
}

export interface ExtractionResult {
  success: boolean;
  documentName: string;
  documentType: "PDF" | "EXCEL";
  tables: ExtractedTable[];
  metadata: {
    totalPages?: number;
    extractedAt: Date;
    rawTextLength?: number;
  };
  errors?: string[];
}

export class DataExtractorService {
  /**
   * Extract tables from a PDF file
   */
  async extractFromPDF(
    filePath: string,
    documentName: string,
  ): Promise<ExtractionResult> {
    logger.info(`[DATA_EXTRACTOR] Extracting from PDF: ${documentName}`);

    try {
      const dataBuffer = fs.readFileSync(filePath);

      // pdf-parse v1.1.1 - simple function call
      const pdfData = await pdfParse(dataBuffer);

      const text = pdfData.text || "";
      const numPages = pdfData.numpages || 1;
      const lines = text
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      logger.info(
        `[DATA_EXTRACTOR] PDF has ${numPages} pages, ${lines.length} lines`,
      );

      // Extract tables using heuristics
      const tables = this.extractTablesFromText(lines);

      return {
        success: true,
        documentName,
        documentType: "PDF",
        tables,
        metadata: {
          totalPages: pdfData.numpages,
          extractedAt: new Date(),
          rawTextLength: text.length,
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("[DATA_EXTRACTOR] PDF extraction error", {
        error: err.message,
      });
      return {
        success: false,
        documentName,
        documentType: "PDF",
        tables: [],
        metadata: { extractedAt: new Date() },
        errors: [err.message],
      };
    }
  }

  /**
   * Extract tables from an Excel file using exceljs
   */
  async extractFromExcel(
    filePath: string,
    documentName: string,
  ): Promise<ExtractionResult> {
    logger.info(`[DATA_EXTRACTOR] Extracting from Excel: ${documentName}`);

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const tables: ExtractedTable[] = [];

      workbook.eachSheet((worksheet) => {
        const sheetName = worksheet.name;
        const rowCount = worksheet.rowCount;

        if (rowCount < 2) return; // Skip sheets with no data

        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value || "").trim();
        });

        // Filter out empty headers
        const validHeaders = headers.filter((h) => h.length > 0);
        if (validHeaders.length === 0) return;

        // Get data rows
        const rows: Record<string, string>[] = [];
        for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          const rowData: Record<string, string> = {};

          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header && cell.value !== null && cell.value !== undefined) {
              rowData[header] = String(cell.value);
            }
          });

          if (Object.keys(rowData).length > 0) {
            rows.push(rowData);
          }
        }

        if (rows.length > 0) {
          tables.push({
            name: sheetName,
            headers: validHeaders,
            rows,
            confidence: 0.95, // Excel has clear structure
          });
        }
      });

      logger.info(
        `[DATA_EXTRACTOR] Extracted ${tables.length} tables from Excel`,
      );

      return {
        success: true,
        documentName,
        documentType: "EXCEL",
        tables,
        metadata: {
          extractedAt: new Date(),
        },
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("[DATA_EXTRACTOR] Excel extraction error", {
        error: err.message,
      });
      return {
        success: false,
        documentName,
        documentType: "EXCEL",
        tables: [],
        metadata: { extractedAt: new Date() },
        errors: [err.message],
      };
    }
  }

  /**
   * Extract tables from text lines using heuristics
   */
  private extractTablesFromText(lines: string[]): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    let currentTable: ExtractedTable | null = null;
    let tableCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect potential table headers
      if (this.looksLikeTableHeader(line)) {
        // Save previous table if exists
        if (currentTable && currentTable.rows.length > 0) {
          tables.push(currentTable);
        }

        tableCount++;
        const headers = this.parseColumns(line);
        currentTable = {
          name: `Table ${tableCount}`,
          headers,
          rows: [],
          confidence: 0.7,
        };
        continue;
      }

      // If we have a current table, try to parse data rows
      if (currentTable) {
        const row = this.parseDataRow(line, currentTable.headers);
        if (row) {
          currentTable.rows.push(row);
        } else if (this.looksLikeEndOfTable(line)) {
          // End current table
          if (currentTable.rows.length > 0) {
            tables.push(currentTable);
          }
          currentTable = null;
        }
      }
    }

    // Don't forget the last table
    if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
    }

    logger.info(`[DATA_EXTRACTOR] Found ${tables.length} tables in text`);
    return tables;
  }

  /**
   * Check if a line looks like a table header
   */
  private looksLikeTableHeader(line: string): boolean {
    const headerPatterns = [
      /código|code|item|ref/i,
      /descripción|description|nombre|name/i,
      /ancho|width|w\b/i,
      /alto|height|h\b/i,
      /voltaje|voltage|v\b/i,
      /potencia|power|watt/i,
      /cantidad|qty|quantity/i,
      /unidad|unit|uom/i,
    ];

    const matches = headerPatterns.filter((p) => p.test(line));
    return matches.length >= 2;
  }

  /**
   * Parse columns from a line
   */
  private parseColumns(line: string): string[] {
    // Split by tabs, multiple spaces, or pipes
    const columns = line
      .split(/\t|\s{2,}|\|/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    return columns.map((c) => this.normalizeColumnName(c));
  }

  /**
   * Normalize column names to standard keys
   */
  private normalizeColumnName(name: string): string {
    const mappings: Record<string, string> = {
      código: "code",
      code: "code",
      item: "code",
      ref: "code",
      descripción: "description",
      description: "description",
      nombre: "name",
      name: "name",
      ancho: "width",
      width: "width",
      alto: "height",
      height: "height",
      largo: "length",
      length: "length",
      voltaje: "voltage",
      voltage: "voltage",
      corriente: "current",
      current: "current",
      potencia: "power",
      power: "power",
      cantidad: "quantity",
      qty: "quantity",
      quantity: "quantity",
      unidad: "unit",
      unit: "unit",
      uom: "unit",
    };

    const key = name.toLowerCase().trim();
    return mappings[key] || name;
  }

  /**
   * Parse a data row based on expected columns
   */
  private parseDataRow(
    line: string,
    headers: string[],
  ): Record<string, string> | null {
    const values = line
      .split(/\t|\s{2,}|\|/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    // Need at least some values
    if (values.length < Math.floor(headers.length * 0.5)) {
      return null;
    }

    const row: Record<string, string> = {};
    for (let i = 0; i < Math.min(values.length, headers.length); i++) {
      if (headers[i] && values[i]) {
        row[headers[i]] = values[i];
      }
    }

    return Object.keys(row).length > 0 ? row : null;
  }

  /**
   * Check if line indicates end of table
   */
  private looksLikeEndOfTable(line: string): boolean {
    // Section headers
    if (/^\d+\.\s+[A-ZÁÉÍÓÚ]/.test(line)) return true;
    // Footnotes
    if (/^nota:|^note:|^\*/i.test(line)) return true;
    // Very short lines
    if (line.length < 5) return true;
    return false;
  }

  /**
   * Save extraction result to database
   */
  async saveDataSource(
    projectId: string,
    result: ExtractionResult,
    fileId?: string,
  ): Promise<string> {
    const dataSource = await prisma.dataSource.create({
      data: {
        name: result.documentName,
        type: result.documentType,
        status: result.success ? "EXTRACTED" : "FAILED",
        fileId,
        extractedData: JSON.stringify({
          tables: result.tables,
          metadata: result.metadata,
          errors: result.errors,
        }),
        extractedAt: new Date(),
        projectId,
      },
    });

    logger.info(`[DATA_EXTRACTOR] Saved DataSource: ${dataSource.id}`);
    return dataSource.id;
  }

  /**
   * Get data source by ID
   */
  async getDataSource(id: string) {
    const dataSource = await prisma.dataSource.findUnique({
      where: { id },
    });

    if (dataSource && dataSource.extractedData) {
      return {
        ...dataSource,
        extractedData: JSON.parse(dataSource.extractedData) as Record<
          string,
          unknown
        >,
      };
    }

    return dataSource;
  }
}

export const dataExtractorService = new DataExtractorService();

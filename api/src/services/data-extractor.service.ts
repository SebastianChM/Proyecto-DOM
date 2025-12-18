/**
 * Data Extractor Service v2
 * 
 * Extracts structured data (tables) from PDF and Excel files
 * Part of Compliance Engine V2 - Professional Rule-Based Validation
 */

// pdf-parse v1.1.1 - simple function-based API
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Lazy load xlsx to avoid module resolution issues in monorepo
let XLSX: any = null;
const getXLSX = () => {
    if (!XLSX) {
        try {
            XLSX = require('xlsx');
        } catch (e) {
            console.warn('[DataExtractor] xlsx module not available - Excel extraction disabled');
        }
    }
    return XLSX;
};

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
    documentType: 'PDF' | 'EXCEL';
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
    async extractFromPDF(filePath: string, documentName: string): Promise<ExtractionResult> {
        console.log(`[DataExtractor] Extracting from PDF: ${documentName}`);

        try {
            const dataBuffer = fs.readFileSync(filePath);

            // pdf-parse v1.1.1 - simple function call
            const pdfData = await pdfParse(dataBuffer);

            const text = pdfData.text || '';
            const numPages = pdfData.numpages || 1;
            const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

            console.log(`[DataExtractor] PDF has ${numPages} pages, ${lines.length} lines`);

            // Extract tables using heuristics
            const tables = this.extractTablesFromText(lines);

            return {
                success: true,
                documentName,
                documentType: 'PDF',
                tables,
                metadata: {
                    totalPages: pdfData.numpages,
                    extractedAt: new Date(),
                    rawTextLength: text.length
                }
            };
        } catch (error: any) {
            console.error('[DataExtractor] PDF extraction error:', error.message);
            return {
                success: false,
                documentName,
                documentType: 'PDF',
                tables: [],
                metadata: { extractedAt: new Date() },
                errors: [error.message]
            };
        }
    }

    /**
     * Extract tables from an Excel file
     */
    async extractFromExcel(filePath: string, documentName: string): Promise<ExtractionResult> {
        console.log(`[DataExtractor] Extracting from Excel: ${documentName}`);

        try {
            const xlsx = getXLSX();
            if (!xlsx) {
                return {
                    success: false,
                    documentName,
                    documentType: 'EXCEL',
                    tables: [],
                    metadata: { extractedAt: new Date() },
                    errors: ['xlsx module not available - please install xlsx package']
                };
            }

            const workbook = xlsx.readFile(filePath);
            const tables: ExtractedTable[] = [];

            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (jsonData.length < 2) continue; // Skip sheets with no data

                // First row is headers
                const headers = (jsonData[0] as any[]).map(h => String(h || '').trim());

                // Rest are data rows
                const rows: Record<string, string>[] = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i] as any[];
                    if (!rowData || rowData.length === 0) continue;

                    const row: Record<string, string> = {};
                    headers.forEach((header, idx) => {
                        if (header && rowData[idx] !== undefined) {
                            row[header] = String(rowData[idx]);
                        }
                    });

                    if (Object.keys(row).length > 0) {
                        rows.push(row);
                    }
                }

                if (rows.length > 0) {
                    tables.push({
                        name: sheetName,
                        headers: headers.filter(h => h),
                        rows,
                        confidence: 0.95 // Excel has clear structure
                    });
                }
            }

            console.log(`[DataExtractor] Extracted ${tables.length} tables from Excel`);

            return {
                success: true,
                documentName,
                documentType: 'EXCEL',
                tables,
                metadata: {
                    extractedAt: new Date()
                }
            };
        } catch (error: any) {
            console.error('[DataExtractor] Excel extraction error:', error.message);
            return {
                success: false,
                documentName,
                documentType: 'EXCEL',
                tables: [],
                metadata: { extractedAt: new Date() },
                errors: [error.message]
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
                    confidence: 0.7
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

        console.log(`[DataExtractor] Found ${tables.length} tables in text`);
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
            /unidad|unit|uom/i
        ];

        const matches = headerPatterns.filter(p => p.test(line));
        return matches.length >= 2;
    }

    /**
     * Parse columns from a line
     */
    private parseColumns(line: string): string[] {
        // Split by tabs, multiple spaces, or pipes
        const columns = line.split(/\t|\s{2,}|\|/)
            .map(c => c.trim())
            .filter(c => c.length > 0);

        return columns.map(c => this.normalizeColumnName(c));
    }

    /**
     * Normalize column names to standard keys
     */
    private normalizeColumnName(name: string): string {
        const mappings: Record<string, string> = {
            'código': 'code', 'code': 'code', 'item': 'code', 'ref': 'code',
            'descripción': 'description', 'description': 'description',
            'nombre': 'name', 'name': 'name',
            'ancho': 'width', 'width': 'width',
            'alto': 'height', 'height': 'height',
            'largo': 'length', 'length': 'length',
            'voltaje': 'voltage', 'voltage': 'voltage',
            'corriente': 'current', 'current': 'current',
            'potencia': 'power', 'power': 'power',
            'cantidad': 'quantity', 'qty': 'quantity', 'quantity': 'quantity',
            'unidad': 'unit', 'unit': 'unit', 'uom': 'unit'
        };

        const key = name.toLowerCase().trim();
        return mappings[key] || name;
    }

    /**
     * Parse a data row based on expected columns
     */
    private parseDataRow(line: string, headers: string[]): Record<string, string> | null {
        const values = line.split(/\t|\s{2,}|\|/)
            .map(v => v.trim())
            .filter(v => v.length > 0);

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
        fileId?: string
    ): Promise<string> {
        const dataSource = await prisma.dataSource.create({
            data: {
                name: result.documentName,
                type: result.documentType,
                status: result.success ? 'EXTRACTED' : 'FAILED',
                fileId,
                extractedData: JSON.stringify({
                    tables: result.tables,
                    metadata: result.metadata,
                    errors: result.errors
                }),
                extractedAt: new Date(),
                projectId
            }
        });

        console.log(`[DataExtractor] Saved DataSource: ${dataSource.id}`);
        return dataSource.id;
    }

    /**
     * Get data source by ID
     */
    async getDataSource(id: string): Promise<any> {
        const dataSource = await prisma.dataSource.findUnique({
            where: { id }
        });

        if (dataSource && dataSource.extractedData) {
            return {
                ...dataSource,
                extractedData: JSON.parse(dataSource.extractedData)
            };
        }

        return dataSource;
    }
}

export const dataExtractorService = new DataExtractorService();

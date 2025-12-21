/**
 * Table Parser Service v2
 *
 * Extracts structured data from PDF tables instead of treating them as plain text.
 * Designed to handle electrical specification documents with tabular data.
 */

export interface TableRow {
  rowIndex: number;
  cells: Record<string, string>;
  rawText: string;
}

export interface ParsedTable {
  headers: string[];
  rows: TableRow[];
  page: number;
  confidence: number;
}

export interface StructuredRequirement {
  id: string;
  code: string; // e.g., "CT-001"
  description: string; // e.g., "Cable Tray Type A"
  parameter: string; // e.g., "width"
  operator: string; // e.g., ">="
  value: number;
  unit: string; // e.g., "mm"
  rawText: string;
  page: number;
  confidence: number;
}

export class TableParserService {
  // Common table header patterns in electrical specs
  private readonly HEADER_PATTERNS = [
    /código|code|item|ref/i,
    /descripción|description|nombre|name/i,
    /ancho|width|w/i,
    /alto|height|h/i,
    /largo|length|l/i,
    /voltaje|voltage|v/i,
    /corriente|current|a|amp/i,
    /potencia|power|w|watt/i,
    /cantidad|qty|quantity/i,
    /unidad|unit|uom/i,
    /especificación|specification|spec/i,
  ];

  // Patterns that indicate start of a table
  private readonly TABLE_START_PATTERNS = [
    /^\s*(?:código|code|item|ref)\s*$/i,
    /^[A-Z]{2,3}[-_]\d+/, // Code patterns like CT-001, EL-123
    /^\d+\.\d+\s+[A-Z]/, // Numbered sections
  ];

  /**
   * Detects if a line is likely a table header
   */
  isTableHeader(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    const matches = this.HEADER_PATTERNS.filter((p) => p.test(normalized));
    return matches.length >= 2; // At least 2 header-like columns
  }

  /**
   * Extracts tables from PDF text content
   * Uses heuristics to identify table structures
   */
  extractTables(textLines: { text: string; page: number }[]): ParsedTable[] {
    const tables: ParsedTable[] = [];
    let currentTable: ParsedTable | null = null;
    let currentHeaders: string[] = [];

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      const text = line.text.trim();

      if (!text) continue;

      // Detect table header
      if (this.isTableHeader(text)) {
        // Start new table
        if (currentTable && currentTable.rows.length > 0) {
          tables.push(currentTable);
        }
        currentHeaders = this.parseHeaderColumns(text);
        currentTable = {
          headers: currentHeaders,
          rows: [],
          page: line.page,
          confidence: 0.8,
        };
        continue;
      }

      // If we have a current table, try to parse rows
      if (currentTable && currentHeaders.length > 0) {
        const row = this.parseDataRow(text, currentHeaders, i);
        if (row) {
          currentTable.rows.push(row);
        } else if (this.looksLikeEndOfTable(text)) {
          // End of table detected
          if (currentTable.rows.length > 0) {
            tables.push(currentTable);
          }
          currentTable = null;
          currentHeaders = [];
        }
      }
    }

    // Don't forget the last table
    if (currentTable && currentTable.rows.length > 0) {
      tables.push(currentTable);
    }

    return tables;
  }

  /**
   * Parse header columns from a header line
   */
  private parseHeaderColumns(text: string): string[] {
    // Split by common delimiters: tabs, multiple spaces, pipes
    const columns = text
      .split(/\t|\s{2,}|\|/)
      .filter((c) => c.trim().length > 0);
    return columns.map((c) => this.normalizeColumnName(c.trim()));
  }

  /**
   * Normalize column names to standard keys
   */
  private normalizeColumnName(name: string): string {
    const n = name.toLowerCase();

    // Dimension mappings
    if (/ancho|width|w(?:idth)?/i.test(n)) return "width";
    if (/alto|height|h(?:eight)?/i.test(n)) return "height";
    if (/largo|length|l(?:ength)?/i.test(n)) return "length";
    if (/profund|depth|d(?:epth)?/i.test(n)) return "depth";

    // Electrical mappings
    if (/voltaje|voltage|v(?:olt)?/i.test(n)) return "voltage";
    if (/corriente|current|amp/i.test(n)) return "current";
    if (/potencia|power|watt/i.test(n)) return "power";

    // General mappings
    if (/código|code|item|ref/i.test(n)) return "code";
    if (/descripción|description|nombre|name/i.test(n)) return "description";
    if (/cantidad|qty|quantity/i.test(n)) return "quantity";
    if (/unidad|unit|uom/i.test(n)) return "unit";

    return name.toLowerCase().replace(/\s+/g, "_");
  }

  /**
   * Parse a data row based on expected columns
   */
  private parseDataRow(
    text: string,
    headers: string[],
    rowIndex: number,
  ): TableRow | null {
    // Split by common delimiters
    const values = text
      .split(/\t|\s{2,}|\|/)
      .filter((v) => v.trim().length > 0);

    // If we have significantly fewer values than headers, probably not a data row
    if (values.length < headers.length * 0.5) {
      return null;
    }

    const cells: Record<string, string> = {};
    for (let i = 0; i < Math.min(values.length, headers.length); i++) {
      cells[headers[i]] = values[i].trim();
    }

    return {
      rowIndex,
      cells,
      rawText: text,
    };
  }

  /**
   * Detect end of table (e.g., section title, empty lines, footnotes)
   */
  private looksLikeEndOfTable(text: string): boolean {
    // Section headers typically start with numbers
    if (/^\d+\.\s+[A-ZÁÉÍÓÚ]/.test(text)) return true;

    // Footnotes
    if (/^nota:|^note:|^\*/.test(text.toLowerCase())) return true;

    // Very short lines that aren't codes
    if (text.length < 5 && !/^[A-Z]{2,}[-_]\d+/.test(text)) return true;

    return false;
  }

  /**
   * Convert parsed tables to structured requirements
   */
  tablesToRequirements(tables: ParsedTable[]): StructuredRequirement[] {
    const requirements: StructuredRequirement[] = [];

    for (const table of tables) {
      for (const row of table.rows) {
        // Extract dimension requirements
        const dimensionParams = ["width", "height", "length", "depth"];

        for (const param of dimensionParams) {
          if (row.cells[param]) {
            const parsed = this.parseValueWithUnit(row.cells[param]);
            if (parsed) {
              requirements.push({
                id: crypto.randomUUID(),
                code:
                  row.cells["code"] ||
                  row.cells["item"] ||
                  `ROW-${row.rowIndex}`,
                description:
                  row.cells["description"] || row.cells["name"] || "",
                parameter: param,
                operator: "=", // From specs, usually exact match required
                value: parsed.value,
                unit: parsed.unit,
                rawText: row.rawText,
                page: table.page,
                confidence: table.confidence * 0.9,
              });
            }
          }
        }

        // Extract electrical requirements
        const electricalParams = ["voltage", "current", "power"];

        for (const param of electricalParams) {
          if (row.cells[param]) {
            const parsed = this.parseValueWithUnit(row.cells[param]);
            if (parsed) {
              requirements.push({
                id: crypto.randomUUID(),
                code: row.cells["code"] || `ROW-${row.rowIndex}`,
                description: row.cells["description"] || "",
                parameter: param,
                operator: ">=", // Electrical usually minimum specs
                value: parsed.value,
                unit: parsed.unit,
                rawText: row.rawText,
                page: table.page,
                confidence: table.confidence * 0.85,
              });
            }
          }
        }
      }
    }

    return requirements;
  }

  /**
   * Parse a value string to extract numeric value and unit
   */
  private parseValueWithUnit(
    text: string,
  ): { value: number; unit: string } | null {
    // Patterns: "300 mm", "300mm", "300", "≤ 300 mm"
    const match = text.match(
      /([<>=≤≥]*)?\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z²³]+)?/,
    );

    if (!match || !match[2]) return null;

    const value = parseFloat(match[2].replace(",", "."));
    const unit = match[3] || "";

    if (isNaN(value)) return null;

    return { value, unit };
  }
}

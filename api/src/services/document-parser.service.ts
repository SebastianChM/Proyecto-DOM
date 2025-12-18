import mammoth from "mammoth";
import fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

export interface ParsedDocument {
  text: string;
  metadata: Record<string, any>;
}

export interface SpecificationItem {
  category: string;
  property: string;
  value: string;
  section: string;
}

export class DocumentParserService {
  /**
   * Parses a document based on its file extension.
   */
  async parseDocument(
    filePath: string,
    mimeType: string,
  ): Promise<ParsedDocument> {
    if (mimeType === "application/pdf") {
      return this.parsePdf(filePath);
    } else if (
      mimeType.includes("wordprocessingml") ||
      mimeType.includes("msword")
    ) {
      return this.parseWord(filePath);
    } else if (mimeType === "text/plain") {
      return this.parseText(filePath);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  private async parsePdf(filePath: string): Promise<ParsedDocument> {
    const dataBuffer = fs.readFileSync(filePath);

    // Use the PDFParse class correctly (expects Uint8Array)
    // require('pdf-parse') returns an object { PDFParse: [Class] }
    const instance = new PDFParse(new Uint8Array(dataBuffer));
    await instance.load();

    // getText returns { text: string, pages: [...], total: number }
    const data = await instance.getText();
    const info = await instance.getInfo();

    return {
      text: data.text,
      metadata: {
        pages: data.total,
        info: info,
        version: "",
      },
    };
  }

  private async parseWord(filePath: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
      metadata: { messages: result.messages },
    };
  }

  private async parseText(filePath: string): Promise<ParsedDocument> {
    const text = fs.readFileSync(filePath, "utf-8");
    return {
      text: text,
      metadata: { type: "plain/text" },
    };
  }

  // --- Extraction Logic ---

  extractSpecifications(text: string): SpecificationItem[] {
    const specs: SpecificationItem[] = [];
    const lines = text.split("\n");

    let currentSection = "General";
    let currentCategory = "General";

    // Patterns
    const sectionRegex = /^SECTION\s+(\d+)\s+[-–]\s+(.+)$/i; // SECTION 03 30 00 - CAST-IN-PLACE CONCRETE
    const simpleSectionRegex = /^(\d+\.?\d*)\.?\s+([A-Z\s]+)$/; // 1. GENERAL REQUIREMENTS
    const categoryRegex = /^[A-Z][a-zA-Z\s]+$/; // CAPITALIZED WORDS (heuristic for category)

    // Property Patterns
    const propertyRegex = /^\s*[-•]?\s*([a-zA-Z0-9\s()]+)[:=]\s*(.+)$/; // e.g. Strength: 35 MPa
    const narrativeRegex =
      /^\s*([A-Z][a-zA-Z0-9\s()-]+?)\s+shall\s+be\s+(.+?)(?:,|$)/i; // "Max water-cement ratio shall be..."

    const pageNumberRegex = /^\d+\s*[-–]\s*\d+$/;

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      if (pageNumberRegex.test(cleanLine)) continue;

      // 1. Section Header
      const sectionMatch = cleanLine.match(sectionRegex);
      if (sectionMatch) {
        currentSection = `${sectionMatch[1]} ${sectionMatch[2]}`.trim();
        currentCategory = "General";
        continue;
      }
      const simpleMatch = cleanLine.match(simpleSectionRegex);
      if (simpleMatch) {
        currentSection = `${simpleMatch[1]}. ${simpleMatch[2]}`.trim();
        currentCategory = "General";
        continue;
      }

      // 2. Category
      if (
        categoryRegex.test(cleanLine) &&
        !cleanLine.includes("SECTION") &&
        cleanLine.length < 50
      ) {
        currentCategory = cleanLine
          .replace(/^[0-9.]+\s+/, "")
          .replace(/:$/, "")
          .trim();
        continue;
      }

      // 3. Property: Value
      const propMatch = cleanLine.match(propertyRegex);
      if (propMatch) {
        const key = propMatch[1].trim();
        const rawValue = propMatch[2].trim();
        if (
          key.length > 2 &&
          key.length < 50 &&
          rawValue.length > 0 &&
          !key.toLowerCase().includes("section")
        ) {
          specs.push({
            section: currentSection,
            category: this.normalizeCategory(currentCategory),
            property: key,
            value: this.cleanValue(rawValue),
          });
          continue;
        }
      }

      // 4. Narrative
      const narrativeMatch = cleanLine.match(narrativeRegex);
      if (narrativeMatch) {
        const key = narrativeMatch[1].trim();
        const rawValue = narrativeMatch[2].trim();
        if (key.length > 2 && key.length < 60 && rawValue.length > 0) {
          specs.push({
            section: currentSection,
            category: this.normalizeCategory(currentCategory),
            property: key,
            value: this.cleanValue(rawValue),
          });
        }
      }
    }
    return specs;
  }

  // --- Helpers ---

  private normalizeCategory(cat: string): string {
    // Map spec categories to likely Revit Categories if possible, or just clean them
    const upper = cat.toUpperCase();
    if (upper.includes("CONCRETE")) return "Structural Columns/Framing/Floors";
    if (upper.includes("DOOR")) return "Doors";
    if (upper.includes("WALL") || upper.includes("GYPSUM")) return "Walls";
    if (upper.includes("DUCT")) return "Ducts";
    return cat;
  }

  private cleanValue(val: string): string {
    // Normalize: "  200  mm " -> "200mm"
    // "12.5mm (1/2 inch)" -> "12.5mm" (prefer metric first part usually)
    return val.replace(/\s+/g, " ").trim();
  }
}

export const documentParserService = new DocumentParserService();

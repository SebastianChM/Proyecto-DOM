import mammoth from "mammoth";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

// Interfaces
export interface ParsedDocument {
  text: string;
  metadata: Record<string, unknown>;
}

export interface SpecificationItem {
  id?: string;
  category: string;
  property: string;
  value: string;
  section: string;
  sourceLine?: number;
  confidence?: number;
}

export class ParserService {
  /**
   * Parses a document based on its file extension.
   * Supports: PDF, DOCX, TXT
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

  // --- File Readers ---

  private async parsePdf(filePath: string): Promise<ParsedDocument> {
    const dataBuffer = fs.readFileSync(filePath);

    // Some versions of pdf-parse-fork return text directly or via PROMISE?
    // The original document-parser code used instance.load() pattern which is weird for standard pdf-parse.
    // Assuming standard behavior of popular libs or using the code that WORKED in document-parser.
    // Original: new PDFParse(Uint8Array)... instance.load()...
    // Let's stick to the previous implementation pattern if possible, but corrected types.

    // Actually, widespread 'pdf-parse' usage is: await pdf(dataBuffer)
    // But user might use a specific fork. I will trust the previous code's pattern but clean it up.
    // Reverting to the exact logic found in document-parser to minimize regression risk.

    try {
      const instance = new PDFParse(new Uint8Array(dataBuffer));
      await instance.load();
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
    } catch (e) {
      // Fallback or rethrow
      throw new Error(
        `PDF Parsing failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
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

  // --- Extraction Logic (Merged from document-parser & spec-parser) ---

  /**
   * Extracts specification items from raw text.
   * Uses mixed strategies: Narrative, Key-Value, and Structural context.
   */
  extractSpecifications(text: string): SpecificationItem[] {
    const specs: SpecificationItem[] = [];
    const lines = text.split("\n");

    let currentSection = "General";
    let currentCategory = "General";

    // Regex Patterns
    const sectionRegex = /^SECTION\s+(\d+)\s+[-–]\s+(.+)$/i;
    // Regex match variables are sometimes unused
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const simpleSectionRegex = /^(\d+\.?\d*)\.?\s+([A-Z\s]+)$/;

    const categoryRegex = /^[A-Z][a-zA-Z\s]+$/;

    // Property Patterns (Command & Narrative)
    const propertyRegex =
      /^\s*[-•]?\s*([a-zA-Z0-9\s().]{2,50})\s*(?:=|:|is)\s*(.+)$/i;
    const narrativeRegex =
      /([A-Z][a-zA-Z0-9\s]+?)\s+(shall be|must be|is required to be)\s+(.+?)(?:[.;]|$)/i;
    const limitRegex =
      /(Max|Min|Maximum|Minimum)\s+([A-Za-z0-9\s]+)\s+([0-9.,]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].trim();
      if (!cleanLine) continue;
      if (/^\d+\s*[-–]\s*\d+$/.test(cleanLine)) continue; // Page numbers

      // 1. Context Switch (Section)
      const sectionMatch = cleanLine.match(sectionRegex);
      if (sectionMatch) {
        currentSection = `${sectionMatch[1]} ${sectionMatch[2]}`.trim();
        currentCategory = "General";
        continue;
      }

      // 2. Context Switch (Category - Heuristic)
      if (
        categoryRegex.test(cleanLine) &&
        !cleanLine.includes("SECTION") &&
        cleanLine.length < 50
      ) {
        // Avoid matching all caps sentences usually
        currentCategory = cleanLine
          .replace(/^[0-9.]+\s+/, "")
          .replace(/:$/, "")
          .trim();
        continue;
      }

      // 3. Strategy A: Narrative ("The Concrete shall be C30")
      const narrativeMatch = cleanLine.match(narrativeRegex);
      if (narrativeMatch) {
        specs.push({
          id: uuidv4(),
          section: currentSection,
          category: this.normalizeCategory(currentCategory),
          property: narrativeMatch[1].trim(),
          value: this.cleanValue(narrativeMatch[3]),
          sourceLine: i + 1,
          confidence: 0.85,
        });
        continue;
      }

      // 4. Strategy B: Key-Value ("Strength: 30MPa")
      const propMatch = cleanLine.match(propertyRegex);
      if (propMatch) {
        const key = propMatch[1].trim();
        const val = propMatch[2].trim();
        // Noise filter
        if (
          key.length > 2 &&
          val.length > 0 &&
          !key.toLowerCase().includes("section")
        ) {
          specs.push({
            id: uuidv4(),
            section: currentSection,
            category: this.normalizeCategory(currentCategory),
            property: key,
            value: this.cleanValue(val),
            sourceLine: i + 1,
            confidence: 0.9,
          });
          continue;
        }
      }

      // 5. Strategy C: Limits ("Max Thickness 200")
      const limitMatch = cleanLine.match(limitRegex);
      if (limitMatch) {
        specs.push({
          id: uuidv4(),
          section: currentSection,
          category: this.normalizeCategory(currentCategory),
          property: `${limitMatch[1]} ${limitMatch[2]}`, // "Max Thickness"
          value: limitMatch[3],
          sourceLine: i + 1,
          confidence: 0.8,
        });
      }
    }

    return specs;
  }

  private normalizeCategory(cat: string): string {
    const upper = cat.toUpperCase();
    if (upper.includes("CONCRETE")) return "Structural Columns/Framing/Floors";
    if (upper.includes("DOOR")) return "Doors";
    if (upper.includes("WALL") || upper.includes("GYPSUM")) return "Walls";
    if (upper.includes("DUCT")) return "Ducts";
    return cat;
  }

  private cleanValue(val: string): string {
    return val.replace(/\s+/g, " ").trim();
  }
}

export const parserService = new ParserService();

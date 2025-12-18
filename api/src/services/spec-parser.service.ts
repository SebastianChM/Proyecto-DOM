import { v4 as uuidv4 } from "uuid";
import {
  UniversalRequirement,
  GrammarType,
  ExtractionResult,
} from "../types/spec-grammar.types";
import { UnitNormalizerService } from "./unit-normalizer.service";

export class SpecParserService {
  private normalizer = new UnitNormalizerService();

  /**
   * Parses text using multiple grammar strategies to find requirements.
   * This is designed to be format-agnostic (works for PDF extraction, Word, txt).
   */
  parse(text: string): ExtractionResult {
    const lines = text.split("\n");
    const requirements: UniversalRequirement[] = [];
    const startTime = Date.now();

    // 1. Context Tracking
    let currentCategory = "General";

    // 2. Grammar Strategies

    // A. Narrative Strategy: "Subject SHALL BE Value"
    // Captures: "The concrete grade shall be H-30"
    const narrativeRegex =
      /([A-Z][a-zA-Z0-9\s]+?)\s+(shall be|must be|is required to be|debe ser|será|deberá ser)\s+(.+?)(?:[.;]|$)/i;

    // B. Key-Value Strategy: "Parameter: Value" or "Parameter = Value"
    const keyValueRegex =
      /^([•-]?\s*[A-Z][a-zA-Z0-9\s().]{2,50})\s*(?:=|:)\s*([0-9.,]+\s*[A-Za-z%/]+)/i;

    // C. Numeric Limit Strategy: "Max/Min Parameter Value"
    // Captures: "Max Water Ratio 0.5", "Espesor Mínimo 20cm"
    const limitRegex =
      /(Max|Min|Máximo|Mínimo)\s+([A-Za-z0-9\s]+)\s+([0-9.,]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Heuristic context switch
      if (line.match(/^SECTION|SECCIÓN|ITEM|PARTIDA/i)) {
        currentCategory = line;
      }

      // Strategy A: Narrative
      const narrativeMatch = line.match(narrativeRegex);
      if (narrativeMatch) {
        requirements.push(
          this.createReq(
            i,
            line,
            GrammarType.NARRATIVE,
            narrativeMatch[1],
            narrativeMatch[2],
            narrativeMatch[3],
            currentCategory,
          ),
        );
        continue;
      }

      // Strategy B: Key-Value
      const kvMatch = line.match(keyValueRegex);
      if (kvMatch) {
        requirements.push(
          this.createReq(
            i,
            line,
            GrammarType.KEY_VALUE_PAIR,
            kvMatch[1],
            "EQUALS",
            kvMatch[2],
            currentCategory,
          ),
        );
        continue;
      }

      // Strategy C: Limit
      const limitMatch = line.match(limitRegex);
      if (limitMatch) {
        requirements.push(
          this.createReq(
            i,
            line,
            GrammarType.KEY_VALUE_PAIR,
            `${limitMatch[1]} ${limitMatch[2]}`,
            "LIMIT",
            limitMatch[3],
            currentCategory,
          ),
        );
        continue;
      }
    }

    return {
      totalLinesProcessed: lines.length,
      requirements: requirements,
      parseDurationMs: Date.now() - startTime,
    };
  }

  private createReq(
    lineIdx: number,
    text: string,
    type: GrammarType,
    param: string,
    op: string,
    val: string,
    cat: string,
  ): UniversalRequirement {
    const cleanValue = val.trim();
    const norm = this.normalizer.normalize(cleanValue);

    return {
      id: uuidv4(),
      sourceLine: lineIdx,
      originalText: text,
      grammarType: type,
      parameter: param.trim(),
      operator: op.toUpperCase(),
      value: cleanValue,
      normalized: norm
        ? { value: norm.standardValue, unit: norm.standardUnit }
        : undefined,
      derivedCategory: cat,
      confidence: 0.85, // Heuristic base confidence
    };
  }
}

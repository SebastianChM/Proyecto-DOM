import { v4 as uuidv4 } from "uuid";

export interface MergedRule {
  id: string;
  parameter: string;
  category: string;
  operator: string;
  value: unknown;
  source: "Spec" | "Normative" | "Merged"; // 'Merged' implies conflict resolved
  originalSpec?: unknown;
  originalNorm?: unknown;
  conflictDescription?: string;
}

export class SupremacyEngineService {
  /**
   * Resolves conflicts between Project Specs (ET) and Normative Rules.
   * Supremacy Rule: Stricter requirement wins. If unknown, Normative wins for safety.
   */
  resolveActiveRules(
    specRules: Array<Record<string, unknown>>,
    normRules: Array<Record<string, unknown>>,
  ): MergedRule[] {
    const activeRules: MergedRule[] = [];
    const processedNormIds = new Set<string>();

    // 1. Iterate through Spec Rules
    for (const spec of specRules) {
      // Find specific matching Norm rule (Same Parameter + Same Category)
      const normMatch = normRules.find((n) => this.isSameParameter(n, spec));

      if (normMatch) {
        // CONFLICT DETECTED
        processedNormIds.add(String(normMatch.id));
        const winner = this.determineSupremacy(spec, normMatch);

        activeRules.push(winner);
      } else {
        // No conflict, keep Spec rule
        activeRules.push({
          ...spec,
          source: "Spec",
        } as MergedRule);
      }
    }

    // 2. Add remaining Norm rules (Statutory Requirements not mentioned in Spec)
    for (const norm of normRules) {
      if (!processedNormIds.has(String(norm.id))) {
        activeRules.push({
          ...norm,
          source: "Normative",
        } as MergedRule);
      }
    }

    return activeRules;
  }

  private isSameParameter(
    r1: Record<string, unknown>,
    r2: Record<string, unknown>,
  ): boolean {
    // Fuzzy match: "Fire Rating" == "Resistance to Fire" ??
    // For now, strict match on normalized param name
    if (!r1.parameter || !r2.parameter) return false;

    const p1 = String(r1.parameter).toLowerCase().replace(/\s+/g, "");
    const p2 = String(r2.parameter).toLowerCase().replace(/\s+/g, "");

    // Also check if Categories are somewhat related
    // If one is "General" and other is "Walls", maybe match?
    // Staying strict for Phase 2 MVP.
    return p1 === p2 && r1.derivedCategory === r2.derivedCategory;
  }

  private determineSupremacy(
    spec: Record<string, unknown>,
    norm: Record<string, unknown>,
  ): MergedRule {
    // Heuristic: Attempt to parse numbers
    const vSpec = this.extractNumber(spec.value);
    const vNorm = this.extractNumber(norm.value);

    let chosen = spec;
    let conflictDesc = "";

    if (vSpec !== null && vNorm !== null) {
      // Compare Numbers
      // Usually "Higher is Stricter" for Fire Rating, Strength.
      // But "Lower is Stricter" for "Tolerances", "Max deflection".
      // Assumption: Higher is better/stricter for most Structural/Safety things.

      if (vNorm > vSpec) {
        chosen = norm;
        conflictDesc = `Normative value (${norm.value}) is stricter than Spec (${spec.value}). Applied Normative.`;
      } else {
        chosen = spec; // Spec is equal or higher
        conflictDesc = `Spec value (${spec.value}) meets Normative (${norm.value}).`;
      }
    } else {
      // Non-numeric comparison (Strings)
      // If they differ, prefer Normative for safety? Or alert?
      // "Normative Supremacy" -> use Norm.
      chosen = norm;
      conflictDesc = `Normative text overrides Spec. Spec: "${spec.value}" vs Norm: "${norm.value}"`;
    }

    return {
      ...chosen,
      id: uuidv4(), // New ID for the active rule
      source: "Merged",
      originalSpec: spec,
      originalNorm: norm,
      conflictDescription: conflictDesc,
    } as MergedRule;
  }

  private extractNumber(val: unknown): number | null {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const match = val.match(/([\d.]+)/);
      if (match) return parseFloat(match[1]);
    }
    return null;
  }
}

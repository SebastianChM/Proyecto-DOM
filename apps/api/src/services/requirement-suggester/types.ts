/**
 * Types for the requirement suggester subsystem.
 * Suggestions are stored transiently in Redis (TTL 24h) — no Prisma model needed.
 */

export interface SuggestedCondition {
  /** canonicalName from the property dictionary */
  property: string;
  /** Operator (e.g. ">=", "==", "exists") */
  operator: string;
  /** Value as string */
  value: string;
  /** Optional unit (m, m², etc.) */
  unit?: string | null;
}

export interface SuggestedRequirement {
  /** Human-readable requirement description */
  description: string;
  /** Legal reference (article, norm, etc.) */
  legalReference: string;
  /** Discipline the requirement applies to */
  discipline: string;
  /** Severity level */
  severity: "MANDATORY" | "RECOMMENDED" | "INFO";
  /** Conditions to evaluate the requirement */
  conditions: SuggestedCondition[];
  /** Applicability scope */
  applicability: {
    /** canonicalName entries from the category dictionary */
    categories: string[];
  };
  /** Confidence score between 0 and 1 (filtered below 0.5) */
  confidence: number;
}

export interface StoredSuggestion {
  analysisId: string;
  packId: string;
  suggestions: SuggestedRequirement[];
  /** ISO date string */
  createdAt: string;
  userId?: string;
  disciplineFilter?: string;
}

export interface EvaluationConfig {
  projectId: string;
  modelUrn: string;
  discipline?: string;
  dryRun?: boolean;
}

export interface ResolvedCondition {
  propertyCanonicalName: string;
  propertyAliases: string[];
  operator: string;
  value: string;
  unit: string | null;
  tolerance: number | null;
  logicGroup: "AND" | "OR";
}

export interface NormalizedValue {
  raw: string;
  numeric: number | null;
  unit: string | null;
  text: string;
}

export interface NormalizedElement {
  elementId: string;
  name: string;
  category: string;
  properties: Map<string, NormalizedValue>;
  /** Lowercase key → original key index for O(1) case-insensitive property lookup */
  lcIndex: Map<string, string>;
}

export interface ElementEvaluation {
  elementId: string;
  elementName: string;
  elementCategory: string;
  requirementId: string;
  requirementCode: string;
  status: "PASS" | "FAIL" | "NOT_APPLICABLE" | "ERROR";
  conditions: ConditionResult[];
  legalReference: string;
  severity: string;
}

export interface ConditionResult {
  propertyName: string;
  operator: string;
  expectedValue: string;
  actualValue: string | null;
  passed: boolean;
  deviation: number | null;
  message: string;
}

export interface EvaluationResult {
  totalRequirements: number;
  totalElements: number;
  evaluations: ElementEvaluation[];
  summary: {
    passed: number;
    failed: number;
    notApplicable: number;
    errors: number;
    byDiscipline: Record<string, { passed: number; failed: number }>;
    complianceScore: number;
  };
}

export type UnitConversionMap = Map<string, Map<string, number>>;

export type PropertyResolver = (
  element: NormalizedElement,
  canonicalName: string,
  aliases: string[],
) => NormalizedValue | null;

export interface ApplicabilityShape {
  targetCategories: string[];
  excludeCategories: string[];
  propertyFilters: Record<string, string>;
  scope: "ALL" | "FILTERED";
}

export interface Pack {
  id: string;
  code: string;
  name: string;
  description?: string;
  country: string;
  version: string;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
  scope: string[];
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { requirements: number };
}

export interface PackDetail extends Pack {
  requirements: RequirementSummary[];
}

export interface RequirementSummary {
  id: string;
  code: string;
  description: string;
  discipline: string;
  severity: "MANDATORY" | "RECOMMENDED" | "INFO";
  status: "DRAFT" | "VERIFIED" | "ACTIVE" | "RETIRED";
}

export interface Condition {
  id?: string;
  propertyRef: string;
  operator: string;
  value: string;
  unit?: string;
  tolerance?: number;
  logicGroup: "AND" | "OR";
  sortOrder: number;
}

export interface Applicability {
  targetCategories: string[];
  excludeCategories: string[];
  propertyFilters?: Record<string, unknown>;
  scope: "ALL" | "FILTERED";
}

export interface Requirement extends RequirementSummary {
  legalReference: string;
  tags: string[];
  notes?: string;
  conditions: Condition[];
  applicability?: Applicability;
  packId: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementOverride {
  id: string;
  requirementId: string;
  action: "SKIP" | "MODIFY_VALUE" | "CHANGE_SEVERITY";
  newValue?: string;
  newSeverity?: string;
  reason: string;
  approvedBy: string;
}

export interface ProjectComplianceConfig {
  id: string;
  projectId: string;
  packIds: string[];
  overrides: RequirementOverride[];
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedConfig {
  projectId: string;
  packs: Pack[];
  overrides: RequirementOverride[];
}

export interface ComplianceRun {
  id: string;
  projectId: string;
  modelUrn: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "TIMEOUT";
  complianceScore: number;
  totalElements: number;
  failedCount: number;
  passedCount: number;
  startedAt: string;
  completedAt?: string;
  configId?: string;
  dryRun: boolean;
  metadata?: Record<string, unknown>;
}

export interface ComplianceIssue {
  id: string;
  runId: string;
  elementId: string;
  elementName?: string;
  elementCategory?: string;
  ruleId: string;
  ruleName: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  deviation?: number;
  actualValue?: string;
  expectedValue?: string;
  legalReference?: string;
}

export interface StoredAnalysis {
  analysisId: string;
  packId: string;
  suggestions: SuggestedRequirement[];
  createdAt: string;
}

export interface SuggestedRequirement {
  code: string;
  description: string;
  legalReference: string;
  discipline: string;
  severity: "MANDATORY" | "RECOMMENDED" | "INFO";
  conditions: Omit<Condition, "id">[];
  applicability?: Applicability;
  confidence: number;
  explanation: string;
}

export interface PropertyEntry {
  id: string;
  canonicalName: string;
  displayName: string;
  aliases: string[];
  unit?: string;
  locale: string;
}

export interface CategoryEntry {
  id: string;
  canonicalName: string;
  displayName: string;
  revitCategory?: string;
  locale: string;
}

export interface UnitConversion {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
}

export interface V3PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

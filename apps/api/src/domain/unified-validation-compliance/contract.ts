export type UnifiedRunSource = "VALIDATION" | "COMPLIANCE";

export type UnifiedRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

export type UnifiedIssueCategory =
  | "MISSING"
  | "MISMATCH"
  | "UNDOCUMENTED"
  | "DUPLICATE"
  | "INVALID"
  | "RULE_VIOLATION"
  | "OTHER";

export type UnifiedIssueSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO"
  | "UNKNOWN";

export type UnifiedIssueStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "IGNORED"
  | "FALSE_POSITIVE"
  | "UNKNOWN";

export interface UnifiedRunMetrics {
  totalElements: number | null;
  totalRules: number | null;
  passedCount: number | null;
  failedCount: number | null;
  warningCount: number | null;
  missingCount: number | null;
  mismatchCount: number | null;
  undocumentedCount: number | null;
  complianceScore: number | null;
}

export interface UnifiedRunIdentifiers {
  fileId: string | null;
  fileName: string | null;
  fileUrn: string | null;
  modelUrn: string | null;
  modelName: string | null;
  rulesetId: string | null;
  rulesetName: string | null;
  validationType: string | null;
}

export interface UnifiedRun {
  id: string;
  source: UnifiedRunSource;
  sourceStatus: string;
  status: UnifiedRunStatus;
  projectId: string | null;
  createdBy: string | null;
  startedAt: Date;
  completedAt: Date | null;
  metrics: UnifiedRunMetrics;
  identifiers: UnifiedRunIdentifiers;
}

export interface UnifiedIssueElement {
  id: string | null;
  tag: string | null;
  name: string | null;
  type: string | null;
  category: string | null;
}

export interface UnifiedIssueRule {
  id: string | null;
  name: string | null;
  propertyName: string | null;
}

export interface UnifiedIssue {
  id: string;
  runId: string;
  source: UnifiedRunSource;
  sourceType: string | null;
  category: UnifiedIssueCategory;
  severity: UnifiedIssueSeverity;
  status: UnifiedIssueStatus;
  message: string;
  description: string | null;
  expectedValue: string | null;
  actualValue: string | null;
  deviation: string | null;
  element: UnifiedIssueElement;
  rule: UnifiedIssueRule;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

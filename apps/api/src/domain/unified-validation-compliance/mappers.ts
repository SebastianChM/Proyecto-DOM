import {
  ComplianceIssue,
  ComplianceRun,
  ValidationIssue,
  ValidationRun,
} from "@prisma/client";
import {
  UnifiedIssue,
  UnifiedIssueCategory,
  UnifiedIssueSeverity,
  UnifiedIssueStatus,
  UnifiedRun,
  UnifiedRunStatus,
} from "./contract";
import {
  COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED,
  COMPLIANCE_ISSUE_STATUS_TO_UNIFIED,
  COMPLIANCE_RUN_STATUS_TO_UNIFIED,
  COMPLIANCE_V3_RUN_STATUS_TO_UNIFIED,
  ComplianceIssueSeverity,
  ComplianceIssueStatus,
  ComplianceRunStatus,
  VALIDATION_ISSUE_CATEGORY_TO_UNIFIED,
  VALIDATION_ISSUE_SEVERITY_TO_UNIFIED,
  VALIDATION_ISSUE_STATUS_TO_UNIFIED,
  VALIDATION_RUN_STATUS_TO_UNIFIED,
  ValidationIssueCategory,
  ValidationIssueSeverity,
  ValidationIssueStatus,
  ValidationRunStatus,
} from "./mapping-tables";

export type ComplianceRunWithRuleset = ComplianceRun & {
  ruleset?: { name: string } | null;
};

function mapValue<T extends string, U extends string>(
  value: string,
  mapping: Readonly<Record<T, U>>,
  fallback: U,
): U {
  return mapping[value as T] ?? fallback;
}

export function toUnifiedRunFromValidation(run: ValidationRun): UnifiedRun {
  const status = mapValue(
    run.status,
    VALIDATION_RUN_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedRunStatus,
  );

  return {
    id: run.id,
    source: "VALIDATION",
    sourceStatus: run.status,
    status,
    projectId: run.projectId,
    createdBy: run.userId,
    startedAt: run.createdAt,
    completedAt: run.completedAt,
    metrics: {
      totalElements: run.totalElements,
      totalRules: null,
      passedCount: null,
      failedCount: null,
      warningCount: null,
      missingCount: run.missingCount,
      mismatchCount: run.mismatchCount,
      undocumentedCount: run.undocumentedCount,
      complianceScore: null,
    },
    identifiers: {
      fileId: run.fileId,
      fileName: run.fileName,
      fileUrn: run.fileUrn,
      modelUrn: null,
      modelName: null,
      rulesetId: null,
      rulesetName: null,
      validationType: run.validationType,
    },
  };
}

export function toUnifiedRunFromCompliance(
  run: ComplianceRunWithRuleset,
): UnifiedRun {
  const status = mapValue(
    run.status,
    COMPLIANCE_RUN_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedRunStatus,
  );

  return {
    id: run.id,
    source: "COMPLIANCE",
    sourceStatus: run.status,
    status,
    projectId: run.projectId,
    createdBy: run.createdBy,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    metrics: {
      totalElements: run.totalElements,
      totalRules: run.totalRules,
      passedCount: run.passedCount,
      failedCount: run.failedCount,
      warningCount: run.warningCount,
      missingCount: null,
      mismatchCount: null,
      undocumentedCount: null,
      complianceScore: run.complianceScore,
    },
    identifiers: {
      fileId: null,
      fileName: null,
      fileUrn: null,
      modelUrn: run.modelUrn,
      modelName: run.modelName,
      rulesetId: run.rulesetId,
      rulesetName: run.ruleset?.name || null,
      validationType: null,
    },
  };
}

export function toUnifiedIssueFromValidation(
  issue: ValidationIssue,
): UnifiedIssue {
  const category = mapValue(
    issue.type,
    VALIDATION_ISSUE_CATEGORY_TO_UNIFIED,
    "OTHER" as UnifiedIssueCategory,
  );

  const severity = mapValue(
    issue.severity,
    VALIDATION_ISSUE_SEVERITY_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueSeverity,
  );

  const status = mapValue(
    issue.status,
    VALIDATION_ISSUE_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueStatus,
  );

  return {
    id: issue.id,
    runId: issue.validationRunId,
    source: "VALIDATION",
    sourceType: issue.type,
    category,
    severity,
    status,
    message: issue.message,
    description: issue.description,
    expectedValue: issue.expectedValue,
    actualValue: issue.actualValue,
    deviation: null,
    element: {
      id: issue.elementId,
      tag: issue.elementTag,
      name: issue.elementTag,
      type: issue.elementType,
      category: null,
    },
    rule: {
      id: null,
      name: null,
      propertyName: null,
    },
    resolvedAt: issue.resolvedAt,
    resolvedBy: issue.resolvedBy,
    resolutionNote: issue.resolutionNotes,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    legalReference: null,
  };
}

export function toUnifiedIssueFromCompliance(
  issue: ComplianceIssue,
): UnifiedIssue {
  const severity = mapValue(
    issue.severity,
    COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueSeverity,
  );

  const status = mapValue(
    issue.status,
    COMPLIANCE_ISSUE_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueStatus,
  );

  return {
    id: issue.id,
    runId: issue.runId,
    source: "COMPLIANCE",
    sourceType: "RULE_VIOLATION",
    category: "RULE_VIOLATION",
    severity,
    status,
    message: `${issue.ruleName}: ${issue.propertyName}`,
    description: null,
    expectedValue: issue.expectedValue,
    actualValue: issue.actualValue,
    deviation: issue.deviation,
    element: {
      id: issue.elementId,
      tag: null,
      name: issue.elementName,
      type: null,
      category: issue.elementCategory,
    },
    rule: {
      id: issue.ruleId,
      name: issue.ruleName,
      propertyName: issue.propertyName,
    },
    resolvedAt: issue.resolvedAt,
    resolvedBy: issue.resolvedBy,
    resolutionNote: issue.resolutionNote,
    createdAt: issue.createdAt,
    updatedAt: null,
    legalReference: issue.legalReference ?? null,
  };
}

export function mapValidationRunsToUnified(
  runs: ValidationRun[],
): UnifiedRun[] {
  return runs.map(toUnifiedRunFromValidation);
}

export function mapComplianceRunsToUnified(
  runs: ComplianceRunWithRuleset[],
): UnifiedRun[] {
  return runs.map(toUnifiedRunFromCompliance);
}

export function mapValidationIssuesToUnified(
  issues: ValidationIssue[],
): UnifiedIssue[] {
  return issues.map(toUnifiedIssueFromValidation);
}

export function mapComplianceIssuesToUnified(
  issues: ComplianceIssue[],
): UnifiedIssue[] {
  return issues.map(toUnifiedIssueFromCompliance);
}

function extractV3Metrics(metadata: unknown): {
  totalElements: number | null;
  totalRequirements: number | null;
  complianceScore: number | null;
  issueCounts: { total: number; mandatory: number; recommended: number } | null;
} {
  if (!metadata || typeof metadata !== "object") {
    return {
      totalElements: null,
      totalRequirements: null,
      complianceScore: null,
      issueCounts: null,
    };
  }
  const m = metadata as Record<string, unknown>;
  return {
    totalElements: typeof m.totalElements === "number" ? m.totalElements : null,
    totalRequirements:
      typeof m.totalRequirements === "number" ? m.totalRequirements : null,
    complianceScore:
      typeof m.complianceScore === "number" ? m.complianceScore : null,
    issueCounts:
      m.issueCounts && typeof m.issueCounts === "object"
        ? (m.issueCounts as {
            total: number;
            mandatory: number;
            recommended: number;
          })
        : null,
  };
}

export function toUnifiedRunFromComplianceV3(run: ComplianceRun): UnifiedRun {
  const status = mapValue(
    run.status,
    COMPLIANCE_V3_RUN_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedRunStatus,
  );

  const v3Metrics = extractV3Metrics(run.metadata);

  return {
    id: run.id,
    source: "COMPLIANCE_V3",
    sourceStatus: run.status,
    status,
    projectId: run.projectId,
    createdBy: run.createdBy,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    metrics: {
      totalElements: v3Metrics.totalElements,
      totalRules: v3Metrics.totalRequirements,
      passedCount: null,
      failedCount: v3Metrics.issueCounts?.total ?? null,
      warningCount: v3Metrics.issueCounts?.recommended ?? null,
      missingCount: null,
      mismatchCount: null,
      undocumentedCount: null,
      complianceScore: v3Metrics.complianceScore,
    },
    identifiers: {
      fileId: null,
      fileName: null,
      fileUrn: null,
      modelUrn: run.modelUrn,
      modelName: run.modelName,
      rulesetId: run.configId,
      rulesetName: null,
      validationType: null,
    },
  };
}

export function toUnifiedIssueFromComplianceV3(
  issue: ComplianceIssue,
): UnifiedIssue {
  const severity = mapValue(
    issue.severity,
    COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueSeverity,
  );

  const status = mapValue(
    issue.status,
    COMPLIANCE_ISSUE_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueStatus,
  );

  return {
    id: issue.id,
    runId: issue.runId,
    source: "COMPLIANCE_V3",
    sourceType: "RULE_VIOLATION",
    category: "RULE_VIOLATION",
    severity,
    status,
    message: `${issue.ruleName}: ${issue.propertyName}`,
    description: null,
    expectedValue: issue.expectedValue,
    actualValue: issue.actualValue,
    deviation: issue.deviation,
    element: {
      id: issue.elementId,
      tag: null,
      name: issue.elementName,
      type: null,
      category: issue.elementCategory,
    },
    rule: {
      id: issue.ruleId,
      name: issue.ruleName,
      propertyName: issue.propertyName,
    },
    resolvedAt: issue.resolvedAt,
    resolvedBy: issue.resolvedBy,
    resolutionNote: issue.resolutionNote,
    createdAt: issue.createdAt,
    updatedAt: null,
    legalReference: issue.legalReference ?? null,
  };
}

export function mapComplianceV3RunsToUnified(
  runs: ComplianceRun[],
): UnifiedRun[] {
  return runs.map(toUnifiedRunFromComplianceV3);
}

export function mapComplianceV3IssuesToUnified(
  issues: ComplianceIssue[],
): UnifiedIssue[] {
  return issues.map(toUnifiedIssueFromComplianceV3);
}

export function mapValidationRunStatusToUnified(
  status: string,
): UnifiedRunStatus {
  return mapValue(
    status,
    VALIDATION_RUN_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedRunStatus,
  );
}

export function mapComplianceRunStatusToUnified(
  status: string,
): UnifiedRunStatus {
  return mapValue(
    status,
    COMPLIANCE_RUN_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedRunStatus,
  );
}

export function mapValidationIssueCategoryToUnified(
  category: string,
): UnifiedIssueCategory {
  return mapValue(
    category,
    VALIDATION_ISSUE_CATEGORY_TO_UNIFIED,
    "OTHER" as UnifiedIssueCategory,
  );
}

export function mapValidationIssueSeverityToUnified(
  severity: string,
): UnifiedIssueSeverity {
  return mapValue(
    severity,
    VALIDATION_ISSUE_SEVERITY_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueSeverity,
  );
}

export function mapComplianceIssueSeverityToUnified(
  severity: string,
): UnifiedIssueSeverity {
  return mapValue(
    severity,
    COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueSeverity,
  );
}

export function mapValidationIssueStatusToUnified(
  status: string,
): UnifiedIssueStatus {
  return mapValue(
    status,
    VALIDATION_ISSUE_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueStatus,
  );
}

export function mapComplianceIssueStatusToUnified(
  status: string,
): UnifiedIssueStatus {
  return mapValue(
    status,
    COMPLIANCE_ISSUE_STATUS_TO_UNIFIED,
    "UNKNOWN" as UnifiedIssueStatus,
  );
}

// Re-export source status/category unions used by typed mapping helpers.
export type {
  ComplianceIssueSeverity,
  ComplianceIssueStatus,
  ComplianceRunStatus,
  ValidationIssueCategory,
  ValidationIssueSeverity,
  ValidationIssueStatus,
  ValidationRunStatus,
};

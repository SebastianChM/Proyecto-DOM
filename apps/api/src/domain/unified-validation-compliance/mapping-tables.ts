import {
  UnifiedIssueCategory,
  UnifiedIssueSeverity,
  UnifiedIssueStatus,
  UnifiedRunStatus,
} from "./contract";

export type ValidationRunStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ComplianceRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type ValidationIssueCategory =
  | "MISSING"
  | "MISSING_IN_MODEL"
  | "MISMATCH"
  | "PROPERTY_MISMATCH"
  | "UNDOCUMENTED"
  | "UNDOCUMENTED_IN_TABLE"
  | "DUPLICATE"
  | "INVALID";

export type ValidationIssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ComplianceIssueSeverity = "CRITICAL" | "WARNING" | "INFO";

export type ValidationIssueStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "IGNORED";

export type ComplianceIssueStatus =
  | "OPEN"
  | "RESOLVED"
  | "IGNORED"
  | "FALSE_POSITIVE";

export const VALIDATION_RUN_STATUS_TO_UNIFIED: Readonly<
  Record<ValidationRunStatus, UnifiedRunStatus>
> = {
  PENDING: "PENDING",
  PROCESSING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

export const COMPLIANCE_RUN_STATUS_TO_UNIFIED: Readonly<
  Record<ComplianceRunStatus, UnifiedRunStatus>
> = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

export const VALIDATION_ISSUE_CATEGORY_TO_UNIFIED: Readonly<
  Record<ValidationIssueCategory, UnifiedIssueCategory>
> = {
  MISSING: "MISSING",
  MISSING_IN_MODEL: "MISSING",
  MISMATCH: "MISMATCH",
  PROPERTY_MISMATCH: "MISMATCH",
  UNDOCUMENTED: "UNDOCUMENTED",
  UNDOCUMENTED_IN_TABLE: "UNDOCUMENTED",
  DUPLICATE: "DUPLICATE",
  INVALID: "INVALID",
};

export const VALIDATION_ISSUE_SEVERITY_TO_UNIFIED: Readonly<
  Record<ValidationIssueSeverity, UnifiedIssueSeverity>
> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

export const COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED: Readonly<
  Record<ComplianceIssueSeverity, UnifiedIssueSeverity>
> = {
  CRITICAL: "CRITICAL",
  WARNING: "MEDIUM",
  INFO: "INFO",
};

export const VALIDATION_ISSUE_STATUS_TO_UNIFIED: Readonly<
  Record<ValidationIssueStatus, UnifiedIssueStatus>
> = {
  OPEN: "OPEN",
  ACKNOWLEDGED: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
};

export const COMPLIANCE_ISSUE_STATUS_TO_UNIFIED: Readonly<
  Record<ComplianceIssueStatus, UnifiedIssueStatus>
> = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
  FALSE_POSITIVE: "FALSE_POSITIVE",
};

export const UNIFIED_RUN_STATUS_TO_VALIDATION: Readonly<
  Record<Exclude<UnifiedRunStatus, "UNKNOWN">, ValidationRunStatus>
> = {
  PENDING: "PENDING",
  RUNNING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

export const UNIFIED_RUN_STATUS_TO_COMPLIANCE: Readonly<
  Record<Exclude<UnifiedRunStatus, "UNKNOWN">, ComplianceRunStatus>
> = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

export const UNIFIED_ISSUE_STATUS_TO_VALIDATION: Readonly<
  Partial<Record<Exclude<UnifiedIssueStatus, "UNKNOWN">, ValidationIssueStatus>>
> = {
  OPEN: "OPEN",
  IN_PROGRESS: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
};

export const UNIFIED_ISSUE_STATUS_TO_COMPLIANCE: Readonly<
  Partial<Record<Exclude<UnifiedIssueStatus, "UNKNOWN">, ComplianceIssueStatus>>
> = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
  IGNORED: "IGNORED",
  FALSE_POSITIVE: "FALSE_POSITIVE",
};

export const UNIFIED_ISSUE_SEVERITY_TO_VALIDATION: Readonly<
  Partial<
    Record<Exclude<UnifiedIssueSeverity, "UNKNOWN">, ValidationIssueSeverity>
  >
> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  INFO: "LOW",
};

export const UNIFIED_ISSUE_SEVERITY_TO_COMPLIANCE: Readonly<
  Partial<
    Record<Exclude<UnifiedIssueSeverity, "UNKNOWN">, ComplianceIssueSeverity>
  >
> = {
  CRITICAL: "CRITICAL",
  HIGH: "WARNING",
  MEDIUM: "WARNING",
  LOW: "INFO",
  INFO: "INFO",
};

export const UNIFIED_ISSUE_CATEGORY_TO_VALIDATION: Readonly<
  Partial<
    Record<Exclude<UnifiedIssueCategory, "OTHER">, ValidationIssueCategory>
  >
> = {
  MISSING: "MISSING",
  MISMATCH: "MISMATCH",
  UNDOCUMENTED: "UNDOCUMENTED",
  DUPLICATE: "DUPLICATE",
  INVALID: "INVALID",
};

export const UNIFIED_ISSUE_CATEGORY_TO_COMPLIANCE: Readonly<
  Partial<Record<Exclude<UnifiedIssueCategory, "OTHER">, "RULE_VIOLATION">>
> = {
  RULE_VIOLATION: "RULE_VIOLATION",
};

export type ComplianceV3RunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "ERROR"
  | "TIMEOUT";

export const COMPLIANCE_V3_RUN_STATUS_TO_UNIFIED: Readonly<
  Record<ComplianceV3RunStatus, UnifiedRunStatus>
> = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  ERROR: "FAILED",
  TIMEOUT: "FAILED",
};

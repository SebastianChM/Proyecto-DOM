import {
  ComplianceIssue,
  ComplianceRun,
  ValidationIssue,
  ValidationRun,
} from "@prisma/client";
import {
  COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED,
  COMPLIANCE_ISSUE_STATUS_TO_UNIFIED,
  COMPLIANCE_RUN_STATUS_TO_UNIFIED,
  VALIDATION_ISSUE_CATEGORY_TO_UNIFIED,
  VALIDATION_ISSUE_SEVERITY_TO_UNIFIED,
  VALIDATION_ISSUE_STATUS_TO_UNIFIED,
  VALIDATION_RUN_STATUS_TO_UNIFIED,
  mapComplianceIssueSeverityToUnified,
  mapComplianceIssueStatusToUnified,
  mapComplianceRunStatusToUnified,
  mapValidationIssueCategoryToUnified,
  mapValidationIssueSeverityToUnified,
  mapValidationIssueStatusToUnified,
  mapValidationRunStatusToUnified,
  toUnifiedIssueFromCompliance,
  toUnifiedIssueFromValidation,
  toUnifiedRunFromCompliance,
  toUnifiedRunFromValidation,
} from "../../../src/domain/unified-validation-compliance";

function buildValidationRun(overrides: Partial<ValidationRun> = {}): ValidationRun {
  return {
    id: "val-run-1",
    fileId: "file-1",
    fileName: "spec.pdf",
    fileUrn: "urn:abc",
    projectId: "project-1",
    userId: "user-1",
    status: "PROCESSING",
    totalElements: 120,
    missingCount: 2,
    mismatchCount: 3,
    undocumentedCount: 1,
    validationType: "STRUCTURE",
    validationRules: null,
    createdAt: new Date("2026-03-11T10:00:00.000Z"),
    completedAt: null,
    ...overrides,
  };
}

function buildComplianceRun(overrides: Partial<ComplianceRun> = {}): ComplianceRun {
  return {
    id: "cmp-run-1",
    name: "Run 1",
    status: "RUNNING",
    modelUrn: "urn:model",
    modelName: "Model A",
    rulesetId: "ruleset-1",
    totalElements: 30,
    totalRules: 5,
    passedCount: 110,
    failedCount: 40,
    warningCount: 10,
    complianceScore: 73.5,
    startedAt: new Date("2026-03-11T10:00:00.000Z"),
    completedAt: null,
    duration: null,
    errorMessage: null,
    projectId: "project-1",
    createdBy: "user-2",
    ...overrides,
  };
}

function buildValidationIssue(
  overrides: Partial<ValidationIssue> = {},
): ValidationIssue {
  return {
    id: "val-issue-1",
    validationRunId: "val-run-1",
    type: "PROPERTY_MISMATCH",
    severity: "HIGH",
    status: "ACKNOWLEDGED",
    elementTag: "P-101",
    elementType: "Pipe",
    elementId: "e-123",
    message: "Type mismatch",
    description: "Expected PVC",
    location: null,
    expectedValue: "PVC",
    actualValue: "STEEL",
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: new Date("2026-03-11T10:05:00.000Z"),
    updatedAt: new Date("2026-03-11T10:06:00.000Z"),
    ...overrides,
  };
}

function buildComplianceIssue(
  overrides: Partial<ComplianceIssue> = {},
): ComplianceIssue {
  return {
    id: "cmp-issue-1",
    runId: "cmp-run-1",
    ruleName: "Pipe diameter",
    ruleId: "rule-1",
    elementId: "2001",
    elementName: "Pipe Main",
    elementCategory: "Pipes",
    propertyName: "Diameter",
    expectedValue: ">= 100",
    actualValue: "80",
    deviation: "-20",
    severity: "WARNING",
    status: "FALSE_POSITIVE",
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    createdAt: new Date("2026-03-11T10:10:00.000Z"),
    ...overrides,
  };
}

describe("unified validation/compliance mappings", () => {
  it("maps validation run status to unified run status", () => {
    expect(VALIDATION_RUN_STATUS_TO_UNIFIED.PROCESSING).toBe("RUNNING");
    expect(mapValidationRunStatusToUnified("PROCESSING")).toBe("RUNNING");
    expect(mapValidationRunStatusToUnified("UNEXPECTED")).toBe("UNKNOWN");
  });

  it("maps compliance run status to unified run status", () => {
    expect(COMPLIANCE_RUN_STATUS_TO_UNIFIED.RUNNING).toBe("RUNNING");
    expect(mapComplianceRunStatusToUnified("RUNNING")).toBe("RUNNING");
    expect(mapComplianceRunStatusToUnified("UNEXPECTED")).toBe("UNKNOWN");
  });

  it("maps validation issue type/severity/status to unified values", () => {
    expect(VALIDATION_ISSUE_CATEGORY_TO_UNIFIED.PROPERTY_MISMATCH).toBe(
      "MISMATCH",
    );
    expect(VALIDATION_ISSUE_SEVERITY_TO_UNIFIED.HIGH).toBe("HIGH");
    expect(VALIDATION_ISSUE_STATUS_TO_UNIFIED.ACKNOWLEDGED).toBe(
      "IN_PROGRESS",
    );

    expect(mapValidationIssueCategoryToUnified("PROPERTY_MISMATCH")).toBe(
      "MISMATCH",
    );
    expect(mapValidationIssueSeverityToUnified("HIGH")).toBe("HIGH");
    expect(mapValidationIssueStatusToUnified("ACKNOWLEDGED")).toBe(
      "IN_PROGRESS",
    );
  });

  it("maps compliance issue severity/status to unified values", () => {
    expect(COMPLIANCE_ISSUE_SEVERITY_TO_UNIFIED.WARNING).toBe("MEDIUM");
    expect(COMPLIANCE_ISSUE_STATUS_TO_UNIFIED.FALSE_POSITIVE).toBe(
      "FALSE_POSITIVE",
    );

    expect(mapComplianceIssueSeverityToUnified("WARNING")).toBe("MEDIUM");
    expect(mapComplianceIssueStatusToUnified("FALSE_POSITIVE")).toBe(
      "FALSE_POSITIVE",
    );
  });

  it("adapts ValidationRun into the unified run contract", () => {
    const source = buildValidationRun();
    const unified = toUnifiedRunFromValidation(source);

    expect(unified.source).toBe("VALIDATION");
    expect(unified.status).toBe("RUNNING");
    expect(unified.createdBy).toBe(source.userId);
    expect(unified.identifiers.fileId).toBe(source.fileId);
    expect(unified.identifiers.validationType).toBe(source.validationType);
    expect(unified.metrics.missingCount).toBe(source.missingCount);
    expect(unified.metrics.complianceScore).toBeNull();
  });

  it("adapts ComplianceRun into the unified run contract", () => {
    const source = buildComplianceRun();
    const unified = toUnifiedRunFromCompliance({
      ...source,
      ruleset: { name: "Ruleset Alpha" },
    });

    expect(unified.source).toBe("COMPLIANCE");
    expect(unified.status).toBe("RUNNING");
    expect(unified.identifiers.rulesetId).toBe(source.rulesetId);
    expect(unified.identifiers.rulesetName).toBe("Ruleset Alpha");
    expect(unified.metrics.complianceScore).toBe(source.complianceScore);
    expect(unified.metrics.missingCount).toBeNull();
  });

  it("adapts ValidationIssue into the unified issue contract", () => {
    const source = buildValidationIssue();
    const unified = toUnifiedIssueFromValidation(source);

    expect(unified.source).toBe("VALIDATION");
    expect(unified.category).toBe("MISMATCH");
    expect(unified.severity).toBe("HIGH");
    expect(unified.status).toBe("IN_PROGRESS");
    expect(unified.rule.name).toBeNull();
    expect(unified.element.tag).toBe(source.elementTag);
  });

  it("adapts ComplianceIssue into the unified issue contract", () => {
    const source = buildComplianceIssue();
    const unified = toUnifiedIssueFromCompliance(source);

    expect(unified.source).toBe("COMPLIANCE");
    expect(unified.category).toBe("RULE_VIOLATION");
    expect(unified.severity).toBe("MEDIUM");
    expect(unified.status).toBe("FALSE_POSITIVE");
    expect(unified.rule.name).toBe(source.ruleName);
    expect(unified.element.category).toBe(source.elementCategory);
  });

  it("falls back to UNKNOWN/OTHER when source values are not mapped", () => {
    const validationRun = buildValidationRun({ status: "PAUSED" });
    const validationIssue = buildValidationIssue({
      type: "UNMAPPED_TYPE",
      severity: "SEVERE",
      status: "ON_HOLD",
    });

    const unifiedRun = toUnifiedRunFromValidation(validationRun);
    const unifiedIssue = toUnifiedIssueFromValidation(validationIssue);

    expect(unifiedRun.status).toBe("UNKNOWN");
    expect(unifiedIssue.category).toBe("OTHER");
    expect(unifiedIssue.severity).toBe("UNKNOWN");
    expect(unifiedIssue.status).toBe("UNKNOWN");
  });
});

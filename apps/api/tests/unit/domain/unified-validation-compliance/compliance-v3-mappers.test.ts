import { describe, it, expect } from "@jest/globals";
import {
  toUnifiedRunFromComplianceV3,
  toUnifiedIssueFromComplianceV3,
  mapComplianceV3RunsToUnified,
  mapComplianceV3IssuesToUnified,
} from "../../../../src/domain/unified-validation-compliance/mappers";

const BASE_RUN = {
  id: "run-001",
  projectId: "proj-001",
  modelUrn: "dXJuOmFkc2sub2JqZWN0czE6dGVzdA==",
  modelName: "Test Model",
  status: "COMPLETED",
  metadata: {
    totalElements: 200,
    processedElements: 200,
    totalRequirements: 10,
    complianceScore: 85,
    issueCounts: { total: 3, mandatory: 1, recommended: 2 },
    startedAt: "2026-04-26T10:00:00.000Z",
    completedAt: "2026-04-26T10:05:00.000Z",
  },
  configId: "config-001",
  rulesetId: null,
  totalElements: null,
  totalRules: null,
  passedCount: null,
  failedCount: null,
  warningCount: null,
  complianceScore: null,
  startedAt: new Date("2026-04-26T10:00:00.000Z"),
  completedAt: new Date("2026-04-26T10:05:00.000Z"),
  createdBy: "user-001",
  createdAt: new Date("2026-04-26T09:59:00.000Z"),
  updatedAt: new Date("2026-04-26T10:05:00.000Z"),
  name: null,
  errorMessage: null,
  duration: null,
};

const BASE_ISSUE = {
  id: "issue-001",
  runId: "run-001",
  ruleName: "CL-TEST-R001",
  ruleId: "req-001",
  elementId: "el-001",
  elementName: "Wall A",
  elementCategory: "Walls",
  propertyName: "Width",
  expectedValue: "500",
  actualValue: "200",
  deviation: "0.6",
  severity: "CRITICAL",
  status: "OPEN",
  legalReference: "OGUC Art. 4.2.1",
  resolvedAt: null,
  resolvedBy: null,
  resolutionNote: null,
  createdAt: new Date("2026-04-26T10:05:00.000Z"),
};

describe("toUnifiedRunFromComplianceV3", () => {
  it("should map status COMPLETED to UnifiedRunStatus COMPLETED", () => {
    const result = toUnifiedRunFromComplianceV3({
      ...BASE_RUN,
      status: "COMPLETED",
    } as never);
    expect(result.status).toBe("COMPLETED");
  });

  it("should map status ERROR to UnifiedRunStatus FAILED", () => {
    const result = toUnifiedRunFromComplianceV3({
      ...BASE_RUN,
      status: "ERROR",
    } as never);
    expect(result.status).toBe("FAILED");
  });

  it("should map status TIMEOUT to UnifiedRunStatus FAILED", () => {
    const result = toUnifiedRunFromComplianceV3({
      ...BASE_RUN,
      status: "TIMEOUT",
    } as never);
    expect(result.status).toBe("FAILED");
  });

  it("should extract complianceScore from metadata", () => {
    const result = toUnifiedRunFromComplianceV3(BASE_RUN as never);
    expect(result.metrics.complianceScore).toBe(85);
  });

  it("should extract totalElements from metadata", () => {
    const result = toUnifiedRunFromComplianceV3(BASE_RUN as never);
    expect(result.metrics.totalElements).toBe(200);
  });

  it("should use configId as rulesetId in identifiers", () => {
    const result = toUnifiedRunFromComplianceV3(BASE_RUN as never);
    expect(result.identifiers.rulesetId).toBe("config-001");
  });

  it("should return null metrics when metadata is null", () => {
    const result = toUnifiedRunFromComplianceV3({
      ...BASE_RUN,
      metadata: null,
    } as never);
    expect(result.metrics.complianceScore).toBeNull();
    expect(result.metrics.totalElements).toBeNull();
    expect(result.metrics.totalRules).toBeNull();
  });

  it("should set source to COMPLIANCE_V3", () => {
    const result = toUnifiedRunFromComplianceV3(BASE_RUN as never);
    expect(result.source).toBe("COMPLIANCE_V3");
  });
});

describe("toUnifiedIssueFromComplianceV3", () => {
  it("should map severity CRITICAL to UnifiedIssueSeverity CRITICAL", () => {
    const result = toUnifiedIssueFromComplianceV3({
      ...BASE_ISSUE,
      severity: "CRITICAL",
    } as never);
    expect(result.severity).toBe("CRITICAL");
  });

  it("should map severity WARNING to UnifiedIssueSeverity MEDIUM", () => {
    const result = toUnifiedIssueFromComplianceV3({
      ...BASE_ISSUE,
      severity: "WARNING",
    } as never);
    expect(result.severity).toBe("MEDIUM");
  });

  it("should include legalReference from issue", () => {
    const result = toUnifiedIssueFromComplianceV3(BASE_ISSUE as never);
    expect(result.legalReference).toBe("OGUC Art. 4.2.1");
  });

  it("should set source to COMPLIANCE_V3", () => {
    const result = toUnifiedIssueFromComplianceV3(BASE_ISSUE as never);
    expect(result.source).toBe("COMPLIANCE_V3");
  });

  it("should build message from ruleName and propertyName", () => {
    const result = toUnifiedIssueFromComplianceV3(BASE_ISSUE as never);
    expect(result.message).toBe("CL-TEST-R001: Width");
  });

  it("should return null legalReference when issue has no legalReference", () => {
    const result = toUnifiedIssueFromComplianceV3({
      ...BASE_ISSUE,
      legalReference: null,
    } as never);
    expect(result.legalReference).toBeNull();
  });
});

describe("mapComplianceV3RunsToUnified", () => {
  it("should map an array of runs and return UnifiedRun array", () => {
    const result = mapComplianceV3RunsToUnified([BASE_RUN as never]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("COMPLIANCE_V3");
  });

  it("should return empty array when input is empty", () => {
    const result = mapComplianceV3RunsToUnified([]);
    expect(result).toHaveLength(0);
  });
});

describe("mapComplianceV3IssuesToUnified", () => {
  it("should map an array of issues and return UnifiedIssue array", () => {
    const result = mapComplianceV3IssuesToUnified([BASE_ISSUE as never]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("COMPLIANCE_V3");
  });

  it("should return empty array when input is empty", () => {
    const result = mapComplianceV3IssuesToUnified([]);
    expect(result).toHaveLength(0);
  });
});

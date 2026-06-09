import {
  ComplianceIssue,
  ComplianceRun,
  PrismaClient,
  ValidationIssue,
  ValidationRun,
} from "@prisma/client";
import {
  createUnifiedReadAdapters,
  mapComplianceIssuesToUnified,
  mapComplianceRunsToUnified,
  mapValidationIssuesToUnified,
  mapValidationRunsToUnified,
} from "../../../src/domain/unified-validation-compliance";

function buildValidationRun(
  overrides: Partial<ValidationRun> = {},
): ValidationRun {
  return {
    id: "val-run-1",
    fileId: "file-1",
    fileName: "spec.pdf",
    fileUrn: null,
    projectId: "project-1",
    userId: "user-1",
    status: "PROCESSING",
    totalElements: 100,
    missingCount: 2,
    mismatchCount: 3,
    undocumentedCount: 4,
    validationType: "SPEC_COMPARE",
    validationRules: null,
    createdAt: new Date("2026-03-11T10:00:00.000Z"),
    completedAt: null,
    ...overrides,
  };
}

function buildValidationIssue(
  overrides: Partial<ValidationIssue> = {},
): ValidationIssue {
  return {
    id: "val-issue-1",
    validationRunId: "val-run-1",
    type: "MISSING",
    severity: "MEDIUM",
    status: "OPEN",
    elementTag: "E-1",
    elementType: "Valve",
    elementId: "100",
    message: "Missing element",
    description: null,
    location: null,
    expectedValue: null,
    actualValue: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNotes: null,
    createdAt: new Date("2026-03-11T10:05:00.000Z"),
    updatedAt: new Date("2026-03-11T10:05:30.000Z"),
    ...overrides,
  };
}

function buildComplianceRun(
  overrides: Partial<ComplianceRun> = {},
): ComplianceRun {
  return {
    id: "cmp-run-1",
    name: null,
    status: "COMPLETED",
    modelUrn: "urn:model",
    modelName: null,
    rulesetId: "ruleset-1",
    totalElements: 55,
    totalRules: 8,
    passedCount: 40,
    failedCount: 15,
    warningCount: 4,
    complianceScore: 72.5,
    startedAt: new Date("2026-03-11T11:00:00.000Z"),
    completedAt: new Date("2026-03-11T11:01:00.000Z"),
    duration: 60,
    errorMessage: null,
    projectId: "project-1",
    createdBy: null,
    configId: null,
    metadata: null,
    origin: "compliance",
    ...overrides,
  };
}

function buildComplianceIssue(
  overrides: Partial<ComplianceIssue> = {},
): ComplianceIssue {
  return {
    id: "cmp-issue-1",
    runId: "cmp-run-1",
    ruleName: "Diameter rule",
    ruleId: "rule-1",
    elementId: "200",
    elementName: "Pipe A",
    elementCategory: "Pipes",
    propertyName: "Diameter",
    expectedValue: ">= 100",
    actualValue: "80",
    deviation: "-20",
    severity: "WARNING",
    status: "OPEN",
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    legalReference: null,
    createdAt: new Date("2026-03-11T11:02:00.000Z"),
    ...overrides,
  };
}

function buildMockDataSource() {
  return {
    validationRun: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    validationIssue: {
      findMany: jest.fn(),
    },
    complianceRun: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    complianceIssue: {
      findMany: jest.fn(),
    },
  } as unknown as Parameters<typeof createUnifiedReadAdapters>[0] &
    Pick<
      PrismaClient,
      "validationRun" | "validationIssue" | "complianceRun" | "complianceIssue"
    >;
}

describe("unified read adapters", () => {
  it("maps validation runs with parity to domain mappers and expected shape", async () => {
    const db = buildMockDataSource();
    const validationRuns = [buildValidationRun()];
    db.validationRun.findMany = jest.fn().mockResolvedValue(validationRuns);

    const adapters = createUnifiedReadAdapters(db);
    const result = await adapters.listValidationRuns({
      projectId: "project-1",
      limit: 10,
    });

    expect(result).toEqual(mapValidationRunsToUnified(validationRuns));
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "val-run-1",
        source: "VALIDATION",
        status: "RUNNING",
        identifiers: expect.objectContaining({ fileId: "file-1" }),
      }),
    );

    expect(db.validationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "project-1" }),
        take: 10,
      }),
    );
  });

  it("maps compliance runs with parity, including nullable optional fields", async () => {
    const db = buildMockDataSource();
    const complianceRuns = [
      {
        ...buildComplianceRun(),
        ruleset: { name: "Ruleset A" },
      },
    ];
    db.complianceRun.findMany = jest.fn().mockResolvedValue(complianceRuns);

    const adapters = createUnifiedReadAdapters(db);
    const result = await adapters.listComplianceRuns({
      projectId: "project-1",
      limit: 5,
    });

    expect(result).toEqual(mapComplianceRunsToUnified(complianceRuns));
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "cmp-run-1",
        source: "COMPLIANCE",
        status: "COMPLETED",
        createdBy: null,
        identifiers: expect.objectContaining({
          modelName: null,
          rulesetName: "Ruleset A",
        }),
      }),
    );

    expect(db.complianceRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: "project-1" }),
        take: 5,
      }),
    );
  });

  it("maps validation issues with parity and expected shape", async () => {
    const db = buildMockDataSource();
    const validationIssues = [buildValidationIssue()];
    db.validationIssue.findMany = jest.fn().mockResolvedValue(validationIssues);

    const adapters = createUnifiedReadAdapters(db);
    const result = await adapters.listValidationIssues({
      runId: "val-run-1",
      status: "OPEN",
    });

    expect(result).toEqual(mapValidationIssuesToUnified(validationIssues));
    expect(result[0]).toEqual(
      expect.objectContaining({
        source: "VALIDATION",
        category: "MISSING",
        severity: "MEDIUM",
        status: "OPEN",
        element: expect.objectContaining({ tag: "E-1" }),
      }),
    );
  });

  it("maps compliance issues with parity for severity/category/status", async () => {
    const db = buildMockDataSource();
    const complianceIssues = [buildComplianceIssue()];
    db.complianceIssue.findMany = jest.fn().mockResolvedValue(complianceIssues);

    const adapters = createUnifiedReadAdapters(db);
    const result = await adapters.listComplianceIssues({
      runId: "cmp-run-1",
      severity: "WARNING",
      elementCategoryContains: "Pipe",
    });

    expect(result).toEqual(mapComplianceIssuesToUnified(complianceIssues));
    expect(result[0]).toEqual(
      expect.objectContaining({
        source: "COMPLIANCE",
        category: "RULE_VIOLATION",
        severity: "MEDIUM",
        status: "OPEN",
      }),
    );
  });

  it("returns null when run does not exist", async () => {
    const db = buildMockDataSource();
    db.validationRun.findUnique = jest.fn().mockResolvedValue(null);
    db.complianceRun.findUnique = jest.fn().mockResolvedValue(null);

    const adapters = createUnifiedReadAdapters(db);

    await expect(adapters.getValidationRunById("missing")).resolves.toBeNull();
    await expect(adapters.getComplianceRunById("missing")).resolves.toBeNull();
  });

  it("normalizes non-positive limits to defaults", async () => {
    const db = buildMockDataSource();
    db.validationRun.findMany = jest.fn().mockResolvedValue([]);
    db.complianceRun.findMany = jest.fn().mockResolvedValue([]);

    const adapters = createUnifiedReadAdapters(db);

    await adapters.listValidationRuns({ limit: 0 });
    await adapters.listComplianceRuns({ limit: -1 });

    expect(db.validationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    expect(db.complianceRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});

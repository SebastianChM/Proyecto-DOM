import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../../src/lib/prisma";
import { cacheService } from "../../../../src/lib/redis";
import { projectComplianceConfigService } from "../../../../src/services/compliance-v3/project-config.service";
import { propertyDictionaryService } from "../../../../src/services/dictionary/property-dictionary.service";
import {
  ComplianceRunnerV3Service,
  EVALUATION_TIMEOUT_MS,
  type IElementExtractor,
} from "../../../../src/services/compliance-v3/compliance-runner-v3.service";
import type { NormalizedElement } from "../../../../src/services/compliance-engine-v3";
import type { ResolvedRequirement } from "../../../../src/services/compliance-v3/project-config.service";

const RUN_ID = "00000000-0000-0000-0000-000000000001";
const PROJECT_ID = "00000000-0000-0000-0000-000000000002";
const CONFIG_ID = "00000000-0000-0000-0000-000000000003";
const MODEL_URN = "dXJuOmFkc2sub2JqZWN0czE6dGVzdA==";

const MOCK_CONFIG = { id: CONFIG_ID, projectId: PROJECT_ID };

const MOCK_RUN = {
  id: RUN_ID,
  projectId: PROJECT_ID,
  configId: CONFIG_ID,
  modelUrn: MODEL_URN,
  status: "COMPLETED",
  metadata: null,
  name: null,
  modelName: null,
  rulesetId: null,
  totalElements: null,
  totalRules: null,
  passedCount: null,
  failedCount: null,
  warningCount: null,
  complianceScore: null,
  startedAt: new Date(),
  completedAt: null,
  duration: null,
  errorMessage: null,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_REQUIREMENT: ResolvedRequirement = {
  id: "req-001",
  code: "CL-TEST-R001",
  packId: "pack-001",
  description: "Test requirement",
  legalReference: "Art. 4.5",
  discipline: "STRUCTURAL",
  severity: "MANDATORY",
  tags: [],
  notes: null,
  status: "VERIFIED",
  conditions: [
    {
      propertyCanonicalName: "Width",
      propertyAliases: [],
      operator: ">=",
      value: "100",
      unit: null,
      tolerance: 0,
      logicGroup: "AND",
    },
  ],
  applicability: {
    scope: "ALL",
    targetCategories: [],
    excludeCategories: [],
    propertyFilters: {},
  },
  overridden: false,
};

const MOCK_ELEMENT: NormalizedElement = {
  elementId: "el-001",
  name: "Wall Element",
  category: "Walls",
  properties: new Map([
    ["Width", { raw: "200", numeric: 200, unit: null, text: "200" }],
  ]),
};

const MOCK_MEMBER = { userId: "user-001" };

function makeExtractor(
  elements: NormalizedElement[] = [MOCK_ELEMENT],
): IElementExtractor {
  return {
    extract: jest
      .fn<() => Promise<NormalizedElement[]>>()
      .mockResolvedValue(elements),
  };
}

describe("ComplianceRunnerV3Service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setupBaseMocks() {
    jest.spyOn(prisma.complianceRun, "findFirst").mockResolvedValue(null);
    jest
      .spyOn(projectComplianceConfigService, "getConfig")
      .mockResolvedValue(MOCK_CONFIG as never);
    jest
      .spyOn(prisma.complianceRun, "create")
      .mockResolvedValue(MOCK_RUN as never);
    jest
      .spyOn(prisma.complianceRun, "update")
      .mockResolvedValue(MOCK_RUN as never);
    jest
      .spyOn(projectComplianceConfigService, "getResolved")
      .mockResolvedValue([MOCK_REQUIREMENT]);
    jest.spyOn(propertyDictionaryService, "getAll").mockResolvedValue([]);
    jest.spyOn(cacheService, "get").mockResolvedValue(null);
    jest.spyOn(cacheService, "set").mockResolvedValue(true);
    jest
      .spyOn(prisma.projectMember, "findMany")
      .mockResolvedValue([MOCK_MEMBER] as never);
    jest
      .spyOn(prisma, "$transaction")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(async (fnOrOps: any) => {
        if (typeof fnOrOps === "function") {
          return fnOrOps({
            complianceIssue: {
              create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
            },
            complianceRun: {
              update: jest
                .fn<() => Promise<unknown>>()
                .mockResolvedValue(MOCK_RUN),
            },
            notification: {
              create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
            },
          } as never);
        }
        return Promise.all(fnOrOps as Promise<unknown>[]);
      });
  }

  describe("evaluate", () => {
    it("should return runId when evaluation starts successfully", async () => {
      setupBaseMocks();
      const service = new ComplianceRunnerV3Service(makeExtractor());

      const result = await service.evaluate(PROJECT_ID, MODEL_URN);

      expect(result).toEqual({ runId: RUN_ID });
      expect(prisma.complianceRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: PROJECT_ID,
            modelUrn: MODEL_URN,
          }),
        }),
      );
    });

    it("should throw conflict when another run is already RUNNING for the project", async () => {
      jest
        .spyOn(prisma.complianceRun, "findFirst")
        .mockResolvedValue({ id: "existing-run" } as never);

      const service = new ComplianceRunnerV3Service(makeExtractor());

      await expect(
        service.evaluate(PROJECT_ID, MODEL_URN),
      ).rejects.toMatchObject({
        code: "EVALUATION_ALREADY_RUNNING",
        statusCode: 409,
      });
    });

    it("should throw badRequest when project has no compliance config", async () => {
      jest.spyOn(prisma.complianceRun, "findFirst").mockResolvedValue(null);
      jest
        .spyOn(projectComplianceConfigService, "getConfig")
        .mockResolvedValue(null);

      const service = new ComplianceRunnerV3Service(makeExtractor());

      await expect(
        service.evaluate(PROJECT_ID, MODEL_URN),
      ).rejects.toMatchObject({
        code: "NO_COMPLIANCE_CONFIG",
        statusCode: 400,
      });
    });

    it("should persist ComplianceIssues for FAIL evaluations when evaluation completes", async () => {
      setupBaseMocks();

      // Requirement condition demands Width >= 500 but element has Width = 200 → FAIL
      const failRequirement: ResolvedRequirement = {
        ...MOCK_REQUIREMENT,
        conditions: [
          {
            propertyCanonicalName: "Width",
            propertyAliases: [],
            operator: ">=",
            value: "500",
            unit: null,
            tolerance: 0,
            logicGroup: "AND",
          },
        ],
      };
      jest
        .spyOn(projectComplianceConfigService, "getResolved")
        .mockResolvedValue([failRequirement]);

      let issueCreated = false;
      jest
        .spyOn(prisma, "$transaction")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(async (fnOrOps: any) => {
          if (typeof fnOrOps === "function") {
            const mockCreateIssue = jest
              .fn<() => Promise<unknown>>()
              .mockImplementation(() => {
                issueCreated = true;
                return Promise.resolve({});
              });
            return fnOrOps({
              complianceIssue: { create: mockCreateIssue },
              complianceRun: {
                update: jest
                  .fn<() => Promise<unknown>>()
                  .mockResolvedValue(MOCK_RUN),
              },
              notification: {
                create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
              },
            } as never);
          }
          return Promise.all(fnOrOps as Promise<unknown>[]);
        });

      const service = new ComplianceRunnerV3Service(makeExtractor());
      await service.evaluate(PROJECT_ID, MODEL_URN);

      expect(issueCreated).toBe(true);
    });

    it("should mark run as COMPLETED with correct score when all elements pass", async () => {
      setupBaseMocks();

      // Element has Width = 200, requirement is Width >= 100 → PASS
      let completedStatus: string | undefined;
      jest
        .spyOn(prisma, "$transaction")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(async (fnOrOps: any) => {
          if (typeof fnOrOps === "function") {
            const mockTxUpdate = jest
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .fn<(...args: any[]) => Promise<unknown>>()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .mockImplementation((arg: any) => {
                completedStatus = arg?.data?.status;
                return Promise.resolve(MOCK_RUN);
              });
            return fnOrOps({
              complianceIssue: {
                create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
              },
              complianceRun: { update: mockTxUpdate },
              notification: {
                create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
              },
            } as never);
          }
          return Promise.all(fnOrOps as Promise<unknown>[]);
        });

      const service = new ComplianceRunnerV3Service(makeExtractor());
      await service.evaluate(PROJECT_ID, MODEL_URN);

      expect(completedStatus).toBe("COMPLETED");
    });

    it("should mark run as ERROR when element extractor throws", async () => {
      jest.spyOn(prisma.complianceRun, "findFirst").mockResolvedValue(null);
      jest
        .spyOn(projectComplianceConfigService, "getConfig")
        .mockResolvedValue(MOCK_CONFIG as never);
      jest
        .spyOn(prisma.complianceRun, "create")
        .mockResolvedValue(MOCK_RUN as never);
      const updateSpy = jest
        .spyOn(prisma.complianceRun, "update")
        .mockResolvedValue(MOCK_RUN as never);
      jest
        .spyOn(projectComplianceConfigService, "getResolved")
        .mockResolvedValue([MOCK_REQUIREMENT]);
      jest.spyOn(propertyDictionaryService, "getAll").mockResolvedValue([]);
      jest.spyOn(cacheService, "get").mockResolvedValue(null);
      jest
        .spyOn(prisma.projectMember, "findMany")
        .mockResolvedValue([MOCK_MEMBER] as never);
      jest
        .spyOn(prisma, "$transaction")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(async (fnOrOps: any) => {
          if (typeof fnOrOps === "function") {
            return fnOrOps({} as never);
          }
          return Promise.all(fnOrOps as Promise<unknown>[]);
        });

      const failingExtractor: IElementExtractor = {
        extract: jest
          .fn<() => Promise<NormalizedElement[]>>()
          .mockRejectedValue(new Error("APS unavailable")),
      };

      const service = new ComplianceRunnerV3Service(failingExtractor);
      await service.evaluate(PROJECT_ID, MODEL_URN);

      const errorCall = updateSpy.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any) =>
          (call[0] as { data: { status?: string } }).data?.status === "ERROR",
      );
      expect(errorCall).toBeDefined();
    });

    it("should create Notifications for all project members when run completes", async () => {
      setupBaseMocks();

      let notificationCount = 0;
      jest
        .spyOn(prisma, "$transaction")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockImplementation(async (fnOrOps: any) => {
          if (typeof fnOrOps === "function") {
            const mockCreateNotif = jest
              .fn<() => Promise<unknown>>()
              .mockImplementation(() => {
                notificationCount++;
                return Promise.resolve({});
              });
            return fnOrOps({
              complianceIssue: {
                create: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
              },
              complianceRun: {
                update: jest
                  .fn<() => Promise<unknown>>()
                  .mockResolvedValue(MOCK_RUN),
              },
              notification: { create: mockCreateNotif },
            } as never);
          }
          return Promise.all(fnOrOps as Promise<unknown>[]);
        });

      const service = new ComplianceRunnerV3Service(makeExtractor());
      await service.evaluate(PROJECT_ID, MODEL_URN);

      // 1 member → 1 notification
      expect(notificationCount).toBe(1);
    });

    it("should NOT persist issues when dryRun is true", async () => {
      setupBaseMocks();

      // Requirement that would FAIL
      const failRequirement: ResolvedRequirement = {
        ...MOCK_REQUIREMENT,
        conditions: [
          {
            propertyCanonicalName: "Width",
            propertyAliases: [],
            operator: ">=",
            value: "500",
            unit: null,
            tolerance: 0,
            logicGroup: "AND",
          },
        ],
      };
      jest
        .spyOn(projectComplianceConfigService, "getResolved")
        .mockResolvedValue([failRequirement]);

      const transactionSpy = jest.spyOn(prisma, "$transaction");

      const service = new ComplianceRunnerV3Service(makeExtractor());
      await service.evaluate(PROJECT_ID, MODEL_URN, { dryRun: true });

      // $transaction should NOT have been called (dryRun skips it)
      const transactionalCalls = transactionSpy.mock.calls.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any) => typeof call[0] === "function",
      );
      expect(transactionalCalls).toHaveLength(0);
    });
  });

  describe("getRunById", () => {
    it("should throw notFound when run does not exist", async () => {
      jest.spyOn(prisma.complianceRun, "findUnique").mockResolvedValue(null);

      const service = new ComplianceRunnerV3Service(makeExtractor());

      await expect(service.getRunById("nonexistent-id")).rejects.toMatchObject({
        code: "COMPLIANCE_RUN_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("listRunsByProject", () => {
    it("should return paginated runs when listing by project", async () => {
      jest
        .spyOn(prisma.complianceRun, "findMany")
        .mockResolvedValue([MOCK_RUN] as never);
      jest.spyOn(prisma.complianceRun, "count").mockResolvedValue(1);

      const service = new ComplianceRunnerV3Service(makeExtractor());
      const result = await service.listRunsByProject(PROJECT_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });
  });

  describe("getRunIssues", () => {
    it("should return paginated issues filtered by severity when getting run issues", async () => {
      jest
        .spyOn(prisma.complianceRun, "findUnique")
        .mockResolvedValue({ id: RUN_ID } as never);

      const MOCK_ISSUE = {
        id: "issue-001",
        runId: RUN_ID,
        ruleName: "CL-TEST-R001",
        ruleId: "req-001",
        elementId: "el-001",
        elementName: "Wall",
        elementCategory: "Walls",
        propertyName: "Width",
        expectedValue: "500",
        actualValue: "200",
        deviation: "0.6",
        severity: "CRITICAL",
        status: "OPEN",
        legalReference: "Art. 4.5",
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.complianceIssue, "findMany")
        .mockResolvedValue([MOCK_ISSUE] as never);
      jest.spyOn(prisma.complianceIssue, "count").mockResolvedValue(1);

      const service = new ComplianceRunnerV3Service(makeExtractor());
      const result = await service.getRunIssues(
        RUN_ID,
        { severity: "MANDATORY" },
        { page: 1, limit: 20 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);

      // Verify severity was mapped to DB value
      expect(prisma.complianceIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: "CRITICAL" }),
        }),
      );
    });

    it("should throw notFound when run does not exist for getRunIssues", async () => {
      jest.spyOn(prisma.complianceRun, "findUnique").mockResolvedValue(null);

      const service = new ComplianceRunnerV3Service(makeExtractor());

      await expect(
        service.getRunIssues("nonexistent-id", {}, { page: 1, limit: 20 }),
      ).rejects.toMatchObject({
        code: "COMPLIANCE_RUN_NOT_FOUND",
        statusCode: 404,
      });
    });
  });

  describe("evaluate — timeout", () => {
    it("should update run status to TIMEOUT when evaluation exceeds the timeout", async () => {
      setupBaseMocks();
      let dateNowCallCount = 0;
      jest.spyOn(Date, "now").mockImplementation(() => {
        dateNowCallCount++;
        return dateNowCallCount === 1 ? 0 : EVALUATION_TIMEOUT_MS + 1;
      });
      const updateSpy = jest
        .spyOn(prisma.complianceRun, "update")
        .mockResolvedValue(MOCK_RUN as never);

      const service = new ComplianceRunnerV3Service(makeExtractor());
      await service.evaluate(PROJECT_ID, MODEL_URN);

      const timeoutCall = updateSpy.mock.calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (call: any) =>
          (call[0] as { data: { status?: string } }).data?.status === "TIMEOUT",
      );
      expect(timeoutCall).toBeDefined();
    });
  });
});

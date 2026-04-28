import { describe, it, expect, beforeEach, jest } from "@jest/globals";

jest.mock("@/lib/axios-config", () => ({
  __esModule: true,
  default: { request: jest.fn() },
  _resetSessionExpiredGuard: jest.fn(),
}));

import apiClient from "@/lib/axios-config";

import {
  getPacks,
  getPackById,
  createPack,
  publishPack,
  getRequirements,
  createRequirement,
  getComplianceConfig,
  upsertComplianceConfig,
  evaluateCompliance,
  getRunById,
  getRunIssues,
  analyzeSuggestions,
  approveSuggestion,
  getProperties,
} from "@/lib/api/compliance-v3";

const mockRequest = apiClient.request as jest.MockedFunction<
  typeof apiClient.request
>;

function resolveWith(data: unknown, status = 200) {
  mockRequest.mockResolvedValueOnce({
    status,
    data,
    headers: {},
    config: {} as any,
    statusText: "OK",
  });
}

const PACK_ID = "pack-uuid-001";
const PROJECT_ID = "proj-uuid-abc";
const RUN_ID = "run-uuid-xyz";
const ANALYSIS_ID = "analysis-uuid-999";
const PACK_ID_2 = "pack-uuid-002";

const mockPack = {
  id: PACK_ID,
  code: "CL-OGUC-2024",
  name: "OGUC Chile 2024",
  country: "CL",
  version: "1.0.0",
  status: "DRAFT",
  scope: ["RESIDENTIAL"],
};

const mockPackList = {
  data: [mockPack],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const mockRequirement = {
  id: "req-uuid-001",
  code: "CL-OGUC-R001",
  description: "Minimum ceiling height for residential rooms",
  discipline: "ARCHITECTURAL",
  severity: "MANDATORY",
  status: "DRAFT",
  conditions: [],
};

const mockRequirementList = {
  data: [mockRequirement],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

const mockConfig = {
  id: "cfg-uuid-001",
  projectId: PROJECT_ID,
  packIds: [PACK_ID],
  overrides: [],
};

const mockRun = {
  id: RUN_ID,
  projectId: PROJECT_ID,
  status: "COMPLETED",
  complianceScore: 0.85,
  totalElements: 200,
  passedCount: 170,
  failedCount: 30,
  dryRun: false,
  startedAt: "2024-01-15T10:00:00Z",
};

const mockIssue = {
  id: "issue-uuid-001",
  runId: RUN_ID,
  elementId: "elem-001",
  ruleName: "CL-OGUC-R001",
  severity: "CRITICAL",
  actualValue: "2.1",
  expectedValue: ">= 2.3",
};

const mockAnalysis = {
  analysisId: ANALYSIS_ID,
  packId: PACK_ID,
  suggestions: [
    {
      description: "Room height must be >= 2.3m",
      legalReference: "OGUC Art. 4.1.6",
      discipline: "ARCHITECTURAL",
      severity: "MANDATORY",
      confidence: 0.92,
      conditions: [
        {
          propertyRef: "height",
          operator: ">=",
          value: "2.3",
          unit: "m",
          logicGroup: "AND",
          sortOrder: 0,
        },
      ],
    },
  ],
};

const mockProperty = {
  id: "prop-uuid-001",
  canonicalName: "height",
  displayName: "Height",
  aliases: ["altura"],
  unit: "m",
  locale: "es-CL",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRequest.mockClear();
});

describe("getPacks()", () => {
  it("should return pack list when called without params", async () => {
    resolveWith(mockPackList);
    const result = await getPacks();
    expect(result).toEqual(mockPackList);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: expect.stringContaining("/api/compliance-v3/packs"),
      }),
    );
  });

  it("should pass query params when filtering by country and status", async () => {
    resolveWith(mockPackList);
    await getPacks({ country: "CL", status: "PUBLISHED", page: 2 });
    const url: string = mockRequest.mock.calls[0][0].url as string;
    expect(url).toContain("country=CL");
    expect(url).toContain("status=PUBLISHED");
    expect(url).toContain("page=2");
  });
});

describe("getPackById()", () => {
  it("should return pack detail when given a valid id", async () => {
    resolveWith({ ...mockPack, requirements: [] });
    const result = await getPackById(PACK_ID);
    expect(result).toMatchObject({ id: PACK_ID, code: "CL-OGUC-2024" });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: `/api/compliance-v3/packs/${PACK_ID}` }),
    );
  });
});

describe("createPack()", () => {
  it("should POST new pack data and return created pack", async () => {
    resolveWith(mockPack, 201);
    const result = await createPack({
      code: "CL-OGUC-2024",
      name: "OGUC Chile 2024",
      country: "CL",
      version: "1.0.0",
      scope: ["RESIDENTIAL"],
    });
    expect(result).toMatchObject({ code: "CL-OGUC-2024" });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/api/compliance-v3/packs",
      }),
    );
  });
});

describe("publishPack()", () => {
  it("should POST to publish endpoint when given a valid pack id", async () => {
    resolveWith({ ...mockPack, status: "PUBLISHED" });
    const result = await publishPack(PACK_ID);
    expect(result).toMatchObject({ status: "PUBLISHED" });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/api/compliance-v3/packs/${PACK_ID}/publish`,
      }),
    );
  });
});

describe("getRequirements()", () => {
  it("should return requirement list for a pack with discipline filter", async () => {
    resolveWith(mockRequirementList);
    const result = await getRequirements(PACK_ID, {
      discipline: "ARCHITECTURAL",
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe("CL-OGUC-R001");
    const url: string = mockRequest.mock.calls[0][0].url as string;
    expect(url).toContain("discipline=ARCHITECTURAL");
  });
});

describe("createRequirement()", () => {
  it("should POST requirement to the correct pack endpoint", async () => {
    resolveWith(mockRequirement, 201);
    const result = await createRequirement(PACK_ID, {
      code: "CL-OGUC-R001",
      description: "Minimum ceiling height for residential rooms",
      legalReference: "OGUC Art. 4.1.6",
      discipline: "ARCHITECTURAL",
      severity: "MANDATORY",
      conditions: [],
    });
    expect(result.code).toBe("CL-OGUC-R001");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/api/compliance-v3/packs/${PACK_ID}/requirements`,
      }),
    );
  });
});

describe("getComplianceConfig()", () => {
  it("should return null when project has no configuration", async () => {
    resolveWith(null);
    const result = await getComplianceConfig(PROJECT_ID);
    expect(result).toBeNull();
  });

  it("should return config when project has configuration", async () => {
    resolveWith(mockConfig);
    const result = await getComplianceConfig(PROJECT_ID);
    expect(result).toMatchObject({ projectId: PROJECT_ID });
  });
});

describe("upsertComplianceConfig()", () => {
  it("should PUT pack ids and return updated config", async () => {
    resolveWith({ ...mockConfig, packIds: [PACK_ID, PACK_ID_2] });
    const result = await upsertComplianceConfig(PROJECT_ID, {
      packIds: [PACK_ID, PACK_ID_2],
    });
    expect(result.packIds).toHaveLength(2);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        url: expect.stringContaining("compliance-config"),
      }),
    );
  });
});

describe("evaluateCompliance()", () => {
  it("should POST evaluation params and return pending run", async () => {
    resolveWith({ ...mockRun, status: "PENDING" }, 202);
    const result = await evaluateCompliance(PROJECT_ID, {
      modelUrn: "urn:adsk.objects:os.object:bucket/model.rvt",
    });
    expect(result.status).toBe("PENDING");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("compliance/evaluate"),
      }),
    );
  });
});

describe("getRunById()", () => {
  it("should return completed run with score when given a run id", async () => {
    resolveWith(mockRun);
    const result = await getRunById(RUN_ID);
    expect(result).toMatchObject({
      id: RUN_ID,
      status: "COMPLETED",
      complianceScore: 0.85,
    });
  });
});

describe("getRunIssues()", () => {
  it("should pass severity filter in query string when filtering issues", async () => {
    resolveWith({
      data: [mockIssue],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    const result = await getRunIssues(RUN_ID, { severity: "CRITICAL" });
    expect(result.data).toHaveLength(1);
    const url: string = mockRequest.mock.calls[0][0].url as string;
    expect(url).toContain("severity=CRITICAL");
  });
});

describe("analyzeSuggestions()", () => {
  it("should POST text and return analysis with suggestions", async () => {
    resolveWith(mockAnalysis);
    const result = await analyzeSuggestions(PACK_ID, {
      text: "La altura mínima de sala de estar será 2.3m según Art. 4.1.6",
    });
    expect(result.analysisId).toBe(ANALYSIS_ID);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].confidence).toBeGreaterThan(0.8);
  });
});

describe("approveSuggestion()", () => {
  it("should POST to approve endpoint with index when approving a suggestion by index", async () => {
    resolveWith(mockRequirement, 201);
    const result = await approveSuggestion(ANALYSIS_ID, { index: 0 });
    expect(result).toMatchObject({ code: "CL-OGUC-R001" });
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `/api/compliance-v3/suggestions/${ANALYSIS_ID}/approve`,
      }),
    );
  });
});

describe("getProperties()", () => {
  it("should return array of property entries from dictionaries endpoint", async () => {
    resolveWith([mockProperty]);
    const result = await getProperties();
    expect(result).toHaveLength(1);
    expect(result[0].canonicalName).toBe("height");
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/compliance-v3/dictionaries/properties",
      }),
    );
  });
});

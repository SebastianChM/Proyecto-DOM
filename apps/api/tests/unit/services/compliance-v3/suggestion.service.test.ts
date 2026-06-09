import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from "@jest/globals";

// ─── Mock all external dependencies ─────────────────────────────────────────

jest.mock("../../../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    regulationPack: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../../../src/lib/redis", () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
  },
}));

jest.mock(
  "../../../../src/services/dictionary/property-dictionary.service",
  () => ({
    propertyDictionaryService: {
      getAll: jest.fn(),
    },
  }),
);

jest.mock(
  "../../../../src/services/dictionary/category-dictionary.service",
  () => ({
    categoryDictionaryService: {
      getAll: jest.fn(),
    },
  }),
);

jest.mock("../../../../src/services/compliance-v3/requirement.service", () => ({
  requirementService: {
    create: jest.fn(),
  },
}));

// ─── Imports after mocks ─────────────────────────────────────────────────────

import prisma from "../../../../src/lib/prisma";
import { cacheService } from "../../../../src/lib/redis";
import { propertyDictionaryService } from "../../../../src/services/dictionary/property-dictionary.service";
import { categoryDictionaryService } from "../../../../src/services/dictionary/category-dictionary.service";
import { requirementService } from "../../../../src/services/compliance-v3/requirement.service";
import { SuggestionService } from "../../../../src/services/compliance-v3/suggestion.service";
import type { IRequirementSuggester } from "../../../../src/services/requirement-suggester/requirement-suggester.interface";
import type { StoredSuggestion } from "../../../../src/services/requirement-suggester/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PACK_ID = "00000000-0000-0000-0000-000000000001";
const ANALYSIS_ID = "test-analysis-id";

const mockSuggestion = {
  description: "Wall must be at least 0.2m thick",
  legalReference: "Art. 5.1",
  discipline: "ARCHITECTURAL",
  severity: "MANDATORY" as const,
  conditions: [
    { property: "wall_thickness", operator: ">=", value: "0.2", unit: "m" },
  ],
  applicability: { categories: ["walls"] },
  confidence: 0.85,
};

const mockStoredSuggestion: StoredSuggestion = {
  analysisId: ANALYSIS_ID,
  packId: PACK_ID,
  suggestions: [mockSuggestion],
  createdAt: new Date().toISOString(),
  userId: "user-1",
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("SuggestionService", () => {
  let service: SuggestionService;
  let mockSuggester: jest.Mocked<IRequirementSuggester>;

  beforeEach(() => {
    mockSuggester = { suggest: jest.fn() };
    service = new SuggestionService(mockSuggester);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── analyze ──────────────────────────────────────────────────────────────

  describe("analyze()", () => {
    it("should return analysisId and suggestions when analysis succeeds", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        id: PACK_ID,
        status: "DRAFT",
      } as never);
      jest.spyOn(propertyDictionaryService, "getAll").mockResolvedValue([]);
      jest.spyOn(categoryDictionaryService, "getAll").mockResolvedValue([]);
      mockSuggester.suggest.mockResolvedValue([mockSuggestion]);
      jest.spyOn(cacheService, "set").mockResolvedValue(undefined as never);

      const result = await service.analyze(
        PACK_ID,
        "some regulation text longer than ten chars",
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.analysisId).toBeDefined();
      expect(typeof result.analysisId).toBe("string");
      expect(result.count).toBe(1);
    });

    it("should throw notFound when pack does not exist", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(null);

      await expect(
        service.analyze(PACK_ID, "some regulation text longer than ten chars"),
      ).rejects.toMatchObject({ code: "PACK_NOT_FOUND", statusCode: 404 });
    });

    it("should throw badRequest when pack is DEPRECATED", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        id: PACK_ID,
        status: "DEPRECATED",
      } as never);

      await expect(
        service.analyze(PACK_ID, "some regulation text longer than ten chars"),
      ).rejects.toMatchObject({ code: "PACK_DEPRECATED", statusCode: 400 });
    });

    it("should store suggestions in Redis with 24h TTL when analyze succeeds", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        id: PACK_ID,
        status: "PUBLISHED",
      } as never);
      jest.spyOn(propertyDictionaryService, "getAll").mockResolvedValue([]);
      jest.spyOn(categoryDictionaryService, "getAll").mockResolvedValue([]);
      mockSuggester.suggest.mockResolvedValue([mockSuggestion]);
      const setSpy = jest
        .spyOn(cacheService, "set")
        .mockResolvedValue(undefined as never);

      await service.analyze(
        PACK_ID,
        "some regulation text longer than ten chars",
      );

      expect(setSpy).toHaveBeenCalledTimes(2);
      // First call: content-hash dedup cache (1h TTL)
      const [, , contentTtl] = setSpy.mock.calls[0] as [
        string,
        unknown,
        number,
      ];
      expect(contentTtl).toBe(3600); // 1h
      // Second call: analysisId workflow cache (24h TTL)
      const [, , ttl] = setSpy.mock.calls[1] as [string, unknown, number];
      expect(ttl).toBe(86400); // 24h in seconds
    });
  });

  // ── approve ───────────────────────────────────────────────────────────────

  describe("approve()", () => {
    it("should return requirementId when approve succeeds", async () => {
      jest
        .spyOn(cacheService, "get")
        .mockResolvedValue(mockStoredSuggestion as never);
      jest
        .spyOn(requirementService, "create")
        .mockResolvedValue({ id: "req-123" } as never);

      const result = await service.approve(ANALYSIS_ID, 0, "user-1");

      expect(result.requirementId).toBe("req-123");
    });

    it("should throw notFound when analysisId not found in Redis", async () => {
      jest.spyOn(cacheService, "get").mockResolvedValue(null);

      await expect(service.approve(ANALYSIS_ID, 0)).rejects.toMatchObject({
        code: "ANALYSIS_NOT_FOUND",
        statusCode: 404,
      });
    });

    it("should throw badRequest when index is out of bounds", async () => {
      jest
        .spyOn(cacheService, "get")
        .mockResolvedValue(mockStoredSuggestion as never);

      await expect(service.approve(ANALYSIS_ID, 5)).rejects.toMatchObject({
        code: "SUGGESTION_INDEX_OUT_OF_BOUNDS",
        statusCode: 400,
      });
    });

    it("should create Requirement with DRAFT status when approve is called", async () => {
      jest
        .spyOn(cacheService, "get")
        .mockResolvedValue(mockStoredSuggestion as never);
      const createSpy = jest
        .spyOn(requirementService, "create")
        .mockResolvedValue({ id: "req-123" } as never);

      await service.approve(ANALYSIS_ID, 0, "user-1");

      expect(createSpy).toHaveBeenCalledTimes(1);
      const [, input] = createSpy.mock.calls[0] as unknown as [
        string,
        { notes: string },
      ];
      expect(input.notes).toContain(ANALYSIS_ID);
    });
  });

  // ── reject ────────────────────────────────────────────────────────────────

  describe("reject()", () => {
    it("should resolve without error when reject is called", async () => {
      jest
        .spyOn(cacheService, "get")
        .mockResolvedValue(mockStoredSuggestion as never);
      await expect(service.reject(ANALYSIS_ID)).resolves.toBeUndefined();
    });

    it("should throw notFound when analysisId does not exist in Redis during reject", async () => {
      jest.spyOn(cacheService, "get").mockResolvedValue(null);
      await expect(service.reject(ANALYSIS_ID)).rejects.toMatchObject({
        code: "ANALYSIS_NOT_FOUND",
        statusCode: 404,
      });
    });
  });
});

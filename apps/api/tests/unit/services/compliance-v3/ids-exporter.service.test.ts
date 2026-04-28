import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import prisma from "../../../../src/lib/prisma";
import { IdsExporterService } from "../../../../src/services/compliance-v3/ids-exporter.service";

jest.mock("../../../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    regulationPack: { findUnique: jest.fn() },
    requirement: { findMany: jest.fn() },
  },
}));

jest.mock("../../../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  regulationPack: { findUnique: jest.Mock };
  requirement: { findMany: jest.Mock };
};

const PACK_ID = "00000000-0000-0000-0000-000000000001";

const MOCK_PACK = {
  id: PACK_ID,
  code: "TEST-PACK",
  name: "Test Pack",
  description: null,
  country: "CL",
  version: "1.0",
  scope: ["STRUCTURAL"],
  status: "PUBLISHED",
  organizationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_REQUIREMENT = {
  id: "req-001",
  packId: PACK_ID,
  code: "ST-WALLS-R001",
  description: "Wall fire resistance",
  legalReference: "OGUC Art. 4.2",
  discipline: "STRUCTURAL",
  severity: "MANDATORY",
  status: "VERIFIED",
  tags: [],
  notes: null,
  verifiedBy: null,
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  conditions: [
    {
      id: "cond-001",
      requirementId: "req-001",
      propertyRef: "FireRating",
      operator: ">=",
      value: "120",
      unit: null,
      tolerance: null,
      logicGroup: "AND",
      sortOrder: 0,
    },
  ],
  applicability: {
    id: "app-001",
    requirementId: "req-001",
    targetCategories: ["IFCWALL"],
    excludeCategories: [],
    propertyFilters: null,
    scope: "FILTERED",
  },
};

const MOCK_REQUIREMENT_WITH_SPECIAL_CHARS = {
  ...MOCK_REQUIREMENT,
  id: "req-002",
  code: "ST-WALLS-R002 & <test>",
  description: 'Fire & smoke "barrier"',
  conditions: [
    {
      ...MOCK_REQUIREMENT.conditions[0],
      id: "cond-002",
      propertyRef: "Fire&Rating",
      value: "120 <min>",
    },
  ],
  applicability: {
    ...MOCK_REQUIREMENT.applicability,
    id: "app-002",
    requirementId: "req-002",
  },
};

describe("IdsExporterService", () => {
  let service: IdsExporterService;

  beforeEach(() => {
    service = new IdsExporterService();
    jest.clearAllMocks();
  });

  describe("exportPackToIds", () => {
    it("should return valid XML string starting with <?xml version when pack exists", async () => {
      (mockPrisma.regulationPack.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PACK as never,
      );
      (mockPrisma.requirement.findMany as jest.Mock).mockResolvedValue([
        MOCK_REQUIREMENT,
      ] as never);

      const xml = await service.exportPackToIds(PACK_ID);

      expect(xml).toMatch(/^<\?xml version/);
    });

    it("should include specification name from requirement code when exporting", async () => {
      (mockPrisma.regulationPack.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PACK as never,
      );
      (mockPrisma.requirement.findMany as jest.Mock).mockResolvedValue([
        MOCK_REQUIREMENT,
      ] as never);

      const xml = await service.exportPackToIds(PACK_ID);

      expect(xml).toContain('name="ST-WALLS-R001"');
    });

    it("should include baseName from condition propertyRef when building specification", async () => {
      (mockPrisma.regulationPack.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PACK as never,
      );
      (mockPrisma.requirement.findMany as jest.Mock).mockResolvedValue([
        MOCK_REQUIREMENT,
      ] as never);

      const xml = await service.exportPackToIds(PACK_ID);

      expect(xml).toContain("<simpleValue>FireRating</simpleValue>");
    });

    it("should return empty specifications element when pack has no verified requirements", async () => {
      (mockPrisma.regulationPack.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PACK as never,
      );
      (mockPrisma.requirement.findMany as jest.Mock).mockResolvedValue(
        [] as never,
      );

      const xml = await service.exportPackToIds(PACK_ID);

      expect(xml).toContain("<specifications>");
      expect(xml).not.toContain("<specification ");
    });

    it("should escape XML special characters in values when building property elements", async () => {
      (mockPrisma.regulationPack.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PACK as never,
      );
      (mockPrisma.requirement.findMany as jest.Mock).mockResolvedValue([
        MOCK_REQUIREMENT_WITH_SPECIAL_CHARS,
      ] as never);

      const xml = await service.exportPackToIds(PACK_ID);

      expect(xml).toContain("&amp;");
      expect(xml).toContain("&lt;");
      expect(xml).not.toContain("Fire&Rating");
    });

    it("should include all verified requirements when pack has multiple requirements", async () => {
      const secondReq = {
        ...MOCK_REQUIREMENT,
        id: "req-003",
        code: "ST-COLUMNS-R001",
        conditions: [
          {
            ...MOCK_REQUIREMENT.conditions[0],
            id: "cond-003",
            propertyRef: "LoadBearing",
          },
        ],
        applicability: {
          ...MOCK_REQUIREMENT.applicability,
          id: "app-003",
          requirementId: "req-003",
        },
      };
      (mockPrisma.regulationPack.findUnique as jest.Mock).mockResolvedValue(
        MOCK_PACK as never,
      );
      (mockPrisma.requirement.findMany as jest.Mock).mockResolvedValue([
        MOCK_REQUIREMENT,
        secondReq,
      ] as never);

      const xml = await service.exportPackToIds(PACK_ID);

      expect(xml).toContain('name="ST-WALLS-R001"');
      expect(xml).toContain('name="ST-COLUMNS-R001"');
    });
  });
});

import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../src/lib/prisma";
import { auditService } from "../../../src/services/audit.service";
import { RegulationPackService } from "../../../src/services/compliance-v3/regulation-pack.service";

describe("RegulationPackService", () => {
  const service = new RegulationPackService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockAudit = () =>
    jest.spyOn(auditService, "log").mockResolvedValue(undefined);

  const MOCK_PACK = {
    id: "pack-cl-oguc-001",
    code: "CL-OGUC-2026",
    name: "OGUC Chile 2026",
    description: "Ordenanza General de Urbanismo y Construcciones",
    country: "CL",
    version: "1.0.0",
    scope: ["STRUCTURAL", "ARCHITECTURAL"],
    status: "DRAFT",
    organizationId: null,
    publishedAt: null,
    deprecatedAt: null,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
  };

  describe("list", () => {
    it("should return paginated packs when packs exist", async () => {
      jest.spyOn(prisma.regulationPack, "findMany").mockResolvedValue(
        [{ ...MOCK_PACK, _count: { requirements: 3 } }] as never,
      );
      jest.spyOn(prisma.regulationPack, "count").mockResolvedValue(1);

      const result = await service.list({
        page: 1,
        limit: 20,
        sortOrder: "asc",
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("should filter by country when country is provided", async () => {
      const findManySpy = jest
        .spyOn(prisma.regulationPack, "findMany")
        .mockResolvedValue([] as never);
      jest.spyOn(prisma.regulationPack, "count").mockResolvedValue(0);

      await service.list({
        page: 1,
        limit: 20,
        sortOrder: "asc",
        country: "CL",
      });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ country: "CL" }),
        }),
      );
    });

    it("should return empty data when no packs match filters", async () => {
      jest.spyOn(prisma.regulationPack, "findMany").mockResolvedValue([] as never);
      jest.spyOn(prisma.regulationPack, "count").mockResolvedValue(0);

      const result = await service.list({
        page: 1,
        limit: 20,
        sortOrder: "asc",
        status: "PUBLISHED",
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe("getById", () => {
    it("should return pack with documents when pack exists", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        _count: { requirements: 5 },
        documents: [],
      } as never);

      const result = await service.getById("pack-cl-oguc-001");
      expect(result.code).toBe("CL-OGUC-2026");
    });

    it("should throw NotFound when pack does not exist", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(null);

      await expect(service.getById("nonexistent")).rejects.toThrow(
        "RegulationPack not found",
      );
    });
  });

  describe("create", () => {
    it("should create a DRAFT pack when code is unique", async () => {
      mockAudit();
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(null);
      jest.spyOn(prisma.regulationPack, "create").mockResolvedValue(
        MOCK_PACK as never,
      );

      const result = await service.create(
        {
          code: "CL-OGUC-2026",
          name: "OGUC Chile 2026",
          country: "CL",
          version: "1.0.0",
          scope: ["STRUCTURAL", "ARCHITECTURAL"],
        },
        "user-123",
      );

      expect(result.status).toBe("DRAFT");
      expect(result.code).toBe("CL-OGUC-2026");
    });

    it("should throw Conflict when code already exists", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(
        MOCK_PACK as never,
      );

      await expect(
        service.create(
          {
            code: "CL-OGUC-2026",
            name: "Duplicate",
            country: "CL",
            version: "1.0.0",
            scope: ["STRUCTURAL"],
          },
          "user-123",
        ),
      ).rejects.toThrow("Pack code already exists");
    });
  });

  describe("update", () => {
    it("should update pack when pack is in DRAFT status", async () => {
      mockAudit();
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        _count: { requirements: 0 },
        documents: [],
      } as never);
      jest.spyOn(prisma.regulationPack, "update").mockResolvedValue({
        ...MOCK_PACK,
        name: "OGUC Chile 2026 v2",
      } as never);

      const result = await service.update(
        "pack-cl-oguc-001",
        { name: "OGUC Chile 2026 v2" },
        "user-123",
      );

      expect(result.name).toBe("OGUC Chile 2026 v2");
    });

    it("should throw BadRequest when pack is PUBLISHED", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        status: "PUBLISHED",
        _count: { requirements: 0 },
        documents: [],
      } as never);

      await expect(
        service.update("pack-cl-oguc-001", { name: "Updated" }),
      ).rejects.toThrow("Only DRAFT packs can be updated");
    });
  });

  describe("publish", () => {
    it("should transition pack to PUBLISHED when pack is DRAFT", async () => {
      mockAudit();
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        _count: { requirements: 3 },
        documents: [],
      } as never);
      jest.spyOn(prisma.regulationPack, "update").mockResolvedValue({
        ...MOCK_PACK,
        status: "PUBLISHED",
        publishedAt: new Date(),
      } as never);

      const result = await service.publish("pack-cl-oguc-001", "user-123");
      expect(result.status).toBe("PUBLISHED");
    });

    it("should throw BadRequest when pack is already PUBLISHED", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        status: "PUBLISHED",
        _count: { requirements: 3 },
        documents: [],
      } as never);

      await expect(
        service.publish("pack-cl-oguc-001", "user-123"),
      ).rejects.toThrow("Only DRAFT packs can be published");
    });
  });

  describe("deprecate", () => {
    it("should transition pack to DEPRECATED when pack is PUBLISHED", async () => {
      mockAudit();
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        status: "PUBLISHED",
        _count: { requirements: 5 },
        documents: [],
      } as never);
      jest.spyOn(prisma.regulationPack, "update").mockResolvedValue({
        ...MOCK_PACK,
        status: "DEPRECATED",
        deprecatedAt: new Date(),
      } as never);

      const result = await service.deprecate("pack-cl-oguc-001", "user-123");
      expect(result.status).toBe("DEPRECATED");
    });

    it("should throw BadRequest when pack is DRAFT", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue({
        ...MOCK_PACK,
        _count: { requirements: 0 },
        documents: [],
      } as never);

      await expect(
        service.deprecate("pack-cl-oguc-001", "user-123"),
      ).rejects.toThrow("Only PUBLISHED packs can be deprecated");
    });
  });
});

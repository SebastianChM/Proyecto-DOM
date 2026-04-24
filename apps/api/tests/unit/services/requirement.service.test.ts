import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../src/lib/prisma";
import { auditService } from "../../../src/services/audit.service";
import { RequirementService } from "../../../src/services/compliance-v3/requirement.service";

describe("RequirementService", () => {
  const service = new RequirementService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockAudit = () =>
    jest.spyOn(auditService, "log").mockResolvedValue(undefined);

  const MOCK_PACK = {
    id: "pack-cl-oguc-001",
    code: "CL-OGUC-2026",
    name: "OGUC Chile 2026",
    status: "DRAFT",
  };

  const MOCK_REQUIREMENT = {
    id: "req-001",
    code: "CL-OGUC-R001",
    packId: "pack-cl-oguc-001",
    description: "Ancho minimo de pasillo de evacuacion segun OGUC Art. 4.2.5",
    legalReference: "OGUC Art. 4.2.5",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    status: "DRAFT",
    tags: ["evacuacion", "pasillo"],
    notes: null,
    verifiedBy: null,
    verifiedAt: null,
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
    conditions: [
      {
        id: "cond-001",
        requirementId: "req-001",
        propertyRef: "Width",
        operator: ">=",
        value: "1200",
        unit: "mm",
        tolerance: 0.05,
        logicGroup: "AND",
        sortOrder: 0,
      },
    ],
    applicability: {
      id: "app-001",
      requirementId: "req-001",
      targetCategories: ["Corridors"],
      excludeCategories: [],
      propertyFilters: null,
      scope: "FILTERED",
    },
  };

  const CREATE_INPUT = {
    code: "CL-OGUC-R001",
    description: "Ancho minimo de pasillo de evacuacion segun OGUC Art. 4.2.5",
    legalReference: "OGUC Art. 4.2.5",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY" as const,
    tags: ["evacuacion", "pasillo"],
    conditions: [
      {
        propertyRef: "Width",
        operator: ">=" as const,
        value: "1200",
        unit: "mm",
        tolerance: 0.05,
        logicGroup: "AND" as const,
        sortOrder: 0,
      },
    ],
    applicability: {
      targetCategories: ["Corridors"],
      excludeCategories: [],
      scope: "FILTERED" as const,
    },
  };

  describe("list", () => {
    it("should return paginated requirements when pack has requirements", async () => {
      jest.spyOn(prisma.requirement, "findMany").mockResolvedValue(
        [{ ...MOCK_REQUIREMENT, _count: { conditions: 1 } }] as never,
      );
      jest.spyOn(prisma.requirement, "count").mockResolvedValue(1);

      const result = await service.list("pack-cl-oguc-001", {
        page: 1,
        limit: 20,
        sortOrder: "asc",
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it("should filter by discipline when discipline is provided", async () => {
      const findManySpy = jest
        .spyOn(prisma.requirement, "findMany")
        .mockResolvedValue([] as never);
      jest.spyOn(prisma.requirement, "count").mockResolvedValue(0);

      await service.list("pack-cl-oguc-001", {
        page: 1,
        limit: 20,
        sortOrder: "asc",
        discipline: "STRUCTURAL",
      });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            packId: "pack-cl-oguc-001",
            discipline: "STRUCTURAL",
          }),
        }),
      );
    });
  });

  describe("getById", () => {
    it("should return requirement with conditions when requirement exists", async () => {
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );

      const result = await service.getById("req-001");
      expect(result.code).toBe("CL-OGUC-R001");
      expect(result.conditions).toHaveLength(1);
    });

    it("should throw NotFound when requirement does not exist", async () => {
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue(null);

      await expect(service.getById("nonexistent")).rejects.toThrow(
        "Requirement not found",
      );
    });
  });

  describe("create", () => {
    it("should create DRAFT requirement when pack exists", async () => {
      mockAudit();
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(
        MOCK_PACK as never,
      );
      jest.spyOn(prisma.requirement, "create").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );

      const result = await service.create(
        "pack-cl-oguc-001",
        CREATE_INPUT,
        "user-123",
      );

      expect(result.status).toBe("DRAFT");
      expect(result.code).toBe("CL-OGUC-R001");
    });

    it("should throw NotFound when pack does not exist", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(null);

      await expect(
        service.create("nonexistent", CREATE_INPUT, "user-123"),
      ).rejects.toThrow("RegulationPack not found");
    });
  });

  describe("update", () => {
    it("should update requirement when status is DRAFT", async () => {
      mockAudit();
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );
      jest.spyOn(prisma, "$transaction").mockImplementation(
        async (fn: unknown) => (fn as Function)({
          requirementCondition: { deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never) },
          applicabilityRule: { deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never) },
          requirement: {
            update: jest.fn().mockResolvedValue({
              ...MOCK_REQUIREMENT,
              description: "Updated description",
            } as never),
          },
        }),
      );

      const result = await service.update(
        "req-001",
        { description: "Updated description" },
        "user-123",
      );

      expect(result.description).toBe("Updated description");
    });

    it("should reset to DRAFT when updating a VERIFIED requirement", async () => {
      mockAudit();
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "VERIFIED",
        verifiedBy: "verifier-001",
        verifiedAt: new Date(),
      } as never);

      const mockUpdate = jest.fn().mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "DRAFT",
        verifiedBy: null,
        verifiedAt: null,
        description: "Updated after verification",
      } as never);

      jest.spyOn(prisma, "$transaction").mockImplementation(
        async (fn: unknown) => (fn as Function)({
          requirementCondition: { deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never) },
          applicabilityRule: { deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never) },
          requirement: { update: mockUpdate },
        }),
      );

      const result = await service.update(
        "req-001",
        { description: "Updated after verification" },
        "user-123",
      );

      expect(result.status).toBe("DRAFT");
      expect(result.verifiedBy).toBeNull();
    });

    it("should throw BadRequest when requirement is ACTIVE", async () => {
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "ACTIVE",
      } as never);

      await expect(
        service.update("req-001", { description: "Nope" }),
      ).rejects.toThrow("Only DRAFT or VERIFIED requirements can be updated");
    });
  });

  describe("verify", () => {
    it("should transition to VERIFIED when requirement is DRAFT", async () => {
      mockAudit();
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );
      jest.spyOn(prisma.requirement, "update").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "VERIFIED",
        verifiedBy: "verifier-001",
        verifiedAt: new Date(),
      } as never);

      const result = await service.verify("req-001", {
        userId: "verifier-001",
      });

      expect(result.status).toBe("VERIFIED");
      expect(result.verifiedBy).toBe("verifier-001");
    });

    it("should throw BadRequest when requirement is not DRAFT", async () => {
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "ACTIVE",
      } as never);

      await expect(
        service.verify("req-001", { userId: "verifier-001" }),
      ).rejects.toThrow("Only DRAFT requirements can be verified");
    });
  });

  describe("retire", () => {
    it("should transition to RETIRED when requirement is VERIFIED", async () => {
      mockAudit();
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "VERIFIED",
      } as never);
      jest.spyOn(prisma.requirement, "update").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "RETIRED",
      } as never);

      const result = await service.retire("req-001", "user-123");
      expect(result.status).toBe("RETIRED");
    });

    it("should throw BadRequest when requirement is DRAFT", async () => {
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );

      await expect(
        service.retire("req-001", "user-123"),
      ).rejects.toThrow("Only ACTIVE or VERIFIED requirements can be retired");
    });
  });

  describe("bulkCreate", () => {
    it("should create multiple requirements in transaction when pack exists", async () => {
      mockAudit();
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(
        MOCK_PACK as never,
      );
      jest.spyOn(prisma, "$transaction").mockImplementation(
        async (fn: unknown) => (fn as Function)({
          requirement: {
            create: jest.fn().mockResolvedValue(MOCK_REQUIREMENT as never),
          },
        }),
      );

      const result = await service.bulkCreate(
        "pack-cl-oguc-001",
        { requirements: [CREATE_INPUT] },
        "user-123",
      );

      expect(result).toHaveLength(1);
    });

    it("should throw NotFound when pack does not exist for bulk create", async () => {
      jest.spyOn(prisma.regulationPack, "findUnique").mockResolvedValue(null);

      await expect(
        service.bulkCreate(
          "nonexistent",
          { requirements: [CREATE_INPUT] },
          "user-123",
        ),
      ).rejects.toThrow("RegulationPack not found");
    });
  });

  describe("delete", () => {
    it("should physically delete requirement when status is DRAFT", async () => {
      mockAudit();
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );
      jest.spyOn(prisma.requirement, "delete").mockResolvedValue(
        MOCK_REQUIREMENT as never,
      );

      await expect(
        service.delete("req-001", "user-123"),
      ).resolves.toBeUndefined();
    });

    it("should throw BadRequest when requirement is not DRAFT", async () => {
      jest.spyOn(prisma.requirement, "findUnique").mockResolvedValue({
        ...MOCK_REQUIREMENT,
        status: "ACTIVE",
      } as never);

      await expect(
        service.delete("req-001", "user-123"),
      ).rejects.toThrow("Only DRAFT requirements can be deleted");
    });
  });
});

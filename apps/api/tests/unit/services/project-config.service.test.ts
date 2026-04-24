import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../src/lib/prisma";
import { auditService } from "../../../src/services/audit.service";
import { cacheService } from "../../../src/lib/redis";
import { ProjectComplianceConfigService } from "../../../src/services/compliance-v3/project-config.service";

describe("ProjectComplianceConfigService", () => {
  const service = new ProjectComplianceConfigService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockAudit = () =>
    jest.spyOn(auditService, "log").mockResolvedValue(undefined);

  const mockCacheGet = (value: unknown = null) =>
    jest.spyOn(cacheService, "get").mockResolvedValue(value);

  const mockCacheSet = () =>
    jest.spyOn(cacheService, "set").mockResolvedValue(true);

  const mockCacheDel = () =>
    jest.spyOn(cacheService, "del").mockResolvedValue(true);

  const MOCK_PACK = {
    id: "pack-001",
    code: "CL-OGUC-2026",
    name: "OGUC Chile 2026",
    status: "PUBLISHED",
    country: "CL",
    version: "1.0.0",
    scope: ["STRUCTURAL"],
  };

  const MOCK_CONFIG = {
    id: "config-001",
    projectId: "project-001",
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
    packs: [MOCK_PACK],
    overrides: [],
  };

  const MOCK_REQUIREMENT = {
    id: "req-001",
    code: "CL-OGUC-R001",
    packId: "pack-001",
    description: "Ancho minimo de pasillo",
    legalReference: "OGUC Art. 4.2.5",
    discipline: "ARCHITECTURAL",
    severity: "MANDATORY",
    tags: ["pasillo"],
    notes: null,
    status: "ACTIVE",
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
    applicability: null,
  };

  describe("getConfig", () => {
    it("should return config when project has one", async () => {
      mockCacheGet(null);
      mockCacheSet();
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue(MOCK_CONFIG as never);

      const result = await service.getConfig("project-001");

      expect(result).toEqual(MOCK_CONFIG);
    });

    it("should return null when project has no config", async () => {
      mockCacheGet(null);
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue(null);

      const result = await service.getConfig("project-999");

      expect(result).toBeNull();
    });
  });

  describe("upsertConfig", () => {
    it("should create config when project has none", async () => {
      mockAudit();
      mockCacheDel();

      jest
        .spyOn(prisma.regulationPack, "findMany")
        .mockResolvedValue([
          { id: "pack-001", status: "PUBLISHED", code: "CL-OGUC-2026" },
        ] as never);

      jest.spyOn(prisma, "$transaction").mockImplementation(async (fn) => {
        const tx = {
          projectComplianceConfig: {
            findUnique: jest.fn().mockResolvedValue(null as never),
            create: jest.fn().mockResolvedValue(MOCK_CONFIG as never),
          },
        };
        return fn(tx as never);
      });

      const result = await service.upsertConfig(
        "project-001",
        { packIds: ["pack-001"] },
        "user-001",
      );

      expect(result).toEqual(MOCK_CONFIG);
    });

    it("should update config when project already has one", async () => {
      mockAudit();
      mockCacheDel();

      jest
        .spyOn(prisma.regulationPack, "findMany")
        .mockResolvedValue([
          { id: "pack-001", status: "PUBLISHED", code: "CL-OGUC-2026" },
        ] as never);

      jest.spyOn(prisma, "$transaction").mockImplementation(async (fn) => {
        const tx = {
          projectComplianceConfig: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: "config-001" } as never),
            update: jest.fn().mockResolvedValue(MOCK_CONFIG as never),
          },
        };
        return fn(tx as never);
      });

      const result = await service.upsertConfig(
        "project-001",
        { packIds: ["pack-001"] },
        "user-001",
      );

      expect(result).toEqual(MOCK_CONFIG);
    });

    it("should throw BadRequest when packIds contains non-PUBLISHED pack", async () => {
      jest
        .spyOn(prisma.regulationPack, "findMany")
        .mockResolvedValue([
          { id: "pack-001", status: "DRAFT", code: "CL-OGUC-2026" },
        ] as never);

      await expect(
        service.upsertConfig("project-001", { packIds: ["pack-001"] }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "PACK_NOT_PUBLISHED",
      });
    });
  });

  describe("addOverride", () => {
    it("should add override when requirement exists", async () => {
      mockAudit();
      mockCacheDel();

      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue({
          id: "config-001",
          packs: [{ id: "pack-001", requirements: [{ id: "req-001" }] }],
        } as never);

      jest
        .spyOn(prisma.requirement, "findUnique")
        .mockResolvedValue({ id: "req-001", code: "CL-OGUC-R001" } as never);

      jest
        .spyOn(prisma.requirementOverride, "findUnique")
        .mockResolvedValue(null);

      const MOCK_OVERRIDE = {
        id: "override-001",
        configId: "config-001",
        requirementId: "req-001",
        action: "SKIP",
        newValue: null,
        newSeverity: null,
        reason: "Not applicable",
        approvedBy: "user-001",
        createdAt: new Date("2026-04-01"),
        requirement: {
          id: "req-001",
          code: "CL-OGUC-R001",
          description: "Ancho minimo",
        },
      };

      jest
        .spyOn(prisma.requirementOverride, "create")
        .mockResolvedValue(MOCK_OVERRIDE as never);

      const result = await service.addOverride(
        "project-001",
        {
          requirementId: "req-001",
          action: "SKIP",
          reason: "Not applicable",
          approvedBy: "user-001",
        },
        "user-001",
      );

      expect(result).toEqual(MOCK_OVERRIDE);
    });

    it("should throw conflict when override already exists for requirement", async () => {
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue({
          id: "config-001",
          packs: [{ id: "pack-001", requirements: [{ id: "req-001" }] }],
        } as never);

      jest
        .spyOn(prisma.requirement, "findUnique")
        .mockResolvedValue({ id: "req-001", code: "CL-OGUC-R001" } as never);

      jest
        .spyOn(prisma.requirementOverride, "findUnique")
        .mockResolvedValue({ id: "override-001" } as never);

      await expect(
        service.addOverride("project-001", {
          requirementId: "req-001",
          action: "SKIP",
          reason: "Not applicable",
          approvedBy: "user-001",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "OVERRIDE_ALREADY_EXISTS",
      });
    });

    it("should throw BadRequest when requirement does not belong to assigned packs", async () => {
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue({
          id: "config-001",
          packs: [{ id: "pack-002", requirements: [{ id: "req-other" }] }],
        } as never);

      jest
        .spyOn(prisma.requirement, "findUnique")
        .mockResolvedValue({ id: "req-001", code: "CL-OGUC-R001" } as never);

      await expect(
        service.addOverride("project-001", {
          requirementId: "req-001",
          action: "SKIP",
          reason: "Not applicable",
          approvedBy: "user-001",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: "REQUIREMENT_NOT_IN_ASSIGNED_PACKS",
      });
    });
  });

  describe("removeOverride", () => {
    it("should remove override when it exists", async () => {
      mockAudit();
      mockCacheDel();

      jest.spyOn(prisma.requirementOverride, "findUnique").mockResolvedValue({
        id: "override-001",
        configId: "config-001",
        requirementId: "req-001",
        config: { projectId: "project-001" },
      } as never);

      const deleteSpy = jest
        .spyOn(prisma.requirementOverride, "delete")
        .mockResolvedValue({} as never);

      await service.removeOverride("override-001", "user-001");

      expect(deleteSpy).toHaveBeenCalledWith({ where: { id: "override-001" } });
    });
  });

  describe("getResolved", () => {
    it("should return empty array when project has no config", async () => {
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue(null);

      const result = await service.getResolved("project-999");

      expect(result).toEqual([]);
    });

    it("should set overrideNewValue when override action is MODIFY_VALUE", async () => {
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue({
          packs: [{ id: "pack-001" }],
          overrides: [
            {
              requirementId: "req-modify",
              action: "MODIFY_VALUE",
              newValue: "1800",
              newSeverity: null,
              reason: "Updated threshold",
            },
          ],
        } as never);

      jest.spyOn(prisma.requirement, "findMany").mockResolvedValue([
        {
          ...MOCK_REQUIREMENT,
          id: "req-modify",
          code: "CL-MODIFY",
          severity: "MANDATORY",
        },
      ] as never);

      const result = await service.getResolved("project-001");

      expect(result).toHaveLength(1);
      const req = result[0];
      expect(req.overridden).toBe(true);
      expect(req.overrideAction).toBe("MODIFY_VALUE");
      expect(req.overrideNewValue).toBe("1800");
      expect(req.severity).toBe("MANDATORY");
      expect(req.overrideReason).toBe("Updated threshold");
    });

    it("should return resolved requirements with overrides applied", async () => {
      jest
        .spyOn(prisma.projectComplianceConfig, "findUnique")
        .mockResolvedValue({
          packs: [{ id: "pack-001" }],
          overrides: [
            {
              requirementId: "req-skip",
              action: "SKIP",
              newValue: null,
              newSeverity: null,
              reason: "Not applicable",
            },
            {
              requirementId: "req-severity",
              action: "CHANGE_SEVERITY",
              newValue: null,
              newSeverity: "INFO",
              reason: "Downgraded",
            },
          ],
        } as never);

      jest.spyOn(prisma.requirement, "findMany").mockResolvedValue([
        { ...MOCK_REQUIREMENT, id: "req-skip", code: "CL-SKIP" },
        {
          ...MOCK_REQUIREMENT,
          id: "req-severity",
          code: "CL-SEVERITY",
          severity: "MANDATORY",
        },
        {
          ...MOCK_REQUIREMENT,
          id: "req-plain",
          code: "CL-PLAIN",
          severity: "RECOMMENDED",
        },
      ] as never);

      const result = await service.getResolved("project-001");

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.code === "CL-SKIP")).toBeUndefined();

      const severityReq = result.find((r) => r.code === "CL-SEVERITY");
      expect(severityReq?.severity).toBe("INFO");
      expect(severityReq?.overridden).toBe(true);
      expect(severityReq?.overrideReason).toBe("Downgraded");

      const plainReq = result.find((r) => r.code === "CL-PLAIN");
      expect(plainReq?.severity).toBe("RECOMMENDED");
      expect(plainReq?.overridden).toBe(false);
    });
  });
});

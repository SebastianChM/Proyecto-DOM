import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../../src/lib/prisma";
import { cacheService } from "../../../../src/lib/redis";
import { CategoryDictionaryService } from "../../../../src/services/dictionary/category-dictionary.service";

describe("CategoryDictionaryService", () => {
  const service = new CategoryDictionaryService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("resolve", () => {
    it("should resolve exact category name when entry exists", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.categoryDictionary, "findFirst").mockResolvedValue({
        id: "cat-1",
        canonicalName: "Walls",
        locale: "en-US",
        displayName: "Walls",
        aliases: ["Wall"],
        revitCategory: "Walls",
        ifcEntity: "IfcWall",
        discipline: "ARCHITECTURAL",
        createdAt: new Date(),
      });

      const result = await service.resolve("Walls", "en-US");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Walls");
      expect(result!.revitCategory).toBe("Walls");
    });

    it("should resolve Spanish alias to canonical English name", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      // No exact match on canonicalName/displayName/revitCategory
      jest.spyOn(prisma.categoryDictionary, "findFirst").mockResolvedValue(null);
      jest.spyOn(prisma.categoryDictionary, "findMany").mockResolvedValue([
        {
          id: "cat-es-1",
          canonicalName: "Walls",
          locale: "es-CL",
          displayName: "Muros",
          aliases: ["Muro", "Tabique", "Pared", "Paredes"],
          revitCategory: "Walls",
          ifcEntity: "IfcWall",
          discipline: "ARCHITECTURAL",
          createdAt: new Date(),
        },
      ]);

      const result = await service.resolve("Tabique", "es-CL");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Walls");
      expect(result!.displayName).toBe("Muros");
    });

    it("should resolve by revitCategory name when queried directly", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.categoryDictionary, "findFirst").mockResolvedValue({
        id: "cat-1",
        canonicalName: "Structural Beams",
        locale: "es-CL",
        displayName: "Vigas Estructurales",
        aliases: ["Vigas", "Viga"],
        revitCategory: "Structural Framing",
        ifcEntity: "IfcBeam",
        discipline: "STRUCTURAL",
        createdAt: new Date(),
      });

      const result = await service.resolve("Structural Framing", "es-CL");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Structural Beams");
    });

    it("should return null for unknown category", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.categoryDictionary, "findFirst").mockResolvedValue(null);
      jest.spyOn(prisma.categoryDictionary, "findMany").mockResolvedValue([]);

      const result = await service.resolve("SpaceShips", "en-US");

      expect(result).toBeNull();
    });

    it("should match alias case-insensitively when alias has different casing", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.categoryDictionary, "findFirst").mockResolvedValue(null);
      jest.spyOn(prisma.categoryDictionary, "findMany").mockResolvedValue([
        {
          id: "cat-1",
          canonicalName: "Cable Trays",
          locale: "es-CL",
          displayName: "Bandejas Portacables",
          aliases: ["Bandeja", "Bandeja Portacable", "Bandejas"],
          revitCategory: "Cable Trays",
          ifcEntity: "IfcCableCarrierSegment",
          discipline: "ELECTRICAL",
          createdAt: new Date(),
        },
      ]);

      const result = await service.resolve("bandeja", "es-CL");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Cable Trays");
    });
  });

  describe("getAll", () => {
    it("should return all categories for a given locale", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.categoryDictionary, "findMany").mockResolvedValue([
        {
          id: "cat-1",
          canonicalName: "Doors",
          locale: "es-CL",
          displayName: "Puertas",
          aliases: ["Puerta"],
          revitCategory: "Doors",
          ifcEntity: "IfcDoor",
          discipline: "ARCHITECTURAL",
          createdAt: new Date(),
        },
        {
          id: "cat-2",
          canonicalName: "Pipes",
          locale: "es-CL",
          displayName: "Tuberías",
          aliases: ["Tubería"],
          revitCategory: "Pipes",
          ifcEntity: "IfcPipeSegment",
          discipline: "MEP",
          createdAt: new Date(),
        },
      ]);

      const result = await service.getAll("es-CL");

      expect(result).toHaveLength(2);
      expect(result[0].canonicalName).toBe("Doors");
    });

    it("should use cache with correct key and TTL", async () => {
      jest.spyOn(cacheService, "getOrSet").mockResolvedValue([]);

      await service.getAll("en-US");

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        "dict:category:all:en-US",
        expect.any(Function),
        3600,
      );
    });
  });
});

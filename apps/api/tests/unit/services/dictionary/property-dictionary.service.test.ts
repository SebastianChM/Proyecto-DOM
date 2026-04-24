import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../../src/lib/prisma";
import { cacheService } from "../../../../src/lib/redis";
import { PropertyDictionaryService } from "../../../../src/services/dictionary/property-dictionary.service";

describe("PropertyDictionaryService", () => {
  const service = new PropertyDictionaryService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("resolve", () => {
    it("should resolve exact canonical name match when entry exists", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findFirst").mockResolvedValue({
        id: "prop-1",
        canonicalName: "Width",
        locale: "es-CL",
        displayName: "Ancho",
        aliases: ["Anchura", "W"],
        revitPropertyPath: "Dimensions.Width",
        ifcPropertyPath: null,
        unit: "mm",
        dataType: "NUMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolve("Width", "es-CL");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Width");
      expect(result!.displayName).toBe("Ancho");
    });

    it("should resolve display name match when queried in Spanish", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findFirst").mockResolvedValue({
        id: "prop-1",
        canonicalName: "Width",
        locale: "es-CL",
        displayName: "Ancho",
        aliases: ["Anchura", "W"],
        revitPropertyPath: "Dimensions.Width",
        ifcPropertyPath: null,
        unit: "mm",
        dataType: "NUMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolve("Ancho", "es-CL");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Width");
    });

    it("should resolve alias match case-insensitively when alias exists", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      // No exact match
      jest.spyOn(prisma.propertyDictionary, "findFirst").mockResolvedValue(null);
      // Alias search
      jest.spyOn(prisma.propertyDictionary, "findMany").mockResolvedValue([
        {
          id: "prop-1",
          canonicalName: "Width",
          locale: "es-CL",
          displayName: "Ancho",
          aliases: ["Anchura", "W", "Ancho Total"],
          revitPropertyPath: "Dimensions.Width",
          ifcPropertyPath: null,
          unit: "mm",
          dataType: "NUMBER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.resolve("anchura", "es-CL");

      expect(result).not.toBeNull();
      expect(result!.canonicalName).toBe("Width");
    });

    it("should return null when no match found for unknown property", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findFirst").mockResolvedValue(null);
      jest.spyOn(prisma.propertyDictionary, "findMany").mockResolvedValue([]);

      const result = await service.resolve("NonExistentProperty", "es-CL");

      expect(result).toBeNull();
    });

    it("should filter by locale when same canonical name exists in multiple locales", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findFirst").mockResolvedValue({
        id: "prop-en",
        canonicalName: "Width",
        locale: "en-US",
        displayName: "Width",
        aliases: ["W", "Wd"],
        revitPropertyPath: "Dimensions.Width",
        ifcPropertyPath: null,
        unit: "mm",
        dataType: "NUMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resolve("Width", "en-US");

      expect(result).not.toBeNull();
      expect(result!.locale).toBe("en-US");
      expect(result!.displayName).toBe("Width");
    });

    it("should use cache when resolving same property twice", async () => {
      jest.spyOn(cacheService, "getOrSet").mockResolvedValue({
        id: "prop-1",
        canonicalName: "Width",
        locale: "es-CL",
        displayName: "Ancho",
        aliases: [],
        unit: "mm",
        dataType: "NUMBER",
      });

      await service.resolve("Width", "es-CL");

      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        "dict:property:resolve:es-CL:width",
        expect.any(Function),
        3600,
      );
    });
  });

  describe("getByCanonical", () => {
    it("should return property entry when canonical name and locale match", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findUnique").mockResolvedValue({
        id: "prop-1",
        canonicalName: "FireRating",
        locale: "es-CL",
        displayName: "Resistencia al Fuego",
        aliases: ["RF", "F-Rating"],
        revitPropertyPath: "Identity Data.Fire Rating",
        ifcPropertyPath: "Pset_WallCommon.FireRating",
        unit: null,
        dataType: "STRING",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getByCanonical("FireRating", "es-CL");

      expect(result.canonicalName).toBe("FireRating");
      expect(result.displayName).toBe("Resistencia al Fuego");
    });

    it("should throw NotFound when canonical name does not exist", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findUnique").mockResolvedValue(null);

      await expect(
        service.getByCanonical("NonExistent", "es-CL"),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "PROPERTY_NOT_FOUND",
      });
    });
  });

  describe("getAll", () => {
    it("should return all properties for a given locale", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.propertyDictionary, "findMany").mockResolvedValue([
        {
          id: "prop-1",
          canonicalName: "Height",
          locale: "en-US",
          displayName: "Height",
          aliases: ["H"],
          revitPropertyPath: "Dimensions.Height",
          ifcPropertyPath: null,
          unit: "mm",
          dataType: "NUMBER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "prop-2",
          canonicalName: "Width",
          locale: "en-US",
          displayName: "Width",
          aliases: ["W"],
          revitPropertyPath: "Dimensions.Width",
          ifcPropertyPath: null,
          unit: "mm",
          dataType: "NUMBER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getAll("en-US");

      expect(result).toHaveLength(2);
      expect(result[0].canonicalName).toBe("Height");
      expect(result[1].canonicalName).toBe("Width");
    });
  });
});

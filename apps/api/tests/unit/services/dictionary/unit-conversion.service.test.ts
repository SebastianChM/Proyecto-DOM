import { describe, it, expect, jest, afterEach } from "@jest/globals";
import prisma from "../../../../src/lib/prisma";
import { cacheService } from "../../../../src/lib/redis";
import { UnitConversionService } from "../../../../src/services/dictionary/unit-conversion.service";

describe("UnitConversionService", () => {
  const service = new UnitConversionService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("convert", () => {
    it("should convert mm to m using direct conversion factor", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue({
        id: "uc-1",
        fromUnit: "mm",
        toUnit: "m",
        factor: 0.001,
        category: "length",
      });

      const result = await service.convert(300, "mm", "m");

      expect(result).toBeCloseTo(0.3, 6);
    });

    it("should convert MPa to Pa using direct conversion factor", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue({
        id: "uc-2",
        fromUnit: "MPa",
        toUnit: "Pa",
        factor: 1e6,
        category: "pressure",
      });

      const result = await service.convert(30, "MPa", "Pa");

      expect(result).toBeCloseTo(30000000, 0);
    });

    it("should convert psi to Pa using direct conversion factor", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue({
        id: "uc-3",
        fromUnit: "psi",
        toUnit: "Pa",
        factor: 6894.76,
        category: "pressure",
      });

      const result = await service.convert(100, "psi", "Pa");

      expect(result).toBeCloseTo(689476, 0);
    });

    it("should handle identity conversion when from and to units are the same", async () => {
      const result = await service.convert(42, "m", "m");

      expect(result).toBe(42);
    });

    it("should use inverse conversion when only reverse pair exists", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      // Direct not found
      jest
        .spyOn(prisma.unitConversion, "findUnique")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "uc-4",
          fromUnit: "mm",
          toUnit: "m",
          factor: 0.001,
          category: "length",
        });

      const result = await service.convert(0.5, "m", "mm");

      expect(result).toBeCloseTo(500, 0);
    });

    it("should throw NotFound when no conversion pair exists for unknown units", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue(null);

      await expect(
        service.convert(100, "parsecs", "lightyears"),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "UNIT_CONVERSION_NOT_FOUND",
      });
    });

    it("should convert kW to W for electrical power units", async () => {
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue({
        id: "uc-5",
        fromUnit: "kW",
        toUnit: "W",
        factor: 1000,
        category: "electrical_power",
      });

      const result = await service.convert(2.5, "kW", "W");

      expect(result).toBeCloseTo(2500, 0);
    });
  });

  describe("normalize", () => {
    it("should normalize mm to SI base unit m", async () => {
      jest.spyOn(prisma.unitConversion, "findFirst").mockResolvedValue({
        id: "uc-1",
        fromUnit: "mm",
        toUnit: "m",
        factor: 0.001,
        category: "length",
      });
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue({
        id: "uc-1",
        fromUnit: "mm",
        toUnit: "m",
        factor: 0.001,
        category: "length",
      });

      const result = await service.normalize(1500, "mm");

      expect(result.value).toBeCloseTo(1.5, 6);
      expect(result.unit).toBe("m");
      expect(result.originalUnit).toBe("mm");
    });

    it("should return value unchanged when unit is already SI base", async () => {
      jest.spyOn(prisma.unitConversion, "findFirst").mockResolvedValue(null);

      const result = await service.normalize(9.81, "m");

      expect(result.value).toBe(9.81);
      expect(result.unit).toBe("m");
      expect(result.originalUnit).toBe("m");
    });

    it("should normalize kPa to Pa for pressure units", async () => {
      jest.spyOn(prisma.unitConversion, "findFirst").mockResolvedValue({
        id: "uc-2",
        fromUnit: "kPa",
        toUnit: "Pa",
        factor: 1000,
        category: "pressure",
      });
      jest.spyOn(cacheService, "getOrSet").mockImplementation(
        async (_key, fetcher) => fetcher(),
      );
      jest.spyOn(prisma.unitConversion, "findUnique").mockResolvedValue({
        id: "uc-2",
        fromUnit: "kPa",
        toUnit: "Pa",
        factor: 1000,
        category: "pressure",
      });

      const result = await service.normalize(101.325, "kPa");

      expect(result.value).toBeCloseTo(101325, 0);
      expect(result.unit).toBe("Pa");
      expect(result.originalUnit).toBe("kPa");
    });
  });
});

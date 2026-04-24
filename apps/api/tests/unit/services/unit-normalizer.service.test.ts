import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { unitConversionService } from "../../../src/services/dictionary/unit-conversion.service";
import { logger } from "../../../src/lib/logger";
import { UnitNormalizerService } from "../../../src/services/unit-normalizer.service";

describe("UnitNormalizerService", () => {
  const service = new UnitNormalizerService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should normalize "100mm" to { value: 0.1, unit: "m" } when unit is millimeters', async () => {
    jest
      .spyOn(unitConversionService, "normalize")
      .mockResolvedValue({ value: 0.1, unit: "m", originalUnit: "mm" });

    const result = await service.normalize("100mm");

    expect(result).not.toBeNull();
    expect(result!.original).toBe("100mm");
    expect(result!.numericValue).toBe(100);
    expect(result!.unit).toBe("mm");
    expect(result!.standardValue).toBe(0.1);
    expect(result!.standardUnit).toBe("m");
  });

  it('should normalize "30MPa" to { value: 30000000, unit: "Pa" }', async () => {
    jest
      .spyOn(unitConversionService, "normalize")
      .mockResolvedValue({ value: 30000000, unit: "Pa", originalUnit: "MPa" });

    const result = await service.normalize("30MPa");

    expect(result).not.toBeNull();
    expect(result!.original).toBe("30MPa");
    expect(result!.numericValue).toBe(30);
    expect(result!.unit).toBe("MPa");
    expect(result!.standardValue).toBe(30000000);
    expect(result!.standardUnit).toBe("Pa");
  });

  it("should handle value gracefully when unit is missing", async () => {
    // "100" has no unit part — regex won't match
    const result = await service.normalize("100");

    expect(result).toBeNull();
  });

  it("should handle invalid input gracefully", async () => {
    jest.spyOn(logger, "warn").mockImplementation(() => {});

    // Empty string
    const result1 = await service.normalize("");
    expect(result1).toBeNull();

    // Non-numeric
    const result2 = await service.normalize("abc");
    expect(result2).toBeNull();

    // Symbols only
    const result3 = await service.normalize("@#$");
    expect(result3).toBeNull();
  });

  it("should handle comma decimal separator", async () => {
    jest
      .spyOn(unitConversionService, "normalize")
      .mockResolvedValue({ value: 0.0025, unit: "m", originalUnit: "mm" });

    const result = await service.normalize("2,5mm");

    expect(result).not.toBeNull();
    expect(result!.numericValue).toBe(2.5);
    expect(result!.unit).toBe("mm");
  });

  it("should handle spaces between value and unit", async () => {
    jest
      .spyOn(unitConversionService, "normalize")
      .mockResolvedValue({ value: 20, unit: "m", originalUnit: "m" });

    const result = await service.normalize("20 m");

    expect(result).not.toBeNull();
    expect(result!.numericValue).toBe(20);
    expect(result!.unit).toBe("m");
  });

  it("should return null when unit conversion service throws", async () => {
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    jest
      .spyOn(unitConversionService, "normalize")
      .mockRejectedValue(new Error("No conversion found"));

    const result = await service.normalize("100xyz");

    expect(result).toBeNull();
  });
});

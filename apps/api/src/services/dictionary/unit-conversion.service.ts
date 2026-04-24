import prisma from "../../lib/prisma";
import { cacheService } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { notFound } from "../../lib/errors";
import type { NormalizedValue, IUnitConversionService } from "./types";

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = "dict:unit";

// SI base units per category
const SI_BASE_UNITS: Record<string, string> = {
  length: "m",
  area: "m2",
  volume: "m3",
  pressure: "Pa",
  electrical_voltage: "V",
  electrical_current: "A",
  electrical_power: "W",
  temperature: "K",
  mass: "kg",
  force: "N",
  angle: "rad",
};

export class UnitConversionService implements IUnitConversionService {
  /**
   * Convert a value from one unit to another.
   * Throws NotFound if the conversion pair is not registered.
   */
  async convert(
    value: number,
    fromUnit: string,
    toUnit: string,
  ): Promise<number> {
    // Identity conversion
    if (fromUnit === toUnit) return value;

    const cacheKey = `${CACHE_PREFIX}:${fromUnit}:${toUnit}`;

    const factor = await cacheService.getOrSet(
      cacheKey,
      async () => {
        // Try direct conversion
        const direct = await prisma.unitConversion.findUnique({
          where: { fromUnit_toUnit: { fromUnit, toUnit } },
        });

        if (direct) return direct.factor;

        // Try inverse conversion
        const inverse = await prisma.unitConversion.findUnique({
          where: { fromUnit_toUnit: { fromUnit: toUnit, toUnit: fromUnit } },
        });

        if (inverse) return 1 / inverse.factor;

        return null;
      },
      CACHE_TTL,
    );

    if (factor === null) {
      throw notFound(
        `No conversion found from "${fromUnit}" to "${toUnit}"`,
        "UNIT_CONVERSION_NOT_FOUND",
      );
    }

    return value * factor;
  }

  /**
   * Normalize a value to its SI base unit.
   * E.g., 300 mm → { value: 0.3, unit: "m", originalUnit: "mm" }
   */
  async normalize(value: number, unit: string): Promise<NormalizedValue> {
    // Look up the conversion entry to find its category
    const entry = await prisma.unitConversion.findFirst({
      where: { fromUnit: unit },
    });

    if (!entry) {
      // Maybe it's already a base unit
      const isBase = Object.values(SI_BASE_UNITS).includes(unit);
      if (isBase) {
        return { value, unit, originalUnit: unit };
      }

      logger.warn("[UnitConversion] No conversion found for unit", { unit });
      return { value, unit, originalUnit: unit };
    }

    const baseUnit = SI_BASE_UNITS[entry.category];
    if (!baseUnit) {
      logger.warn("[UnitConversion] Unknown category for normalization", {
        unit,
        category: entry.category,
      });
      return { value, unit, originalUnit: unit };
    }

    const converted = await this.convert(value, unit, baseUnit);
    return { value: converted, unit: baseUnit, originalUnit: unit };
  }

  async getAll(): Promise<
    Array<{ fromUnit: string; toUnit: string; factor: number }>
  > {
    const cacheKey = `${CACHE_PREFIX}:all`;
    const result = await cacheService.getOrSet(
      cacheKey,
      () =>
        prisma.unitConversion.findMany({
          select: { fromUnit: true, toUnit: true, factor: true },
        }),
      CACHE_TTL * 6,
    );
    return result ?? [];
  }
}

export const unitConversionService = new UnitConversionService();

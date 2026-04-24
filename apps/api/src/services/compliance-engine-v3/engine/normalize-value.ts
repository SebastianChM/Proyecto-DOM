import type { NormalizedValue, UnitConversionMap } from "../types";

/**
 * Normalizes a raw property value string into a structured NormalizedValue.
 *
 * If `unit` is provided and a numeric value is parsed, the function attempts to
 * convert the numeric to its SI base unit using `conversions`.
 *
 * @param raw - The raw string value from the BIM element property.
 * @param unit - The unit associated with the raw value, or null if unitless.
 * @param conversions - A Map<fromUnit, Map<toUnit, factor>> for unit conversion.
 *   The inner Map MUST contain exactly one entry: the SI base unit target for the
 *   given source unit. If multiple entries exist, only the first (by insertion order)
 *   is used. Example of correct construction:
 *   `new Map([["mm", new Map([["m", 0.001]])]])`
 */
export function normalizeValue(
  raw: string,
  unit: string | null,
  conversions: UnitConversionMap,
): NormalizedValue {
  const text = raw.trim().toLowerCase();
  const parsed = parseFloat(raw);
  let numeric: number | null = isNaN(parsed) ? null : parsed;
  let resolvedUnit = unit;

  if (unit !== null && numeric !== null) {
    const fromMap = conversions.get(unit);
    if (fromMap) {
      const entries = Array.from(fromMap.entries());
      if (entries.length > 0) {
        const [toUnit, factor] = entries[0];
        numeric = numeric * factor;
        resolvedUnit = toUnit;
      }
    }
  }

  return { raw, numeric, unit: resolvedUnit, text };
}

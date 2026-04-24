import { describe, it, expect } from "@jest/globals";
import { normalizeValue } from "../../../../src/services/compliance-engine-v3/engine/normalize-value";
import type { UnitConversionMap } from "../../../../src/services/compliance-engine-v3/types";

function makeConversions(
  entries: [string, [string, number][]][],
): UnitConversionMap {
  const map: UnitConversionMap = new Map();
  for (const [from, targets] of entries) {
    const inner = new Map<string, number>(targets);
    map.set(from, inner);
  }
  return map;
}

describe("normalizeValue", () => {
  const emptyConversions: UnitConversionMap = new Map();

  it("should parse numeric value correctly", () => {
    const result = normalizeValue("42", null, emptyConversions);
    expect(result.numeric).toBe(42);
    expect(result.raw).toBe("42");
  });

  it("should return null numeric for non-numeric string", () => {
    const result = normalizeValue("concrete", null, emptyConversions);
    expect(result.numeric).toBeNull();
  });

  it("should convert mm to m using conversion map", () => {
    const conversions = makeConversions([["mm", [["m", 0.001]]]]);
    const result = normalizeValue("1000", "mm", conversions);
    expect(result.numeric).toBeCloseTo(1);
    expect(result.unit).toBe("m");
  });

  it("should return original value when no conversion exists", () => {
    const result = normalizeValue("500", "psi", emptyConversions);
    expect(result.numeric).toBe(500);
    expect(result.unit).toBe("psi");
  });

  it("should lowercase and trim text", () => {
    const result = normalizeValue("  Concrete  ", null, emptyConversions);
    expect(result.text).toBe("concrete");
  });

  it("should handle empty string", () => {
    const result = normalizeValue("", null, emptyConversions);
    expect(result.numeric).toBeNull();
    expect(result.text).toBe("");
    expect(result.raw).toBe("");
  });
});

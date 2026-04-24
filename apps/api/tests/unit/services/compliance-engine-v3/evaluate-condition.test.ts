import { describe, it, expect } from "@jest/globals";
import { evaluateCondition } from "../../../../src/services/compliance-engine-v3/engine/evaluate-condition";
import type {
  ResolvedCondition,
  NormalizedValue,
} from "../../../../src/services/compliance-engine-v3/types";

function makeCondition(
  overrides: Partial<ResolvedCondition>,
): ResolvedCondition {
  return {
    propertyCanonicalName: "Width",
    propertyAliases: [],
    operator: ">=",
    value: "200",
    unit: "mm",
    tolerance: 0,
    logicGroup: "AND",
    ...overrides,
  };
}

function makeValue(overrides: Partial<NormalizedValue>): NormalizedValue {
  return {
    raw: "200",
    numeric: 200,
    unit: "mm",
    text: "200",
    ...overrides,
  };
}

describe("evaluateCondition", () => {
  describe(">= operator", () => {
    it("should pass when numeric value meets >= threshold", () => {
      const result = evaluateCondition(
        makeCondition({ operator: ">=", value: "200" }),
        makeValue({ numeric: 200 }),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail when numeric value is below >= threshold", () => {
      const result = evaluateCondition(
        makeCondition({ operator: ">=", value: "200", tolerance: 0 }),
        makeValue({ numeric: 150, raw: "150" }),
      );
      expect(result.passed).toBe(false);
      expect(result.deviation).toBeCloseTo(0.25);
    });

    it("should pass when numeric value is within >= tolerance", () => {
      const result = evaluateCondition(
        makeCondition({ operator: ">=", value: "200", tolerance: 0.1 }),
        makeValue({ numeric: 182, raw: "182" }),
      );
      expect(result.passed).toBe(true);
    });
  });

  describe("<= operator", () => {
    it("should pass when numeric value meets <= threshold", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "<=", value: "300" }),
        makeValue({ numeric: 200, raw: "200" }),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail when numeric value exceeds <= threshold", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "<=", value: "200", tolerance: 0 }),
        makeValue({ numeric: 250, raw: "250" }),
      );
      expect(result.passed).toBe(false);
      expect(result.deviation).toBeCloseTo(0.25);
    });
  });

  describe("== operator", () => {
    it("should pass when string value matches == exactly (case-insensitive)", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "==", value: "Concrete" }),
        makeValue({ numeric: null, text: "concrete", raw: "concrete" }),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail when string value does not match ==", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "==", value: "Steel" }),
        makeValue({ numeric: null, text: "concrete", raw: "concrete" }),
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("one_of operator", () => {
    it("should pass when value is in one_of list", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "one_of", value: "concrete, steel, timber" }),
        makeValue({ numeric: null, text: "steel", raw: "steel" }),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail when value is not in one_of list", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "one_of", value: "concrete, steel, timber" }),
        makeValue({ numeric: null, text: "glass", raw: "glass" }),
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("exists operator", () => {
    it("should pass exists when property is present", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "exists" }),
        makeValue({}),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail exists when property is null", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "exists" }),
        null,
      );
      expect(result.passed).toBe(false);
      expect(result.actualValue).toBeNull();
    });
  });

  describe("contains operator", () => {
    it("should pass contains when property includes substring", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "contains", value: "fire" }),
        makeValue({
          text: "fire-resistant glass",
          raw: "fire-resistant glass",
          numeric: null,
        }),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail contains when property does not include substring", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "contains", value: "fire" }),
        makeValue({
          text: "standard glass",
          raw: "standard glass",
          numeric: null,
        }),
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("null value handling", () => {
    it("should return NOT_APPLICABLE when property is null and operator is >=", () => {
      const result = evaluateCondition(makeCondition({ operator: ">=" }), null);
      expect(result.passed).toBe(false);
      expect(result.actualValue).toBeNull();
      expect(result.message).toContain("NOT_APPLICABLE");
    });
  });

  describe("range operator", () => {
    it("should pass when value is within range bounds with tolerance", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "range", value: "100,300", tolerance: 0.05 }),
        makeValue({ numeric: 200, raw: "200" }),
      );
      expect(result.passed).toBe(true);
    });

    it("should fail range when value is outside bounds", () => {
      const result = evaluateCondition(
        makeCondition({ operator: "range", value: "100,200", tolerance: 0 }),
        makeValue({ numeric: 250, raw: "250" }),
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("> operator", () => {
    it("should pass when numeric value is strictly greater than threshold when operator is >", () => {
      const result = evaluateCondition(
        makeCondition({
          operator: ">",
          value: "100",
          unit: null,
          tolerance: null,
          logicGroup: "AND",
          propertyCanonicalName: "Height",
          propertyAliases: [],
        }),
        { raw: "101", numeric: 101, unit: null, text: "101" },
      );
      expect(result.passed).toBe(true);
      expect(result.deviation).toBeNull();
    });

    it("should fail when numeric value equals threshold when operator is >", () => {
      const result = evaluateCondition(
        makeCondition({
          operator: ">",
          value: "100",
          unit: null,
          tolerance: null,
          logicGroup: "AND",
          propertyCanonicalName: "Height",
          propertyAliases: [],
        }),
        { raw: "100", numeric: 100, unit: null, text: "100" },
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("< operator", () => {
    it("should pass when numeric value is strictly less than threshold when operator is <", () => {
      const result = evaluateCondition(
        makeCondition({
          operator: "<",
          value: "50",
          unit: null,
          tolerance: null,
          logicGroup: "AND",
          propertyCanonicalName: "Load",
          propertyAliases: [],
        }),
        { raw: "49", numeric: 49, unit: null, text: "49" },
      );
      expect(result.passed).toBe(true);
      expect(result.deviation).toBeNull();
    });

    it("should fail when numeric value equals threshold when operator is <", () => {
      const result = evaluateCondition(
        makeCondition({
          operator: "<",
          value: "50",
          unit: null,
          tolerance: null,
          logicGroup: "AND",
          propertyCanonicalName: "Load",
          propertyAliases: [],
        }),
        { raw: "50", numeric: 50, unit: null, text: "50" },
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("!= operator", () => {
    it("should pass when string value differs from expected when operator is !=", () => {
      const result = evaluateCondition(
        makeCondition({
          operator: "!=",
          value: "madera",
          unit: null,
          tolerance: null,
          logicGroup: "AND",
          propertyCanonicalName: "Material",
          propertyAliases: [],
        }),
        { raw: "Hormigon", numeric: null, unit: null, text: "hormigon" },
      );
      expect(result.passed).toBe(true);
    });
  });

  describe("deviation calculation", () => {
    it("should calculate deviation percentage when numeric condition fails", () => {
      const result = evaluateCondition(
        makeCondition({ operator: ">=", value: "200", tolerance: 0 }),
        makeValue({ numeric: 100, raw: "100" }),
      );
      expect(result.passed).toBe(false);
      expect(result.deviation).toBeCloseTo(0.5);
    });
  });
});

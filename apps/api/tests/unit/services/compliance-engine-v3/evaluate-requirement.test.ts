import { describe, it, expect } from "@jest/globals";
import { evaluateRequirement } from "../../../../src/services/compliance-engine-v3/engine/evaluate-requirement";
import type {
  NormalizedElement,
  NormalizedValue,
  PropertyResolver,
} from "../../../../src/services/compliance-engine-v3/types";
import type { ResolvedRequirement } from "../../../../src/services/compliance-v3/project-config.service";

function makeElement(id = "el-001", category = "Wall"): NormalizedElement {
  return {
    elementId: id,
    name: "Wall Element",
    category,
    properties: new Map(),
  };
}

function makeRequirement(
  conditions: unknown[],
  overrides: Partial<ResolvedRequirement> = {},
): ResolvedRequirement {
  return {
    id: "req-001",
    code: "CL-TEST",
    packId: "pack-001",
    description: "Test requirement",
    legalReference: "Art. 4.5",
    discipline: "structural",
    severity: "MANDATORY",
    tags: [],
    notes: null,
    status: "VERIFIED",
    conditions,
    applicability: {
      scope: "ALL",
      targetCategories: [],
      excludeCategories: [],
      propertyFilters: {},
    },
    overridden: false,
    ...overrides,
  };
}

function numericValue(n: number): NormalizedValue {
  return { raw: String(n), numeric: n, unit: null, text: String(n) };
}

describe("evaluateRequirement", () => {
  it("should return PASS when all AND conditions pass", () => {
    const conditions = [
      {
        propertyCanonicalName: "Width",
        propertyAliases: [],
        operator: ">=",
        value: "100",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
      {
        propertyCanonicalName: "Height",
        propertyAliases: [],
        operator: ">=",
        value: "200",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
    ];
    const resolver: PropertyResolver = (_el, name) => {
      if (name === "Width") return numericValue(150);
      if (name === "Height") return numericValue(250);
      return null;
    };
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("PASS");
    expect(result.conditions).toHaveLength(2);
  });

  it("should return FAIL when any AND condition fails", () => {
    const conditions = [
      {
        propertyCanonicalName: "Width",
        propertyAliases: [],
        operator: ">=",
        value: "200",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
      {
        propertyCanonicalName: "Height",
        propertyAliases: [],
        operator: ">=",
        value: "200",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
    ];
    const resolver: PropertyResolver = (_el, name) => {
      if (name === "Width") return numericValue(100);
      if (name === "Height") return numericValue(300);
      return null;
    };
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("FAIL");
  });

  it("should return PASS when at least one OR condition passes", () => {
    const conditions = [
      {
        propertyCanonicalName: "Material",
        propertyAliases: [],
        operator: "==",
        value: "concrete",
        unit: null,
        tolerance: 0,
        logicGroup: "OR",
      },
      {
        propertyCanonicalName: "Material",
        propertyAliases: [],
        operator: "==",
        value: "steel",
        unit: null,
        tolerance: 0,
        logicGroup: "OR",
      },
    ];
    const resolver: PropertyResolver = () => ({
      raw: "steel",
      numeric: null,
      unit: null,
      text: "steel",
    });
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("PASS");
  });

  it("should return NOT_APPLICABLE when all conditions are NOT_APPLICABLE", () => {
    const conditions = [
      {
        propertyCanonicalName: "Width",
        propertyAliases: [],
        operator: ">=",
        value: "200",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
    ];
    const resolver: PropertyResolver = () => null;
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("NOT_APPLICABLE");
  });

  it("should return FAIL when element has no matching property and operator is exists", () => {
    const conditions = [
      {
        propertyCanonicalName: "FireRating",
        propertyAliases: [],
        operator: "exists",
        value: "",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
    ];
    const resolver: PropertyResolver = () => null;
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("FAIL");
  });

  it("should apply propertyResolver aliases correctly", () => {
    const conditions = [
      {
        propertyCanonicalName: "Width",
        propertyAliases: ["Ancho", "Breite"],
        operator: ">=",
        value: "100",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
    ];
    const resolver: PropertyResolver = (_el, canonicalName, aliases) => {
      if (canonicalName === "Width" || aliases.includes("Ancho")) {
        return numericValue(150);
      }
      return null;
    };
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("PASS");
  });

  it("should handle mixed AND and OR condition groups correctly", () => {
    const conditions = [
      {
        propertyCanonicalName: "Width",
        propertyAliases: [],
        operator: ">=",
        value: "100",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
      {
        propertyCanonicalName: "Material",
        propertyAliases: [],
        operator: "==",
        value: "concrete",
        unit: null,
        tolerance: 0,
        logicGroup: "OR",
      },
      {
        propertyCanonicalName: "Material",
        propertyAliases: [],
        operator: "==",
        value: "steel",
        unit: null,
        tolerance: 0,
        logicGroup: "OR",
      },
    ];
    const resolver: PropertyResolver = (_el, name) => {
      if (name === "Width") return numericValue(200);
      if (name === "Material")
        return { raw: "timber", numeric: null, unit: null, text: "timber" };
      return null;
    };
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("FAIL");
  });

  it("should return ERROR when propertyResolver throws", () => {
    const conditions = [
      {
        propertyCanonicalName: "Width",
        propertyAliases: [],
        operator: ">=",
        value: "100",
        unit: null,
        tolerance: 0,
        logicGroup: "AND",
      },
    ];
    const resolver: PropertyResolver = () => {
      throw new Error("Unexpected resolver error");
    };
    const result = evaluateRequirement(
      makeRequirement(conditions),
      makeElement(),
      resolver,
    );
    expect(result.status).toBe("ERROR");
    expect(result.conditions).toHaveLength(0);
  });
});

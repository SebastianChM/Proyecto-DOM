import { describe, it, expect } from "@jest/globals";
import { matchElementsForRequirement } from "../../../../src/services/compliance-engine-v3/engine/match-elements";
import type {
  NormalizedElement,
  NormalizedValue,
} from "../../../../src/services/compliance-engine-v3/types";
import type { ResolvedRequirement } from "../../../../src/services/compliance-v3/project-config.service";

function makeElement(
  id: string,
  category: string,
  props?: Record<string, string>,
): NormalizedElement {
  const properties = new Map<string, NormalizedValue>();
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      properties.set(key, {
        raw: value,
        numeric: parseFloat(value) || null,
        unit: null,
        text: value.toLowerCase(),
      });
    }
  }
  return { elementId: id, name: `Element ${id}`, category, properties };
}

function makeRequirement(applicability: unknown): ResolvedRequirement {
  return {
    id: "req-001",
    code: "CL-TEST",
    packId: "pack-001",
    description: "Test",
    legalReference: "Art. 1",
    discipline: "architectural",
    severity: "MANDATORY",
    tags: [],
    notes: null,
    status: "VERIFIED",
    conditions: [],
    applicability,
    overridden: false,
  };
}

describe("matchElementsForRequirement", () => {
  const elements: NormalizedElement[] = [
    makeElement("e1", "Wall"),
    makeElement("e2", "Door"),
    makeElement("e3", "Window"),
    makeElement("e4", "Wall"),
  ];

  it("should return all elements when scope is ALL", () => {
    const req = makeRequirement({
      scope: "ALL",
      targetCategories: [],
      excludeCategories: [],
      propertyFilters: {},
    });
    const result = matchElementsForRequirement(req, elements);
    expect(result).toHaveLength(4);
  });

  it("should return only elements matching targetCategories when scope is FILTERED", () => {
    const req = makeRequirement({
      scope: "FILTERED",
      targetCategories: ["Wall"],
      excludeCategories: [],
      propertyFilters: {},
    });
    const result = matchElementsForRequirement(req, elements);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.category === "Wall")).toBe(true);
  });

  it("should exclude elements in excludeCategories", () => {
    const req = makeRequirement({
      scope: "FILTERED",
      targetCategories: ["Wall", "Door"],
      excludeCategories: ["Door"],
      propertyFilters: {},
    });
    const result = matchElementsForRequirement(req, elements);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.category === "Wall")).toBe(true);
  });

  it("should apply property filters correctly", () => {
    const elWithProp = makeElement("e5", "Wall", { fireRating: "2h" });
    const elWithoutProp = makeElement("e6", "Wall", { fireRating: "1h" });
    const req = makeRequirement({
      scope: "FILTERED",
      targetCategories: ["Wall"],
      excludeCategories: [],
      propertyFilters: { fireRating: "2h" },
    });
    const result = matchElementsForRequirement(req, [
      elWithProp,
      elWithoutProp,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].elementId).toBe("e5");
  });

  it("should return empty array when no elements match targetCategories", () => {
    const req = makeRequirement({
      scope: "FILTERED",
      targetCategories: ["Beam"],
      excludeCategories: [],
      propertyFilters: {},
    });
    const result = matchElementsForRequirement(req, elements);
    expect(result).toHaveLength(0);
  });

  it("should return empty array when targetCategories is empty and scope is FILTERED", () => {
    const req = makeRequirement({
      scope: "FILTERED",
      targetCategories: [],
      excludeCategories: [],
      propertyFilters: {},
    });
    const result = matchElementsForRequirement(req, elements);
    expect(result).toHaveLength(0);
  });

  it("should match categories case-insensitively", () => {
    const req = makeRequirement({
      scope: "FILTERED",
      targetCategories: ["wall"],
      excludeCategories: [],
      propertyFilters: {},
    });
    const result = matchElementsForRequirement(req, elements);
    expect(result).toHaveLength(2);
  });
});

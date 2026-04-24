import { z } from "zod";
import type { NormalizedElement } from "../types";
import type { ResolvedRequirement } from "../../compliance-v3/project-config.service";

const applicabilitySchema = z.object({
  targetCategories: z.array(z.string()).default([]),
  excludeCategories: z.array(z.string()).default([]),
  propertyFilters: z.record(z.string(), z.string()).default({}),
  scope: z.enum(["ALL", "FILTERED"]).default("FILTERED"),
});

export function parseApplicability(raw: unknown) {
  const result = applicabilitySchema.safeParse(raw);
  if (!result.success) {
    return {
      targetCategories: [] as string[],
      excludeCategories: [] as string[],
      propertyFilters: {} as Record<string, string>,
      scope: "FILTERED" as const,
    };
  }
  return result.data;
}

export function matchElementsForRequirement(
  requirement: ResolvedRequirement,
  elements: NormalizedElement[],
): NormalizedElement[] {
  const applicability = parseApplicability(requirement.applicability);

  if (applicability.scope === "ALL") {
    return elements;
  }

  if (applicability.targetCategories.length === 0) {
    return [];
  }

  const targetLower = applicability.targetCategories.map((c) =>
    c.toLowerCase(),
  );
  const excludeLower = applicability.excludeCategories.map((c) =>
    c.toLowerCase(),
  );

  return elements.filter((el) => {
    const categoryLower = el.category.toLowerCase();

    if (!targetLower.includes(categoryLower)) return false;
    if (excludeLower.includes(categoryLower)) return false;

    for (const [key, expectedValue] of Object.entries(
      applicability.propertyFilters,
    )) {
      const propValue = el.properties.get(key);
      if (!propValue || propValue.text !== expectedValue.toLowerCase())
        return false;
    }

    return true;
  });
}

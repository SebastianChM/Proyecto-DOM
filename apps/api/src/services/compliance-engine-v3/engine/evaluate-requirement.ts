import { z } from "zod";
import { logger } from "../../../lib/logger";
import type {
  NormalizedElement,
  ElementEvaluation,
  ConditionResult,
  ResolvedCondition,
  PropertyResolver,
} from "../types";
import type { ResolvedRequirement } from "../../compliance-v3/project-config.service";
import { evaluateCondition } from "./evaluate-condition";

const conditionSchema = z.object({
  propertyCanonicalName: z.string(),
  propertyAliases: z.array(z.string()).default([]),
  operator: z.string(),
  value: z.string(),
  unit: z.string().nullable().default(null),
  tolerance: z.number().nullable().default(null),
  logicGroup: z.enum(["AND", "OR"]).default("AND"),
});

function parseConditions(
  raw: unknown[],
  requirementId: string,
): ResolvedCondition[] {
  const parsed: ResolvedCondition[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const result = conditionSchema.safeParse(item);
    if (result.success) {
      parsed.push(result.data);
    } else {
      logger.warn("[EvaluateRequirement] Skipping malformed condition", {
        requirementId,
        index: i,
        error: result.error.message,
      });
    }
  }
  return parsed;
}

function isNotApplicable(result: ConditionResult): boolean {
  return result.actualValue === null && result.operator !== "exists";
}

function determineStatus(
  results: ConditionResult[],
  conditions: ResolvedCondition[],
): "PASS" | "FAIL" | "NOT_APPLICABLE" {
  if (results.length === 0) return "PASS";

  if (results.every(isNotApplicable)) return "NOT_APPLICABLE";

  const andConditions = conditions.filter((c) => c.logicGroup === "AND");
  const orConditions = conditions.filter((c) => c.logicGroup === "OR");
  const andResults = results.filter(
    (_, i) => conditions[i]?.logicGroup === "AND",
  );
  const orResults = results.filter(
    (_, i) => conditions[i]?.logicGroup === "OR",
  );

  let andPasses = true;
  if (andConditions.length > 0) {
    const applicable = andResults.filter((r) => !isNotApplicable(r));
    if (applicable.length > 0) {
      andPasses = applicable.every((r) => r.passed);
    }
  }

  let orPasses = true;
  if (orConditions.length > 0) {
    const applicable = orResults.filter((r) => !isNotApplicable(r));
    if (applicable.length > 0) {
      orPasses = applicable.some((r) => r.passed);
    }
  }

  return andPasses && orPasses ? "PASS" : "FAIL";
}

export function evaluateRequirement(
  requirement: ResolvedRequirement,
  element: NormalizedElement,
  propertyResolver: PropertyResolver,
): ElementEvaluation {
  try {
    const conditions = parseConditions(
      requirement.conditions as unknown[],
      requirement.id,
    );
    const conditionResults: ConditionResult[] = [];

    for (const condition of conditions) {
      const actualValue = propertyResolver(
        element,
        condition.propertyCanonicalName,
        condition.propertyAliases,
      );
      const result = evaluateCondition(condition, actualValue);
      conditionResults.push(result);
    }

    const status = determineStatus(conditionResults, conditions);

    return {
      elementId: element.elementId,
      elementName: element.name,
      elementCategory: element.category,
      requirementId: requirement.id,
      requirementCode: requirement.code,
      status,
      conditions: conditionResults,
      legalReference: requirement.legalReference,
      severity: requirement.severity,
    };
  } catch {
    return {
      elementId: element.elementId,
      elementName: element.name,
      elementCategory: element.category,
      requirementId: requirement.id,
      requirementCode: requirement.code,
      status: "ERROR",
      conditions: [],
      legalReference: requirement.legalReference,
      severity: requirement.severity,
    };
  }
}

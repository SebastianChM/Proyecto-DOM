export type {
  EvaluationConfig,
  ResolvedCondition,
  NormalizedValue,
  NormalizedElement,
  ElementEvaluation,
  ConditionResult,
  EvaluationResult,
  UnitConversionMap,
  PropertyResolver,
  ApplicabilityShape,
} from "./types";

export { normalizeValue } from "./engine/normalize-value";
export { calculateDeviation } from "./engine/calculate-deviation";
export { evaluateCondition } from "./engine/evaluate-condition";
export {
  matchElementsForRequirement,
  parseApplicability,
} from "./engine/match-elements";
export { evaluateRequirement } from "./engine/evaluate-requirement";
export { calculateComplianceScore } from "./engine/calculate-score";

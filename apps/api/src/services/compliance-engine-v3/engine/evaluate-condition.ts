import type {
  ResolvedCondition,
  NormalizedValue,
  ConditionResult,
} from "../types";
import { calculateDeviation } from "./calculate-deviation";

function formatDeviation(dev: number): string {
  if (dev === Infinity) return "∞";
  return `${Math.round(dev * 100)}%`;
}

export function evaluateCondition(
  condition: ResolvedCondition,
  actualValue: NormalizedValue | null,
): ConditionResult {
  const { operator, value, tolerance } = condition;
  const tol = tolerance ?? 0;
  const actualDisplay = actualValue?.raw ?? null;

  if (actualValue === null && operator !== "exists") {
    return {
      propertyName: condition.propertyCanonicalName,
      operator,
      expectedValue: value,
      actualValue: null,
      passed: false,
      deviation: null,
      message: `Property '${condition.propertyCanonicalName}' not found — NOT_APPLICABLE`,
    };
  }

  switch (operator) {
    case ">=": {
      const expected = parseFloat(value);
      const actual = actualValue!.numeric;
      if (actual === null) {
        return makeResult(
          condition,
          actualDisplay,
          false,
          null,
          `'${condition.propertyCanonicalName}' is not numeric`,
        );
      }
      const threshold = expected * (1 - tol);
      const passed = actual >= threshold;
      const dev = passed ? null : calculateDeviation(expected, actual);
      return makeResult(
        condition,
        actualDisplay,
        passed,
        passed ? null : dev,
        passed
          ? `${condition.propertyCanonicalName}: ${actual} >= ${expected} ✓`
          : `${condition.propertyCanonicalName}: expected >= ${expected}, got ${actual} (deviation: ${formatDeviation(dev!)})`,
      );
    }

    case "<=": {
      const expected = parseFloat(value);
      const actual = actualValue!.numeric;
      if (actual === null) {
        return makeResult(
          condition,
          actualDisplay,
          false,
          null,
          `'${condition.propertyCanonicalName}' is not numeric`,
        );
      }
      const threshold = expected * (1 + tol);
      const passed = actual <= threshold;
      const dev = passed ? null : calculateDeviation(expected, actual);
      return makeResult(
        condition,
        actualDisplay,
        passed,
        passed ? null : dev,
        passed
          ? `${condition.propertyCanonicalName}: ${actual} <= ${expected} ✓`
          : `${condition.propertyCanonicalName}: expected <= ${expected}, got ${actual} (deviation: ${formatDeviation(dev!)})`,
      );
    }

    case ">": {
      const expected = parseFloat(value);
      const actual = actualValue!.numeric;
      if (actual === null) {
        return makeResult(
          condition,
          actualDisplay,
          false,
          null,
          `'${condition.propertyCanonicalName}' is not numeric`,
        );
      }
      const passed = actual > expected;
      const dev = passed ? null : calculateDeviation(expected, actual);
      return makeResult(
        condition,
        actualDisplay,
        passed,
        passed ? null : dev,
        passed
          ? `${condition.propertyCanonicalName}: ${actual} > ${expected} ✓`
          : `${condition.propertyCanonicalName}: expected > ${expected}, got ${actual} (deviation: ${formatDeviation(dev!)})`,
      );
    }

    case "<": {
      const expected = parseFloat(value);
      const actual = actualValue!.numeric;
      if (actual === null) {
        return makeResult(
          condition,
          actualDisplay,
          false,
          null,
          `'${condition.propertyCanonicalName}' is not numeric`,
        );
      }
      const passed = actual < expected;
      const dev = passed ? null : calculateDeviation(expected, actual);
      return makeResult(
        condition,
        actualDisplay,
        passed,
        passed ? null : dev,
        passed
          ? `${condition.propertyCanonicalName}: ${actual} < ${expected} ✓`
          : `${condition.propertyCanonicalName}: expected < ${expected}, got ${actual} (deviation: ${formatDeviation(dev!)})`,
      );
    }

    case "==": {
      const numeric = actualValue!.numeric;
      const expected = parseFloat(value);

      if (numeric !== null && !isNaN(expected)) {
        const passed = Math.abs(numeric - expected) <= expected * tol;
        const dev = passed ? null : calculateDeviation(expected, numeric);
        return makeResult(
          condition,
          actualDisplay,
          passed,
          passed ? null : dev,
          passed
            ? `${condition.propertyCanonicalName}: ${numeric} == ${expected} ✓`
            : `${condition.propertyCanonicalName}: expected == ${expected}, got ${numeric} (deviation: ${formatDeviation(dev!)})`,
        );
      }

      const passed = actualValue!.text === value.toLowerCase();
      return makeResult(
        condition,
        actualDisplay,
        passed,
        null,
        passed
          ? `${condition.propertyCanonicalName}: '${actualValue!.text}' == '${value.toLowerCase()}' ✓`
          : `${condition.propertyCanonicalName}: expected '${value.toLowerCase()}', got '${actualValue!.text}'`,
      );
    }

    case "!=": {
      const numeric = actualValue!.numeric;
      const expected = parseFloat(value);

      if (numeric !== null && !isNaN(expected)) {
        const equalNumeric = Math.abs(numeric - expected) <= expected * tol;
        const passed = !equalNumeric;
        return makeResult(
          condition,
          actualDisplay,
          passed,
          null,
          passed
            ? `${condition.propertyCanonicalName}: ${numeric} != ${expected} ✓`
            : `${condition.propertyCanonicalName}: expected != ${expected}, but got ${numeric}`,
        );
      }

      const passed = actualValue!.text !== value.toLowerCase();
      return makeResult(
        condition,
        actualDisplay,
        passed,
        null,
        passed
          ? `${condition.propertyCanonicalName}: '${actualValue!.text}' != '${value.toLowerCase()}' ✓`
          : `${condition.propertyCanonicalName}: expected != '${value.toLowerCase()}', but values match`,
      );
    }

    case "range": {
      const parts = value.split(",").map((p) => p.trim());
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      const actual = actualValue!.numeric;
      if (actual === null || isNaN(min) || isNaN(max)) {
        return makeResult(
          condition,
          actualDisplay,
          false,
          null,
          `'${condition.propertyCanonicalName}' is not numeric or range is malformed`,
        );
      }
      const passed = actual >= min * (1 - tol) && actual <= max * (1 + tol);
      return makeResult(
        condition,
        actualDisplay,
        passed,
        null,
        passed
          ? `${condition.propertyCanonicalName}: ${actual} in range [${min}, ${max}] ✓`
          : `${condition.propertyCanonicalName}: ${actual} not in range [${min}, ${max}]`,
      );
    }

    case "exists": {
      const passed = actualValue !== null;
      return makeResult(
        condition,
        actualDisplay,
        passed,
        null,
        passed
          ? `${condition.propertyCanonicalName}: exists ✓`
          : `${condition.propertyCanonicalName}: property not found`,
      );
    }

    case "contains": {
      const passed = actualValue!.text.includes(value.toLowerCase());
      return makeResult(
        condition,
        actualDisplay,
        passed,
        null,
        passed
          ? `${condition.propertyCanonicalName}: contains '${value.toLowerCase()}' ✓`
          : `${condition.propertyCanonicalName}: '${actualValue!.text}' does not contain '${value.toLowerCase()}'`,
      );
    }

    case "one_of": {
      const options = value.split(",").map((v) => v.trim().toLowerCase());
      const passed = options.includes(actualValue!.text);
      return makeResult(
        condition,
        actualDisplay,
        passed,
        null,
        passed
          ? `${condition.propertyCanonicalName}: '${actualValue!.text}' is one of [${options.join(", ")}] ✓`
          : `${condition.propertyCanonicalName}: '${actualValue!.text}' not in [${options.join(", ")}]`,
      );
    }

    default: {
      return makeResult(
        condition,
        actualDisplay,
        false,
        null,
        `Unknown operator '${operator}'`,
      );
    }
  }
}

function makeResult(
  condition: ResolvedCondition,
  actualValue: string | null,
  passed: boolean,
  deviation: number | null,
  message: string,
): ConditionResult {
  return {
    propertyName: condition.propertyCanonicalName,
    operator: condition.operator,
    expectedValue: condition.value,
    actualValue,
    passed,
    deviation,
    message,
  };
}

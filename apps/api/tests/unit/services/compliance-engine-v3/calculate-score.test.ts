import { describe, it, expect } from "@jest/globals";
import { calculateComplianceScore } from "../../../../src/services/compliance-engine-v3/engine/calculate-score";
import type { ElementEvaluation } from "../../../../src/services/compliance-engine-v3/types";

function makeEval(status: ElementEvaluation["status"]): ElementEvaluation {
  return {
    elementId: "el-001",
    elementName: "Test Element",
    elementCategory: "Wall",
    requirementId: "req-001",
    requirementCode: "CL-TEST",
    status,
    conditions: [],
    legalReference: "Art. 1",
    severity: "MANDATORY",
  };
}

describe("calculateComplianceScore", () => {
  it("should return 100 when all evaluations pass", () => {
    const evals = [makeEval("PASS"), makeEval("PASS"), makeEval("PASS")];
    expect(calculateComplianceScore(evals)).toBe(100);
  });

  it("should return 0 when all evaluations fail", () => {
    const evals = [makeEval("FAIL"), makeEval("FAIL")];
    expect(calculateComplianceScore(evals)).toBe(0);
  });

  it("should return 100 when all evaluations are NOT_APPLICABLE", () => {
    const evals = [makeEval("NOT_APPLICABLE"), makeEval("NOT_APPLICABLE")];
    expect(calculateComplianceScore(evals)).toBe(100);
  });

  it("should calculate correct score for mixed results", () => {
    const evals = [
      makeEval("PASS"),
      makeEval("PASS"),
      makeEval("FAIL"),
      makeEval("NOT_APPLICABLE"),
    ];
    expect(calculateComplianceScore(evals)).toBe(67);
  });

  it("should round score to nearest integer", () => {
    const evals = [makeEval("PASS"), makeEval("FAIL"), makeEval("FAIL")];
    expect(calculateComplianceScore(evals)).toBe(33);
  });

  it("should count ERROR as failed when calculating compliance score", () => {
    const evals = [makeEval("PASS"), makeEval("ERROR")];
    expect(calculateComplianceScore(evals)).toBe(50);
  });

  it("should return 100 when evaluations array is empty", () => {
    expect(calculateComplianceScore([])).toBe(100);
  });
});

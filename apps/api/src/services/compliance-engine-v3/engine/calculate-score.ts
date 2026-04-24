import type { ElementEvaluation } from "../types";

export function calculateComplianceScore(
  evaluations: ElementEvaluation[],
): number {
  const passed = evaluations.filter((e) => e.status === "PASS").length;
  const failed = evaluations.filter(
    (e) => e.status === "FAIL" || e.status === "ERROR",
  ).length;

  if (passed + failed === 0) return 100;

  return Math.round((passed / (passed + failed)) * 100);
}

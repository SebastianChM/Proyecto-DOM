import { describe, it, expect } from "@jest/globals";
import { calculateDeviation } from "../../../../src/services/compliance-engine-v3/engine/calculate-deviation";

describe("calculateDeviation", () => {
  it("should return 0 when actual equals expected", () => {
    expect(calculateDeviation(200, 200)).toBe(0);
  });

  it("should return 0.25 when actual is 25% below expected", () => {
    expect(calculateDeviation(200, 150)).toBe(0.25);
  });

  it("should return 0.5 when actual is 50% above expected", () => {
    expect(calculateDeviation(200, 300)).toBe(0.5);
  });

  it("should return 0 when both expected and actual are 0", () => {
    expect(calculateDeviation(0, 0)).toBe(0);
  });

  it("should return Infinity when expected is 0 and actual is not 0", () => {
    expect(calculateDeviation(0, 5)).toBe(Infinity);
  });
});

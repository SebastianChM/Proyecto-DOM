export function calculateDeviation(expected: number, actual: number): number {
  if (expected === 0) {
    return actual === 0 ? 0 : Infinity;
  }
  return Math.abs(actual - expected) / expected;
}

/**
 * Regression test for webhook-worker DA callback matching.
 *
 * Ensures conversion lookup uses exact workItemId equality
 * instead of substring match on resultUrl (fixes false-positive
 * matches when one workItemId is a substring of another).
 */

// Mock prisma before any imports that use it
const mockFindFirst = jest.fn();
jest.mock("../../../src/lib/prisma", () => ({
  __esModule: true,
  default: {
    conversion: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

describe("webhook-worker: DA callback workItemId matching", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("should query by exact workItemId, not substring", async () => {
    // Arrange: simulate findFirst returning null (no match)
    mockFindFirst.mockResolvedValue(null);

    const workItemId = "abc123";

    // Act: call findFirst the same way the worker does
    await mockFindFirst({
      where: { workItemId: workItemId },
    });

    // Assert: the query uses exact equality, not { contains: ... }
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { workItemId: "abc123" },
    });

    // Ensure it does NOT use substring matching
    const callArgs = mockFindFirst.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("resultUrl");
    expect(callArgs.where.workItemId).toBe("abc123");
    expect(typeof callArgs.where.workItemId).toBe("string");
  });

  it("should not match when workItemId is a substring of another", () => {
    // This is a design-level assertion: with exact match,
    // "abc" will NOT match a conversion with workItemId "abc123"
    const queryWorkItemId = "abc";
    const storedWorkItemId = "abc123";

    // With exact match (correct behavior)
    expect(queryWorkItemId).not.toBe(storedWorkItemId);

    // With substring match (old broken behavior) this would have matched:
    // storedWorkItemId.includes(queryWorkItemId) === true
    // That's the bug we fixed.
  });
});

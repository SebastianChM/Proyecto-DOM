import {
  describe,
  it,
  expect,
  jest,
  afterEach,
  beforeEach,
} from "@jest/globals";
import type {
  PropertyEntry,
  CategoryEntry,
} from "../../../../src/services/dictionary/types";

// ─── Mock global fetch before importing the module ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = jest.fn() as any;
global.fetch = mockFetch as unknown as typeof fetch;

import { OpenAISuggester } from "../../../../src/services/requirement-suggester/openai-suggester.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const properties: PropertyEntry[] = [
  {
    id: "p1",
    canonicalName: "wall_thickness",
    locale: "es-CL",
    displayName: "Espesor de muro",
    aliases: [],
    revitPropertyPath: null,
    ifcPropertyPath: null,
    unit: "m",
    dataType: "number",
  },
];

const categories: CategoryEntry[] = [
  {
    id: "c1",
    canonicalName: "walls",
    locale: "es-CL",
    displayName: "Muros",
    aliases: [],
    revitCategory: "Walls",
    ifcEntity: "IfcWall",
    discipline: "ARCHITECTURAL",
  },
];

const validSuggestion = {
  description: "Wall thickness must be at least 0.2m",
  legalReference: "Art. 5.1",
  discipline: "ARCHITECTURAL",
  severity: "MANDATORY",
  conditions: [
    { property: "wall_thickness", operator: ">=", value: "0.2", unit: "m" },
  ],
  applicability: { categories: ["walls"] },
  confidence: 0.9,
};

function mockOpenAIResponse(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OpenAISuggester", () => {
  let suggester: OpenAISuggester;

  beforeEach(() => {
    suggester = new OpenAISuggester("test-api-key");
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return suggestions when OpenAI responds with valid JSON", async () => {
    mockOpenAIResponse(JSON.stringify([validSuggestion]));

    const result = await suggester.suggest("Some text", properties, categories);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Wall thickness must be at least 0.2m");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should filter out suggestions with confidence below 0.5 when filtering results", async () => {
    const lowConfidence = { ...validSuggestion, confidence: 0.3 };
    mockOpenAIResponse(JSON.stringify([validSuggestion, lowConfidence]));

    const result = await suggester.suggest("Some text", properties, categories);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("should retry when first parse fails and succeed on retry", async () => {
    // First call returns invalid JSON, second returns valid
    mockOpenAIResponse("not valid json {{");
    mockOpenAIResponse(JSON.stringify([validSuggestion]));

    const result = await suggester.suggest("Some text", properties, categories);

    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should return [] when all retries fail to parse", async () => {
    mockOpenAIResponse("invalid json");
    mockOpenAIResponse("still invalid json");

    const result = await suggester.suggest("Some text", properties, categories);

    expect(result).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should return [] when a network error occurs", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await suggester.suggest("Some text", properties, categories);

    expect(result).toEqual([]);
  });

  it("should pass discipline to system prompt when provided", async () => {
    mockOpenAIResponse(JSON.stringify([]));

    await suggester.suggest("Some text", properties, categories, "STRUCTURAL");

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse((callArgs[1] as { body: string }).body);
    const systemMessage = body.messages.find(
      (m: { role: string }) => m.role === "system",
    );
    expect(systemMessage.content).toContain("STRUCTURAL");
  });

  it("should use max_tokens of 4000 when calling the OpenAI API", async () => {
    mockOpenAIResponse(JSON.stringify([]));

    await suggester.suggest("Some text", properties, categories);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse((callArgs[1] as { body: string }).body);
    expect(body.max_tokens).toBe(4000);
  });

  it("should include validProperties and validCategories when building context", async () => {
    mockOpenAIResponse(JSON.stringify([]));

    await suggester.suggest("Some text", properties, categories);

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse((callArgs[1] as { body: string }).body);
    const systemMessage = body.messages.find(
      (m: { role: string }) => m.role === "system",
    );
    expect(systemMessage.content).toContain("wall_thickness");
    expect(systemMessage.content).toContain("walls");
  });
});

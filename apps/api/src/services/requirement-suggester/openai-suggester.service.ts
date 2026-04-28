import { z } from "zod";
import { logger } from "../../lib/logger";
import { DISCIPLINES, SEVERITIES } from "../../routes/compliance-v3/schemas";
import type { PropertyEntry, CategoryEntry } from "../dictionary/types";
import type { IRequirementSuggester } from "./requirement-suggester.interface";
import type { SuggestedRequirement } from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 0.2;
const MAX_TOKENS = 4000;
const MIN_CONFIDENCE = 0.5;

const suggestedConditionSchema = z.object({
  property: z.string().min(1),
  operator: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().nullable().optional(),
});

const suggestedRequirementSchema = z.object({
  description: z.string().min(1),
  legalReference: z.string().min(1),
  discipline: z.string().min(1),
  severity: z.enum(SEVERITIES),
  conditions: z.array(suggestedConditionSchema).min(1),
  applicability: z.object({
    categories: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
});

const llmResponseSchema = z.array(suggestedRequirementSchema);

function buildSystemPrompt(
  properties: PropertyEntry[],
  categories: CategoryEntry[],
  discipline?: string,
): string {
  const propNames = properties.map((p) => p.canonicalName).join(", ");
  const catNames = categories.map((c) => c.canonicalName).join(", ");
  const disciplineHint = discipline
    ? `Focus on the "${discipline}" discipline only.`
    : "Identify the appropriate discipline for each requirement.";

  return `You are an expert BIM (Building Information Modeling) compliance analyst.
Your task is to extract building code requirements from regulatory text.

${disciplineHint}

Known property dictionary (use canonicalName values only):
${propNames || "(none)"}

Known category dictionary (use canonicalName values only):
${catNames || "(none)"}

Return a valid JSON array (no markdown, no explanation) of requirement objects.
Each object must have exactly these fields:
{
  "description": "string — clear requirement description",
  "legalReference": "string — article/section reference",
  "discipline": "string — one of ${DISCIPLINES.join(", ")}",
  "severity": "${SEVERITIES.join(" | ")}",
  "conditions": [
    {
      "property": "canonicalName from property dictionary",
      "operator": ">= | <= | > | < | == | != | range | exists | contains | one_of",
      "value": "string value",
      "unit": "string | null"
    }
  ],
  "applicability": {
    "categories": ["canonicalName from category dictionary"]
  },
  "confidence": 0.0 to 1.0
}

Rules:
- Only include requirements you can extract with confidence >= 0.5.
- Use only property and category canonicalNames listed above when possible.
- If a suitable canonicalName is not found, use the raw name from the text.
- Return [] if no requirements can be extracted.
- Return ONLY the JSON array, no other text.
- Do not use markdown code fences or backticks of any kind.`;
}

function buildRetryPrompt(originalText: string): string {
  return `The previous response was not valid JSON. Please re-read this text and return ONLY a valid JSON array (no markdown fences, no explanation):

${originalText}`;
}

async function callOpenAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

function parseLlmContent(content: string): SuggestedRequirement[] | null {
  try {
    const parsed = JSON.parse(content.trim());
    const result = llmResponseSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn("[OpenAISuggester] LLM response failed Zod validation", {
        errors: result.error.issues,
      });
      return null;
    }
    return result.data as SuggestedRequirement[];
  } catch {
    return null;
  }
}

export class OpenAISuggester implements IRequirementSuggester {
  constructor(private readonly apiKey: string) {}

  async suggest(
    text: string,
    properties: PropertyEntry[],
    categories: CategoryEntry[],
    discipline?: string,
  ): Promise<SuggestedRequirement[]> {
    const systemPrompt = buildSystemPrompt(properties, categories, discipline);

    try {
      // First attempt
      const firstContent = await callOpenAI(this.apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ]);

      const firstResult = parseLlmContent(firstContent);

      if (firstResult !== null) {
        return firstResult.filter((s) => s.confidence >= MIN_CONFIDENCE);
      }

      logger.warn("[OpenAISuggester] First parse failed, retrying once");

      // Second attempt — ask the model to fix the JSON
      const retryContent = await callOpenAI(this.apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
        { role: "assistant", content: firstContent },
        { role: "user", content: buildRetryPrompt(firstContent) },
      ]);

      const retryResult = parseLlmContent(retryContent);

      if (retryResult !== null) {
        return retryResult.filter((s) => s.confidence >= MIN_CONFIDENCE);
      }

      logger.warn("[OpenAISuggester] Retry parse also failed, returning []");
      return [];
    } catch (error) {
      logger.warn("[OpenAISuggester] Network or API error, returning []", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

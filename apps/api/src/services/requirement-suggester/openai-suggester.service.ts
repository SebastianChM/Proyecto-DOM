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
const OPENAI_TIMEOUT_MS = 30_000; // AbortController fires after 30 s to prevent hung sockets
const MAX_RETRIES = 3; // 1 initial attempt + 2 retries

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Returns true for transient errors worth retrying (rate limits, 5xx, timeouts). */
function isRetryableOpenAIError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // HTTP 429 (rate limit) or 5xx (server-side transient errors)
  if (/OpenAI API error (429|5\d{2})/.test(error.message)) return true;
  // AbortError comes from our own AbortController when the 30 s timeout fires
  if (error.name === "AbortError") return true;
  return false;
}

// Safety caps — prevents prompt bloat if the dictionary grows to hundreds of entries.
// The LLM doesn't extract better requirements from a list of 500 vs 150 canonical names.
const MAX_PROPERTIES = 150;
const MAX_CATEGORIES = 100;

const suggestedConditionSchema = z.object({
  property: z.string().min(1),
  operator: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().nullable().optional(),
});

const suggestedRequirementSchema = z.object({
  description: z.string().min(1),
  legalReference: z.string().min(1),
  discipline: z.enum(DISCIPLINES),
  severity: z.enum(SEVERITIES),
  conditions: z.array(suggestedConditionSchema).min(1),
  applicability: z.object({
    categories: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
});

// Accepts both { requirements: [...] } (JSON-object mode) and bare [...] (fallback)
const llmResponseSchema = z.union([
  z.array(suggestedRequirementSchema),
  z.object({ requirements: z.array(suggestedRequirementSchema) }),
]);

function buildSystemPrompt(
  properties: PropertyEntry[],
  categories: CategoryEntry[],
  discipline?: string,
): string {
  // When discipline is known, prefer discipline-specific categories first to reduce noise
  const orderedCategories = discipline
    ? [
        ...categories.filter((c) => c.discipline === discipline),
        ...categories.filter(
          (c) => !c.discipline || c.discipline !== discipline,
        ),
      ]
    : categories;

  // Apply caps — dictionary growth must not silently inflate token costs
  const cappedProps = properties.slice(0, MAX_PROPERTIES);
  const cappedCats = orderedCategories.slice(0, MAX_CATEGORIES);

  const propNames = cappedProps.map((p) => p.canonicalName).join(", ");
  const catNames = cappedCats.map((c) => c.canonicalName).join(", ");
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

Return a JSON object with a single key "requirements" containing an array of requirement objects.
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
- Return {"requirements": []} if no requirements can be extracted.`;
}

async function callOpenAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      // JSON object mode: guarantees valid JSON output, eliminates parse failures
      // and the costly retry that would re-send the full conversation.
      response_format: { type: "json_object" },
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
    // Unwrap { requirements: [...] } or use the bare array directly
    return Array.isArray(result.data)
      ? (result.data as SuggestedRequirement[])
      : (result.data as { requirements: SuggestedRequirement[] }).requirements;
  } catch {
    return null;
  }
}

export class OpenAISuggester implements IRequirementSuggester {
  constructor(
    private readonly apiKey: string,
    /** Base retry delay in ms. Pass 0 in tests to skip artificial slowness. */
    private readonly retryDelayMs = 1_000,
  ) {}

  async suggest(
    text: string,
    properties: PropertyEntry[],
    categories: CategoryEntry[],
    discipline?: string,
  ): Promise<SuggestedRequirement[]> {
    const systemPrompt = buildSystemPrompt(properties, categories, discipline);
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Fresh controller per attempt — a signal can only be aborted once.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

      try {
        const content = await callOpenAI(
          this.apiKey,
          messages,
          controller.signal,
        );

        const result = parseLlmContent(content);
        if (result !== null) {
          return result.filter((s) => s.confidence >= MIN_CONFIDENCE);
        }

        // JSON parse failure — add a corrective user turn and retry if attempts remain.
        if (attempt < MAX_RETRIES) {
          logger.warn(
            "[OpenAISuggester] Parse failure, retrying with corrective prompt",
            { attempt },
          );
          messages.push(
            { role: "assistant", content },
            {
              role: "user",
              content:
                'Your previous response was not valid JSON. Return ONLY a JSON object {"requirements": [...]} with no markdown, code fences, or extra text.',
            },
          );
          await sleep(this.retryDelayMs * attempt);
          continue;
        }

        throw new Error("LLM returned malformed JSON output after all retries");
      } catch (error) {
        if (isRetryableOpenAIError(error) && attempt < MAX_RETRIES) {
          const waitMs = this.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn(
            "[OpenAISuggester] Transient API error, backing off before retry",
            {
              attempt,
              maxRetries: MAX_RETRIES,
              waitMs,
              error: error instanceof Error ? error.message : String(error),
            },
          );
          await sleep(waitMs);
          continue;
        }

        logger.error(
          "[OpenAISuggester] Request failed — all retries exhausted",
          {
            attempt,
            maxRetries: MAX_RETRIES,
            error: error instanceof Error ? error.message : String(error),
          },
        );
        throw error instanceof Error ? error : new Error(String(error));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // TypeScript safety net — the loop always returns or throws before this.
    throw new Error("OpenAI request failed after all retries");
  }
}

import type { PropertyEntry, CategoryEntry } from "../dictionary/types";
import type { IRequirementSuggester } from "./requirement-suggester.interface";
import type { SuggestedRequirement } from "./types";

/**
 * Fallback suggester used when OPENAI_API_KEY is not configured.
 * Always returns an empty suggestion list so analysis endpoints remain
 * functional without an external AI dependency.
 */
export class ManualOnlySuggester implements IRequirementSuggester {
  async suggest(
    _text: string,
    _properties: PropertyEntry[],
    _categories: CategoryEntry[],
    _discipline?: string,
  ): Promise<SuggestedRequirement[]> {
    return [];
  }
}

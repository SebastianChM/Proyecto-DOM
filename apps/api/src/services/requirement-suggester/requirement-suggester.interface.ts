import type { PropertyEntry, CategoryEntry } from "../dictionary/types";
import type { SuggestedRequirement } from "./types";

/**
 * Contract for any requirement suggester backend (OpenAI, local, etc.).
 */
export interface IRequirementSuggester {
  /**
   * Analyse a regulatory text and return suggested requirements.
   *
   * @param text         The regulatory or spec text to analyse.
   * @param properties   All known properties (from the dictionary) for context.
   * @param categories   All known categories (from the dictionary) for context.
   * @param discipline   Optional discipline filter to narrow suggestions.
   * @returns Array of suggested requirements (confidence already filtered ≥ 0.5).
   *          Returns [] on any recoverable error (network / parse failure).
   */
  suggest(
    text: string,
    properties: PropertyEntry[],
    categories: CategoryEntry[],
    discipline?: string,
  ): Promise<SuggestedRequirement[]>;
}

import { env } from "../../config/env";
import { OpenAISuggester } from "./openai-suggester.service";
import { ManualOnlySuggester } from "./manual-only-suggester.service";

export type { IRequirementSuggester } from "./requirement-suggester.interface";
export type {
  SuggestedRequirement,
  SuggestedCondition,
  StoredSuggestion,
} from "./types";

/**
 * Factory: returns OpenAISuggester when OPENAI_API_KEY is set,
 * otherwise falls back to ManualOnlySuggester (returns []).
 */
function createDefaultSuggester(): OpenAISuggester | ManualOnlySuggester {
  if (env.OPENAI_API_KEY) {
    return new OpenAISuggester(env.OPENAI_API_KEY);
  }
  return new ManualOnlySuggester();
}

export { OpenAISuggester } from "./openai-suggester.service";
export { ManualOnlySuggester } from "./manual-only-suggester.service";

export const defaultSuggester = createDefaultSuggester();

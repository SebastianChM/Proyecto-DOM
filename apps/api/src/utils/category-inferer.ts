/**
 * Shared category inference utility.
 *
 * Maps BIM-related keywords (EN + ES) to canonical Revit-style categories.
 * Consolidates duplicated logic from:
 *   - hierarchical-spec-processor.ts (inferCategory)
 *   - validation/parser.service.ts   (normalizeCategory)
 */

const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
  {
    keywords: ["CONCRETE", "HORMIGON", "HORMIGÓN"],
    category: "Structural Columns/Framing",
  },
  { keywords: ["STEEL", "ACERO"], category: "Structural Framing" },
  { keywords: ["WALL", "MURO", "PARED", "GYPSUM"], category: "Walls" },
  { keywords: ["ROOF", "CUBIERTA", "TECHO"], category: "Roofs" },
  { keywords: ["FLOOR", "SUELO", "PISO", "LOSA"], category: "Floors" },
  { keywords: ["DOOR", "PUERTA"], category: "Doors" },
  { keywords: ["WINDOW", "VENTANA"], category: "Windows" },
  { keywords: ["DUCT", "DUCTO"], category: "Ducts" },
];

/**
 * Infer a BIM category from free-text input.
 *
 * @param text - Title, section header, or category string to classify.
 * @returns The matched category string, or `null` if no rule matched.
 */
export function inferCategory(text: string): string | null {
  const upper = text.toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => upper.includes(kw))) {
      return rule.category;
    }
  }
  return null;
}

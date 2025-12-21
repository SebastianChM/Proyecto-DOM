import { PropertyNormalizer } from "../aps/property-normalizer";
import { SpecificationItem } from "../document-parser.service";

export interface ValidationResult {
  property: string;
  expectedValue: unknown;
  actualValue: unknown;
  status: "PASS" | "FAIL" | "WARNING";
  elementId?: string;
  elementName?: string;
  modelName?: string;
  modelId?: string;
  modelUrn?: string;
}

export class ValidationService {
  /**
   * Validates model properties against structured document specifications.
   * @param documentSpecs List of structured specs (Section, Category, Property, Value)
   * @param modelProperties List of objects from APS Model Derivative
   */
  validateModel(
    documentSpecs: SpecificationItem[],
    modelProperties: unknown[],
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const object of modelProperties) {
      // Type guard for model object
      const modelObj = object as {
        properties?: unknown;
        objectid?: string | number;
        name?: string;
      };
      const objectProps = this.flattenProperties(modelObj.properties);

      // 1. Identify Object Category (Naive approach: check 'Category' or 'Type' properties)
      // APS often stores Revit Category in: properties -> 'Identity Data' -> 'Category' or just top level
      let objectCategory = "General";
      const categoryValue = objectProps["Category"];
      const typeValue = objectProps["Type"];
      if (categoryValue && typeof categoryValue === "string")
        objectCategory = categoryValue;
      else if (typeValue && typeof typeValue === "string")
        objectCategory = typeValue;

      // 2. Filter Specs relevant to this Object
      // We match if Spec Category is contained in Object Category (e.g. Spec "Concrete" matches Object "Structural Concrete")
      const relevantSpecs = documentSpecs.filter((spec) => {
        if (spec.category === "General") return true; // General specs apply to everything? Or maybe nothing? Let's say specific only for now.
        return this.categoryMatches(spec.category, objectCategory);
      });

      if (relevantSpecs.length === 0) continue; // No specs for this element type

      // 3. Validate each relevant spec
      for (const spec of relevantSpecs) {
        const normalizedKey = PropertyNormalizer.normalizeKey(spec.property);

        // Try to find the property in the object
        // We search for fuzzy match on keys too
        const objectKey = Object.keys(objectProps).find(
          (k) =>
            PropertyNormalizer.normalizeKey(k).includes(normalizedKey) ||
            normalizedKey.includes(PropertyNormalizer.normalizeKey(k)),
        );

        if (objectKey) {
          const actualRawValue = objectProps[objectKey];
          const status = this.compareValuesWithUnits(
            spec.value,
            actualRawValue,
          );

          // Only report failures or warnings to avoid noise?
          // Or report PASS for tracking coverage. Let's report all for now.
          results.push({
            property: spec.property,
            expectedValue: spec.value,
            actualValue: actualRawValue,
            status: status,
            elementId: String(modelObj.objectid ?? ""),
            elementName: String(modelObj.name ?? ""),
          });
        } else {
          // Property not found in element
          // We might not want to spam "WARNING" for every missing property on every element
          // unless we are sure it SHOULD be there.
          // For now, skip "Not Found" to reduce noise in this "Smart" mode.
        }
      }
    }

    return results;
  }

  private categoryMatches(specCat: string, objCat: string): boolean {
    const s = specCat.toLowerCase();
    const o = objCat.toLowerCase();
    // E.g. Spec: "Structural Columns" matches Object: "Revit Category: Stylized Columns"
    // E.g. Spec: "Concrete" matches Object: "Concrete Wall"

    // Split spec category into keywords
    const keywords = s.split(/[\s/]+/);
    // Return true if ANY keyword is found in object category (loose match)
    return keywords.some((k) => k.length > 3 && o.includes(k));
  }

  private flattenProperties(properties: unknown): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    if (!properties) return flat;

    for (const category in properties as Record<string, unknown>) {
      const props = properties as Record<string, unknown>;
      if (typeof props[category] === "object" && props[category]) {
        const categoryObj = props[category] as Record<string, unknown>;
        for (const propName in categoryObj) {
          // Keep original keys for now, normalize during search
          flat[propName] = categoryObj[propName];
        }
      }
    }
    return flat;
  }

  private compareValuesWithUnits(
    expected: string,
    actual: unknown,
  ): "PASS" | "FAIL" | "WARNING" {
    // 1. Convert actual to string for safe handling
    const actualStr = String(actual);

    // 2. Exact string match
    if (expected.toLowerCase() === actualStr.toLowerCase()) return "PASS";

    // 3. Unit Parsing & Number Comparison
    const expectedNum = this.parseValueWithUnit(expected);
    const actualNum = this.parseValueWithUnit(actualStr);

    if (expectedNum && actualNum) {
      // Check compatibility (same unit type? e.g. both Length?)
      // For now, assume if units are parsed, they are implicitly compatible base units (mm -> m)
      // But wait, parseValueWithUnit needs to normalize to a BASE unit.

      // If units are mixed (one has unit, one doesn't), we might be comparing apples to oranges.
      // But if both are numbers...

      // Tolerance: 5%
      const diff = Math.abs(expectedNum.value - actualNum.value);
      const tolerance = 0.05 * Math.abs(expectedNum.value);

      if (diff <= tolerance) {
        return "PASS";
      }
    }

    // 4. Fuzzy Text Match
    if (actualStr.toLowerCase().includes(expected.toLowerCase())) return "PASS";

    return "FAIL";
  }

  /**
   * Parses "200mm", "0.2m", "100" into { value: number, unit: string }
   * Normalizes to standard units:
   * - Length -> meters
   * - Area -> m2
   * - Volume -> m3
   */
  private parseValueWithUnit(
    input: string,
  ): { value: number; unit: string } | null {
    // Remove whitespace
    const clean = input.trim().toLowerCase();
    const match = clean.match(/^([\d.]+)\s*([a-z%^23]+)?$/);

    if (!match) return null;

    let val = parseFloat(match[1]);
    let unit = match[2] || "";

    if (isNaN(val)) return null;

    // Normalize Unit
    if (unit === "mm" || unit === "millimeter") {
      val = val / 1000;
      unit = "m";
    } else if (unit === "cm" || unit === "centimeter") {
      val = val / 100;
      unit = "m";
    } else if (unit === "inch" || unit === "in" || unit === '"') {
      val = val * 0.0254;
      unit = "m";
    } else if (unit === "ft" || unit === "feet") {
      val = val * 0.3048;
      unit = "m";
    }
    // Add more conversions (MPa, psi, etc.) if needed
    // For now handling Length is the biggest win.

    return { value: val, unit };
  }

  private compareValues(
    expected: unknown,
    actual: unknown,
  ): "PASS" | "FAIL" | "WARNING" {
    // Legacy method kept for reference or simple string compare
    if (expected == actual) return "PASS";
    return "FAIL";
  }
}

export const validationService = new ValidationService();

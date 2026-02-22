import { PropertyNormalizer } from "../aps/property-normalizer";
// Import from new Parser Service
import { SpecificationItem } from "./parser.service";

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
   * Run validation for Demo purposes (No real models)
   */
  generateDemoResults(specs: SpecificationItem[]): ValidationResult[] {
    if (specs.length > 0) {
      return specs.map((spec, index) => {
        const rand = Math.random();
        let status: "PASS" | "FAIL" | "WARNING";
        let actualValue: string;
        const { value, property } = spec;

        if (rand < 0.5) {
          status = "PASS";
          actualValue = value;
        } else if (rand < 0.8) {
          status = "FAIL";
          actualValue = value.includes("mm")
            ? value.replace(/\d+/, (m) => String(parseInt(m) - 20))
            : "Different Value";
        } else {
          status = "WARNING";
          actualValue = "Not found in model";
        }

        return {
          property,
          expectedValue: value,
          actualValue,
          status,
          elementId: String(1000 + index),
          elementName: `Demo Element ${index + 1}`,
          modelName: "Demo Model",
          modelId: "demo",
          modelUrn: undefined,
        };
      });
    }

    // Fallback hardcoded demo
    return [
      {
        property: "Material",
        expectedValue: "Concrete C30",
        actualValue: "Concrete C30",
        status: "PASS",
        elementId: "1001",
        elementName: "Wall-001",
        modelName: "Demo",
      },
      {
        property: "Thickness",
        expectedValue: "200mm",
        actualValue: "180mm",
        status: "FAIL",
        elementId: "1002",
        elementName: "Wall-002",
        modelName: "Demo",
      },
    ];
  }

  /**
   * Validates model properties against structured document specifications.
   */
  validateModel(
    documentSpecs: SpecificationItem[],
    modelProperties: unknown[],
    modelInfo?: { name: string; id: string; urn?: string },
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

      // 1. Identify Object Category
      let objectCategory = "General";
      const categoryValue = objectProps["Category"];
      const typeValue = objectProps["Type"];
      if (typeof categoryValue === "string") objectCategory = categoryValue;
      else if (typeof typeValue === "string") objectCategory = typeValue;

      // 2. Filter Specs relevant to this Object
      const relevantSpecs = documentSpecs.filter((spec) => {
        if (spec.category === "General") return true;
        return this.categoryMatches(spec.category, objectCategory);
      });

      if (relevantSpecs.length === 0) continue;

      // 3. Validate each relevant spec
      for (const spec of relevantSpecs) {
        const normalizedKey = PropertyNormalizer.normalizeKey(spec.property);

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

          results.push({
            property: spec.property,
            expectedValue: spec.value,
            actualValue: actualRawValue,
            status: status,
            elementId: String(modelObj.objectid ?? ""),
            elementName: String(modelObj.name ?? ""),
            modelName: modelInfo?.name,
            modelId: modelInfo?.id,
            modelUrn: modelInfo?.urn,
          });
        }
      }
    }

    return results;
  }

  private categoryMatches(specCat: string, objCat: string): boolean {
    const s = specCat.toLowerCase();
    const o = objCat.toLowerCase();
    const keywords = s.split(/[\s/]+/);
    return keywords.some((k) => k.length > 3 && o.includes(k));
  }

  private flattenProperties(properties: unknown): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    if (!properties) return flat;

    for (const category in properties as Record<string, unknown>) {
      const props = properties as Record<string, unknown>;
      // Check if valid object and not null
      if (props[category] && typeof props[category] === "object") {
        const categoryObj = props[category] as Record<string, unknown>;
        for (const propName in categoryObj) {
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
    const actualStr = String(actual);
    if (expected.toLowerCase() === actualStr.toLowerCase()) return "PASS";

    const expectedNum = this.parseValueWithUnit(expected);
    const actualNum = this.parseValueWithUnit(actualStr);

    if (expectedNum && actualNum) {
      const diff = Math.abs(expectedNum.value - actualNum.value);
      const tolerance = 0.05 * Math.abs(expectedNum.value);
      if (diff <= tolerance) return "PASS";
    }

    if (actualStr.toLowerCase().includes(expected.toLowerCase())) return "PASS";

    return "FAIL";
  }

  private parseValueWithUnit(
    input: string,
  ): { value: number; unit: string } | null {
    const clean = input.trim().toLowerCase();
    const match = clean.match(/^([\d.]+)\s*([a-z%^23]+)?$/);

    if (!match) return null;

    let val = parseFloat(match[1]);
    let unit = match[2] || "";

    if (isNaN(val)) return null;

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

    return { value: val, unit };
  }
}

export const validationService = new ValidationService();

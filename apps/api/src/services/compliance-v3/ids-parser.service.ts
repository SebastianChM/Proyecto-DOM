import { XMLParser } from "fast-xml-parser";
import type { CreateRequirementInput } from "../../routes/compliance-v3/schemas";

export type CreateRequirementFromIdsInput = CreateRequirementInput;

export interface IdsPropertyRequirement {
  propertySet: string | null;
  baseName: string | null;
  dataType: string | null;
  restriction: {
    type:
      | "simpleValue"
      | "minInclusive"
      | "maxInclusive"
      | "pattern"
      | "enumeration";
    value: string;
  } | null;
}

export interface IdsSpecification {
  name: string;
  description: string | null;
  ifcVersion: string | null;
  applicability: {
    entityName: string | null;
  };
  requirements: IdsPropertyRequirement[];
}

export interface IdsParseResult {
  specifications: IdsSpecification[];
  errors: string[];
}

export interface IIdsParserService {
  parseXml(xmlContent: string): IdsParseResult;
  convertToRequirementInputs(
    result: IdsParseResult,
    packId: string,
    discipline: string,
  ): CreateRequirementFromIdsInput[];
}

export class IdsParserService implements IIdsParserService {
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
    });
  }

  parseXml(xmlContent: string): IdsParseResult {
    const result: IdsParseResult = { specifications: [], errors: [] };

    let parsed: unknown;
    try {
      parsed = this.xmlParser.parse(xmlContent);
    } catch (err) {
      result.errors.push(
        `XML parse error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return result;
    }

    const root = parsed as Record<string, unknown>;
    const ids = root?.ids as Record<string, unknown> | undefined;

    if (!ids && Object.keys(root).length === 0) {
      result.errors.push("XML parse error: missing root <ids> element");
      return result;
    }

    const specificationsNode = ids?.specifications as
      | Record<string, unknown>
      | undefined;

    if (!specificationsNode) {
      return result;
    }

    const rawSpec = specificationsNode.specification;
    if (!rawSpec) {
      return result;
    }

    const specArray: unknown[] = Array.isArray(rawSpec) ? rawSpec : [rawSpec];

    for (const item of specArray) {
      const spec = item as Record<string, unknown>;
      const name = spec["@_name"] as string | undefined;

      if (!name) {
        result.errors.push("Specification missing required 'name' attribute");
        continue;
      }

      const reqNode = (spec.requirements as Record<string, unknown> | undefined)
        ?.property;

      if (!reqNode) {
        result.errors.push(
          `Specification '${name}' has no requirements, skipped`,
        );
        continue;
      }

      const reqArray: unknown[] = Array.isArray(reqNode) ? reqNode : [reqNode];

      const requirements: IdsPropertyRequirement[] = reqArray.map((r) => {
        const req = r as Record<string, unknown>;
        const propertySet =
          ((req.propertySet as Record<string, unknown> | undefined)
            ?.simpleValue as string) ?? null;
        const baseName =
          ((req.baseName as Record<string, unknown> | undefined)
            ?.simpleValue as string) ?? null;
        const dataType = (req["@_dataType"] as string | undefined) ?? null;
        const valueNode = req.value as Record<string, unknown> | undefined;
        const restriction = valueNode
          ? this.extractRestriction(valueNode)
          : null;

        return { propertySet, baseName, dataType, restriction };
      });

      const applicability = spec.applicability as
        | Record<string, unknown>
        | undefined;
      const entityNode = applicability?.entity as
        | Record<string, unknown>
        | undefined;
      const entityNameNode = entityNode?.name as
        | Record<string, unknown>
        | undefined;
      const entityName = (entityNameNode?.simpleValue as string) ?? null;

      result.specifications.push({
        name,
        description: (spec["@_description"] as string | undefined) ?? null,
        ifcVersion: (spec["@_ifcVersion"] as string | undefined) ?? null,
        applicability: { entityName },
        requirements,
      });
    }

    return result;
  }

  convertToRequirementInputs(
    result: IdsParseResult,
    _packId: string,
    discipline: string,
  ): CreateRequirementFromIdsInput[] {
    const inputs: CreateRequirementFromIdsInput[] = [];

    for (const [specIdx, spec] of result.specifications.entries()) {
      if (spec.requirements.length === 0) continue;

      const slug = spec.name.replace(/\s+/g, "-").toUpperCase();
      const code = `IS-${slug}-R${String(specIdx + 1).padStart(3, "0")}`;

      const conditions = spec.requirements
        .filter((r) => r.baseName !== null)
        .map((r, idx) => ({
          propertyRef: r.baseName!,
          operator: this.mapRestrictionToOperator(r.restriction),
          value: r.restriction?.value ?? "N/A",
          unit: undefined as string | undefined,
          logicGroup: "AND" as const,
          sortOrder: idx,
        }));

      if (conditions.length === 0) continue;

      const description = spec.description
        ? `${spec.name} — ${spec.description}`
        : spec.name;

      inputs.push({
        code,
        description,
        legalReference: `${spec.ifcVersion ?? "IFC4"}:${spec.applicability.entityName ?? "ALL"}`,
        discipline,
        severity: "MANDATORY",
        tags: [],
        conditions,
        applicability: {
          targetCategories: [spec.applicability.entityName ?? "IFCPRODUCT"],
          excludeCategories: [],
          scope: "FILTERED",
        },
      });
    }

    return inputs;
  }

  private extractRestriction(
    valueNode: Record<string, unknown>,
  ): IdsPropertyRequirement["restriction"] {
    const restriction = valueNode.restriction as
      | Record<string, unknown>
      | undefined;

    if (restriction) {
      if (restriction.minInclusive) {
        const node = restriction.minInclusive as Record<string, unknown>;
        return { type: "minInclusive", value: String(node["@_value"] ?? "") };
      }
      if (restriction.maxInclusive) {
        const node = restriction.maxInclusive as Record<string, unknown>;
        return { type: "maxInclusive", value: String(node["@_value"] ?? "") };
      }
      if (restriction.pattern) {
        const node = restriction.pattern as Record<string, unknown>;
        return { type: "pattern", value: String(node["@_value"] ?? "") };
      }
      if (restriction.enumeration) {
        const node = restriction.enumeration as Record<string, unknown>;
        return { type: "enumeration", value: String(node["@_value"] ?? "") };
      }
    }

    if (valueNode.simpleValue !== undefined) {
      return { type: "simpleValue", value: String(valueNode.simpleValue) };
    }

    return null;
  }

  private mapRestrictionToOperator(
    restriction: IdsPropertyRequirement["restriction"],
  ):
    | "=="
    | ">="
    | "<="
    | ">"
    | "<"
    | "!="
    | "range"
    | "exists"
    | "contains"
    | "one_of" {
    if (!restriction) return "==";
    switch (restriction.type) {
      case "simpleValue":
        return "==";
      case "minInclusive":
        return ">=";
      case "maxInclusive":
        return "<=";
      case "pattern":
        return "contains";
      case "enumeration":
        return "one_of";
      default:
        return "==";
    }
  }
}

export const idsParserService: IIdsParserService = new IdsParserService();

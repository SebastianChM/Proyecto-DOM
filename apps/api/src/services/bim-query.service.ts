import { modelDerivativeService } from "./aps/model-derivative.service";
import { logger } from "../lib/logger";

export interface BimProperty {
  elementId: number;
  name: string;
  category: string;
  properties: Record<string, unknown>; // Normalized properties (key: value)
}

export class BimQueryService {
  // Known category property paths in Revit/APS
  private readonly CATEGORY_PATHS = [
    ["Identity Data", "Category"],
    ["__category__", "Category"],
    ["Category", "Category"],
    ["Element", "Category"],
    ["General", "Category"],
    ["__name__", "__category__"],
  ];

  // Patterns to extract category from element name
  private readonly NAME_CATEGORY_PATTERNS = [
    { pattern: /^Cable Tray/i, category: "Cable Trays" },
    { pattern: /^Conduit/i, category: "Conduits" },
    { pattern: /^Pipe/i, category: "Pipes" },
    { pattern: /^Duct/i, category: "Ducts" },
    { pattern: /^Light|Lumin/i, category: "Lighting Fixtures" },
    { pattern: /^Panel|Tablero/i, category: "Electrical Equipment" },
    { pattern: /^MEP_/i, category: "MEP Components" },
    { pattern: /^ELX/i, category: "Electrical" },
    { pattern: /^Wall|Muro/i, category: "Walls" },
    { pattern: /^Floor|Piso|Losa/i, category: "Floors" },
    { pattern: /^Column|Columna/i, category: "Structural Columns" },
    { pattern: /^Beam|Viga/i, category: "Structural Framing" },
    { pattern: /^Door|Puerta/i, category: "Doors" },
    { pattern: /^Window|Ventana/i, category: "Windows" },
  ];

  /**
   * Mass extraction optimized for filters.
   */
  async queryModel(urn: string): Promise<BimProperty[]> {
    logger.info(`[BIM_QUERY] Querying Model URN: ${urn}`);

    let rawProps;
    try {
      rawProps = await modelDerivativeService.getAllModelProperties(urn);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { diagnostic?: string } };
        message?: string;
      };
      logger.error("[BIM_QUERY] Error querying model", {
        error: err.response?.data || err.message || "Unknown error",
      });
      if (
        err.response?.status === 404 ||
        (err.response?.data?.diagnostic &&
          err.response.data.diagnostic.includes("No Property Database"))
      ) {
        throw new Error(
          "APS_MODEL_NOT_READY: The model properties are not yet extracted. Please wait a moment and try again.",
        );
      }
      throw error;
    }

    if (!rawProps || !rawProps.data || !rawProps.data.collection) {
      logger.warn("[BIM_QUERY] No property collection found.");
      return [];
    }

    logger.info(
      `[BIM_QUERY] Raw Objects Found: ${rawProps.data.collection.length}`,
    );

    // Track category distribution for debugging
    const categoryStats: Record<string, number> = {};

    const normalized: BimProperty[] = rawProps.data.collection.map(
      (obj: unknown) => {
        const element = obj as {
          objectid?: number;
          name?: string;
          type?: string;
          properties?: Record<string, unknown>;
        };
        const name = element.name || `Element ${element.objectid}`;
        const flatProps: Record<string, unknown> = {};

        // Start with Uncategorized
        let category = "Uncategorized";

        // Flatten properties and search for category
        if (element.properties) {
          for (const groupKey in element.properties) {
            const group = element.properties[groupKey];

            if (typeof group === "object" && group !== null) {
              const groupObj = group as Record<string, unknown>;
              for (const propKey in groupObj) {
                const value = groupObj[propKey];
                flatProps[`${groupKey}/${propKey}`] = value;
                flatProps[propKey] = value;

                // Check if this is a category field
                if (
                  propKey.toLowerCase() === "category" &&
                  typeof value === "string"
                ) {
                  category = value;
                }
              }
            } else if (typeof group === "string") {
              flatProps[groupKey] = group;
              // Check direct category property
              if (groupKey.toLowerCase() === "category") {
                category = group;
              }
            }
          }
        }

        // Fallback 1: Check known paths explicitly
        if (category === "Uncategorized") {
          for (const [group, prop] of this.CATEGORY_PATHS) {
            const propGroup = element.properties?.[group] as
              | Record<string, unknown>
              | undefined;
            const value = propGroup?.[prop];
            if (value && typeof value === "string") {
              category = value;
              break;
            }
          }
        }

        // Fallback 2: Try extracting from object name patterns
        if (category === "Uncategorized") {
          for (const { pattern, category: cat } of this
            .NAME_CATEGORY_PATTERNS) {
            if (pattern.test(name)) {
              category = cat;
              break;
            }
          }
        }

        // Fallback 3: Use the object 'type' if available
        if (category === "Uncategorized" && element.type) {
          category = element.type;
        }

        // Track stats
        categoryStats[category] = (categoryStats[category] || 0) + 1;

        return {
          elementId: element.objectid || 0,
          name: name,
          category: category,
          properties: flatProps,
        };
      },
    );

    // Log category distribution
    logger.info("[BIM_QUERY] Category Distribution:");
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([cat, count]) =>
        logger.debug(`[BIM_QUERY]    ${cat}: ${count}`),
      );

    logger.info(`[BIM_QUERY] Normalized ${normalized.length} Elements.`);
    return normalized;
  }

  /**
   * Extracts a standardized Bill of Materials (BOM) from the model.
   */
  async getBOM(urn: string) {
    const elements = await this.queryModel(urn);

    return elements
      .map((element) => {
        const props = element.properties;

        // Extract Standard Properties using flattened keys
        // The flatten logic in queryModel puts direct keys (e.g. "Volume") in the root

        const family = this.findProp(props, [
          "Family",
          "Familia",
          "Family Name",
          "Nombre de familia",
        ]);
        const typeName =
          this.findProp(props, [
            "Type",
            "Tipo",
            "Type Name",
            "Nombre de tipo",
          ]) || element.name;
        const material = this.findProp(props, [
          "Material",
          "Structural Material",
          "Material estructural",
          "Material Name",
        ]);

        const volume = this.parseNumeric(
          this.findProp(props, [
            "Volume",
            "Volumen",
            "Host Volume",
            "Gross Volume",
            "Net Volume",
          ]),
        );
        const area = this.parseNumeric(
          this.findProp(props, [
            "Area",
            "Área",
            "Surface Area",
            "Gross Area",
            "Host Area",
          ]),
        );
        const length = this.parseNumeric(
          this.findProp(props, ["Length", "Longitud", "Curve Length"]),
        );

        return {
          id: element.elementId,
          // externalId: element.externalId, // TODO: Bind ExternalId in queryModel if needed
          name: element.name,
          category: element.category,
          family: String(family || ""),
          type: String(typeName || ""),
          material: String(material || ""),
          volume,
          area,
          length,
          count: 1,
        };
      })
      .filter((e) => !e.name.startsWith("Non-Revit"));
  }

  private findProp(props: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (props[key] !== undefined) return props[key];
      // Case insensitive check
      const found = Object.keys(props).find(
        (k) => k.toLowerCase() === key.toLowerCase(),
      );
      if (found) return props[found];
    }
    return undefined;
  }

  private parseNumeric(value: unknown): number {
    if (value === undefined || value === null) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      return parseFloat(cleaned) || 0;
    }
    return 0;
  }
}

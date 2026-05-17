import { modelDerivativeService } from "./aps/model-derivative.service";
import { logger } from "../lib/logger";
import { serviceUnavailable } from "../lib/errors";
import { categoryDictionaryService } from "./dictionary/category-dictionary.service";
import { propertyDictionaryService } from "./dictionary/property-dictionary.service";
import type { CategoryEntry } from "./dictionary/types";

export interface BimProperty {
  elementId: number;
  name: string;
  category: string;
  properties: Record<string, unknown>; // Normalized properties (key: value)
}

export interface BimQueryConfig {
  locale?: string;
  categoryPaths?: [string, string][];
}

const DEFAULT_CATEGORY_PATHS: [string, string][] = [
  ["Identity Data", "Category"],
  ["__category__", "Category"],
  ["Category", "Category"],
  ["Element", "Category"],
  ["General", "Category"],
  ["__name__", "__category__"],
];

export interface IBimQueryService {
  queryModel(urn: string): Promise<BimProperty[]>;
  getBOM(urn: string): Promise<unknown[]>;
}

export class BimQueryService implements IBimQueryService {
  private locale: string;
  private categoryPaths: [string, string][];

  constructor(config?: BimQueryConfig) {
    this.locale = config?.locale ?? "en-US";
    this.categoryPaths = config?.categoryPaths ?? DEFAULT_CATEGORY_PATHS;
  }

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
        throw serviceUnavailable(
          "The model properties are not yet extracted. Please wait a moment and try again.",
          "APS_MODEL_NOT_READY",
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

    // Build category map from object tree for proper Revit category resolution
    const categoryMap = await this.buildCategoryMap(urn);
    if (Object.keys(categoryMap).length > 0) {
      logger.info(
        `[BIM_QUERY] Object tree category map: ${Object.keys(categoryMap).length} entries`,
      );
    }

    // Pre-load dictionary categories for name-based resolution (both locales)
    const [categoriesEn, categoriesEs] = await Promise.all([
      categoryDictionaryService.getAll("en-US"),
      categoryDictionaryService.getAll("es-CL"),
    ]);
    const allCategories = [...categoriesEn, ...categoriesEs];

    // Track category distribution for debugging
    const categoryStats: Record<string, number> = {};

    /** Map a single raw APS object to a BimProperty (pure sync) */
    const mapElement = (obj: unknown): BimProperty => {
      const element = obj as {
        objectid?: number;
        name?: string;
        type?: string;
        properties?: Record<string, unknown>;
      };
      const name = element.name || `Element ${element.objectid}`;
      const flatProps: Record<string, unknown> = {};

      // Start with category from object tree (most reliable for Revit)
      let category = categoryMap[element.objectid || 0] || "Uncategorized";

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

      // Fallback 1: Check known paths explicitly (configurable)
      if (category === "Uncategorized") {
        for (const [group, prop] of this.categoryPaths) {
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

      // Fallback 2: Resolve from element name using CategoryDictionary
      if (category === "Uncategorized") {
        const resolved = this.resolveCategoryFromName(name, allCategories);
        if (resolved) {
          category = resolved;
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
        name,
        category,
        properties: flatProps,
      };
    };

    // Process in chunks of 500 to yield to the event loop between batches
    const CHUNK_SIZE = 500;
    const collection = rawProps.data.collection;
    const normalized: BimProperty[] = [];
    for (let i = 0; i < collection.length; i += CHUNK_SIZE) {
      const chunk = collection.slice(i, i + CHUNK_SIZE);
      normalized.push(...chunk.map(mapElement));
      if (i + CHUNK_SIZE < collection.length) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }

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

    // Resolve property aliases from the dictionary for canonical BOM properties
    const canonicalNames = [
      "Family",
      "Type",
      "Material",
      "Volume",
      "Area",
      "Length",
    ];
    const aliasMap = new Map<string, string[]>();

    const resolvedEntries = await Promise.all(
      canonicalNames.map((name) =>
        propertyDictionaryService.resolve(name, this.locale),
      ),
    );
    for (let i = 0; i < canonicalNames.length; i++) {
      const canonical = canonicalNames[i];
      const entry = resolvedEntries[i];
      const keys = [canonical];
      if (entry) {
        keys.push(entry.displayName, ...entry.aliases);
      }
      aliasMap.set(canonical, [...new Set(keys)]);
    }

    return elements
      .map((element) => {
        const props = element.properties;

        // Family: First try dictionary aliases, then extract from element name
        let family = this.findProp(props, aliasMap.get("Family")!);
        if (!family) {
          const nameMatch = element.name?.match(/^(.+?)\s*\[/);
          if (nameMatch) {
            family = nameMatch[1].trim();
          }
        }
        const typeName =
          this.findProp(props, aliasMap.get("Type")!) || element.name;
        const material = this.findProp(props, aliasMap.get("Material")!);

        const volume = this.parseNumeric(
          this.findProp(props, aliasMap.get("Volume")!),
        );
        const area = this.parseNumeric(
          this.findProp(props, aliasMap.get("Area")!),
        );
        const length = this.parseNumeric(
          this.findProp(props, aliasMap.get("Length")!),
        );

        return {
          id: element.elementId,
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

  /**
   * Resolve category from element name using CategoryDictionary entries.
   * Checks if the element name starts with any known displayName, revitCategory, or alias.
   * Sorted by candidate length (longest first) to prefer more specific matches.
   */
  private resolveCategoryFromName(
    name: string,
    categories: CategoryEntry[],
  ): string | null {
    const lower = name.toLowerCase();
    let bestMatch: { revitCategory: string; length: number } | null = null;

    for (const cat of categories) {
      const candidates = [cat.displayName, cat.revitCategory, ...cat.aliases];
      for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        if (
          lower.startsWith(candidateLower) &&
          (!bestMatch || candidateLower.length > bestMatch.length)
        ) {
          bestMatch = {
            revitCategory: cat.revitCategory,
            length: candidateLower.length,
          };
        }
      }
    }

    return bestMatch?.revitCategory ?? null;
  }

  /**
   * Build a map of objectid → Revit category name from the APS object tree.
   * The object tree has a hierarchy: Root > Category > Family > Type > Instance
   * We walk depth=2 nodes (categories) and assign their name to all descendants.
   */
  private async buildCategoryMap(urn: string): Promise<Record<number, string>> {
    const map: Record<number, string> = {};
    try {
      const metadata = await modelDerivativeService.getMetadata(urn);
      const view3d =
        metadata.data.metadata.find(
          (m: { role?: string; isMasterView?: boolean }) =>
            m.role === "3d" && m.isMasterView,
        ) ||
        metadata.data.metadata.find((m: { role?: string }) => m.role === "3d");

      if (!view3d) return map;

      const tree = await modelDerivativeService.getObjectTree(urn, view3d.guid);
      if (!tree?.data?.objects) return map;

      // Walk the tree: Root → Categories → Families → Types → Instances
      interface TreeNode {
        objectid: number;
        name: string;
        objects?: TreeNode[];
      }

      const walkCategory = (node: TreeNode, categoryName: string) => {
        map[node.objectid] = categoryName;
        if (node.objects) {
          for (const child of node.objects) {
            walkCategory(child, categoryName);
          }
        }
      };

      const root = tree.data.objects[0] as TreeNode;
      if (root?.objects) {
        for (const categoryNode of root.objects) {
          // depth-1 nodes are Revit categories (Walls, Doors, etc.)
          walkCategory(categoryNode, categoryNode.name);
        }
      }

      logger.debug(
        `[BIM_QUERY] Category map built: ${Object.keys(map).length} elements mapped`,
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(
        `[BIM_QUERY] Could not build category map from object tree: ${msg}`,
      );
    }
    return map;
  }
}

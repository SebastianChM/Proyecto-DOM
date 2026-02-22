import { DerivativesApi } from "forge-apis";
import { apsAuthService } from "./auth.service";
import {
  DiffResult,
  DiffItem,
  PropertyChange,
} from "../../interfaces/comparison.interface";
import { logger } from "../../lib/logger";

interface MetadataItem {
  role?: string;
  guid?: string;
  [key: string]: unknown;
}

interface ModelObject {
  objectid: number;
  externalId?: string;
  name: string;
  properties?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export class APSComparisonService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private api: any; // DerivativesApi is a namespace, not a type

  constructor() {
    this.api = new DerivativesApi();
  }

  /**
   * Compare two model versions (URNs) to detect structural and property changes.
   *
   * @param urn1 Base Version URN (The "Old" version)
   * @param urn2 Target Version URN (The "New" version)
   * @returns DiffResult object containing added, removed, and modified elements.
   */
  async compareMetadata(urn1: string, urn2: string): Promise<DiffResult> {
    // 1. Local/Demo Mode Check — only allowed in non-production
    if (urn1.startsWith("local-") || urn2.startsWith("local-")) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Local/mock comparisons are not allowed in production environment.",
        );
      }
      logger.warn(
        "[COMPARISON] Local mode detected, returning mock diff (dev only)",
      );
      return this.getMockDiff(urn1, urn2);
    }

    try {
      const token = await apsAuthService.getInternalToken();

      // 2. Fetch Metadata (Object Hierarchy) for both versions
      // We need the GUID of the 3D view to get properties.
      // Typically we look for the "3D" role in the metadata.
      const meta1 = await this.getMetadata(urn1, token);
      const meta2 = await this.getMetadata(urn2, token);

      const guid1 = this.find3DViewGuid(meta1);
      const guid2 = this.find3DViewGuid(meta2);

      if (!guid1 || !guid2) {
        throw new Error(
          "Could not find a valid 3D View GUID in one or both documents.",
        );
      }

      // 3. Fetch Properties (Large payload!) for both
      // In a real production scenario with large models (~10k+ elements),
      // downloading the full JSON props is slow.
      // Optimization: Use Model Derivative "Query" endpoint or extract SQLite database (User-Deprecated in APS but still useful logic).
      // For this implementation, we assume reasonable model size.
      const props1 = await this.getProperties(urn1, guid1, token);
      const props2 = await this.getProperties(urn2, guid2, token);

      // 4. Compute Diff
      return this.computeDiff(
        urn1,
        urn2,
        props1.data.collection,
        props2.data.collection,
      );
    } catch (error: unknown) {
      const err = error as { response?: { body?: unknown }; message?: string };
      logger.error("[COMPARISON] Error comparing models", {
        error: err.message,
      });
      throw new Error(
        "Failed to compare models. Ensure URNs are valid and processed.",
      );
    }
  }

  private async getMetadata(urn: string, token: string) {
    return (
      await this.api.getMetadata(
        urn,
        {},
        { accessToken: token },
        { accessToken: token },
      )
    ).body;
  }

  private async getProperties(urn: string, guid: string, token: string) {
    const response = await this.api.getModelviewProperties(
      urn,
      guid,
      { forceget: true },
      { accessToken: token },
      { accessToken: token },
    );

    // Handle 202 Accepted (Processing) - In a real worker we would poll.
    // Here we assume it's ready or throw.
    if (response.statusCode === 202) {
      // For now, simpler to fail fast than implement polling in this request scoped service
      // Proper way: Enqueue this diff job in the Worker.
      logger.warn("[COMPARISON] Properties still processing/extracting by APS");
    }

    return response.body;
  }

  /**
   * Helper to find the main 3D view GUID from metadata
   */
  private find3DViewGuid(metadata: {
    data?: { metadata?: MetadataItem[] };
  }): string | null {
    if (!metadata || !metadata.data || !metadata.data.metadata) return null;

    // Prefer '3d' role, valid for SVF/SVF2
    const view = metadata.data.metadata.find(
      (m: MetadataItem) => m.role === "3d",
    );
    return view
      ? (view.guid ?? null)
      : (metadata.data.metadata[0]?.guid ?? null);
  }

  private computeDiff(
    urn1: string,
    urn2: string,
    objs1: ModelObject[],
    objs2: ModelObject[],
  ): DiffResult {
    // Map by 'name' is risky if names are not unique (e.g. "Basic Wall").
    // 'objectid' (dbId) changes between versions if re-generated.
    // 'externalId' is the safest IF the authoring tool (Revit) preserves Element IDs.
    // Fallback: Name + Category or some composite key.
    // For this demo: using 'name' as key, assuming unique names for simplicity.

    const map1 = new Map<string, ModelObject>(objs1.map((o) => [o.name, o]));
    const map2 = new Map<string, ModelObject>(objs2.map((o) => [o.name, o]));

    const added: DiffItem[] = [];
    const removed: DiffItem[] = [];
    const modified: DiffItem[] = [];
    let identical = 0;

    // 1. Check for Removed (In 1 but not in 2)
    for (const [key, obj1] of map1) {
      if (!map2.has(key)) {
        removed.push({
          id: obj1.objectid,
          externalId: obj1.externalId,
          name: obj1.name,
          categoryName: this.extractCategory(obj1),
        });
      } else {
        // Exists in both, check for modifications
        const obj2 = map2.get(key);

        // Type guard: obj2 should exist since map2.has(key) is true
        if (!obj2) continue;

        const changes = this.compareObjectProperties(obj1, obj2);

        if (changes.length > 0) {
          modified.push({
            id: obj2.objectid, // Use new ID
            externalId: obj2.externalId,
            name: obj2.name,
            categoryName: this.extractCategory(obj2),
            changes: changes,
          });
        } else {
          identical++;
        }
      }
    }

    // 2. Check for Added (In 2 but not in 1)
    for (const [key, obj2] of map2) {
      if (!map1.has(key)) {
        added.push({
          id: obj2.objectid,
          externalId: obj2.externalId,
          name: obj2.name,
          categoryName: this.extractCategory(obj2),
        });
      }
    }

    return {
      baseUrn: urn1,
      targetUrn: urn2,
      timestamp: new Date(),
      summary: {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
        identical: identical,
      },
      details: {
        added,
        removed,
        modified,
      },
    };
  }

  private compareObjectProperties(
    obj1: ModelObject,
    obj2: ModelObject,
  ): PropertyChange[] {
    const changes: PropertyChange[] = [];

    // Critical categories to check
    const categories = [
      "Mechanical",
      "Dimensions",
      "Identity Data",
      "Construction",
    ];

    // Helper to safe access properties
    const getProps = (obj: ModelObject, cat: string) =>
      obj.properties ? obj.properties[cat] : null;

    categories.forEach((cat) => {
      const p1 = getProps(obj1, cat);
      const p2 = getProps(obj2, cat);

      if (p1 && p2) {
        // Check all keys in p1
        Object.keys(p1).forEach((propName) => {
          const val1 = p1[propName];
          const val2 = p2[propName];

          if (val1 !== val2) {
            // Basic strict equality check. Could be refined for flexible numbers.
            changes.push({
              category: cat,
              name: propName,
              oldValue: val1,
              newValue: val2,
            });
          }
        });
      }
    });

    return changes;
  }

  private extractCategory(obj: ModelObject): string {
    // Allow loose property access
    if (obj.properties && obj.properties["Category"]) {
      // Usually category is a property like "Category: Wall"
      // Or look at 'Identity Data'
      // This depends on the source model schema
      return "Standard";
    }
    return "Unknown";
  }

  private getMockDiff(urn1: string, urn2: string): DiffResult {
    return {
      baseUrn: urn1,
      targetUrn: urn2,
      timestamp: new Date(),
      summary: { added: 1, removed: 1, modified: 1, identical: 5 },
      details: {
        added: [{ id: 99, name: "New Partition Wall", categoryName: "Walls" }],
        removed: [{ id: 88, name: "Old Door (Type A)", categoryName: "Doors" }],
        modified: [
          {
            id: 101,
            name: "External Wall",
            categoryName: "Walls",
            changes: [
              { name: "Fire Rating", oldValue: "1hr", newValue: "2hr" },
            ],
          },
        ],
      },
    };
  }
}

export const apsComparisonService = new APSComparisonService();

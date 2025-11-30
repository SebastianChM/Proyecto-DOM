import { DerivativesApi } from 'forge-apis';
import { apsAuthService } from './auth.service';

export class APSComparisonService {
    private api: any;

    constructor() {
        this.api = new DerivativesApi();
    }

    /**
     * Trigger a Diff Job between two URNs (versions)
     * Note: This is conceptual as APS doesn't have a direct "Diff API" that returns a JSON diff for everything.
     * However, Model Derivative allows extracting metadata for both and we can compare JSONs, 
     * OR we can use the Viewer's Diff Extension which is client-side.
     * 
     * BUT, for server-side change detection (e.g. "Wall moved"), we usually:
     * 1. Extract hierarchy/properties for V1
     * 2. Extract hierarchy/properties for V2
     * 3. Compare them.
     * 
     * Alternatively, we can just prepare the data for the Frontend to visualize the diff.
     * The Frontend Viewer has a "Autodesk.BIM360.Extension.Diff" or "Autodesk.AEC.LevelsExtension".
     * 
     * For this service, let's implement a metadata comparison helper.
     */
    async compareMetadata(urn1: string, urn2: string) {
        // Local Mode Check
        if (urn1.startsWith('local-') || urn2.startsWith('local-')) {
            console.log('🔧 Local mode detected for comparison. Returning mock diff.');
            return {
                summary: { added: 1, removed: 1, modified: 1 },
                details: {
                    added: [{ id: 99, name: 'New Wall' }],
                    removed: [{ id: 88, name: 'Old Door' }],
                    modified: [{ id: 1, name: 'Mock Wall', changes: { mass: { old: 10, new: 12 } } }]
                }
            };
        }

        const token = await apsAuthService.getInternalToken();

        // Get Metadata for both
        const meta1 = await this.getMetadata(urn1, token);
        const meta2 = await this.getMetadata(urn2, token);

        // Get Properties for the main 3D view of both
        const guid1 = meta1.data.metadata[0].guid;
        const guid2 = meta2.data.metadata[0].guid;

        const props1 = await this.getProperties(urn1, guid1, token);
        const props2 = await this.getProperties(urn2, guid2, token);

        // Perform simple diff logic (Added, Removed, Modified)
        return this.computeDiff(props1.data.collection, props2.data.collection);
    }

    private async getMetadata(urn: string, token: string) {
        return (await this.api.getMetadata(urn, {}, { accessToken: token }, { accessToken: token })).body;
    }

    private async getProperties(urn: string, guid: string, token: string) {
        return (await this.api.getModelviewProperties(urn, guid, {}, { accessToken: token }, { accessToken: token })).body;
    }

    private computeDiff(objs1: any[], objs2: any[]) {
        const map1 = new Map(objs1.map(o => [o.name, o])); // Using Name as key (ExternalId is better if available)
        const map2 = new Map(objs2.map(o => [o.name, o]));

        const added: any[] = [];
        const removed: any[] = [];
        const modified: any[] = [];

        // Check for Removed and Modified
        for (const [id, obj1] of map1) {
            if (!map2.has(id)) {
                removed.push({ id: obj1.objectid, name: obj1.name });
            } else {
                const obj2 = map2.get(id);
                // Simple property check (e.g. Mass or Volume changed)
                const mass1 = obj1.properties?.Mechanical?.Mass;
                const mass2 = obj2.properties?.Mechanical?.Mass;
                
                if (mass1 !== mass2) {
                    modified.push({ 
                        id: obj1.objectid, 
                        name: obj1.name, 
                        changes: { mass: { old: mass1, new: mass2 } } 
                    });
                }
            }
        }

        // Check for Added
        for (const [id, obj2] of map2) {
            if (!map1.has(id)) {
                added.push({ id: obj2.objectid, name: obj2.name });
            }
        }

        return {
            summary: {
                added: added.length,
                removed: removed.length,
                modified: modified.length
            },
            details: {
                added,
                removed,
                modified
            }
        };
    }
}

export const apsComparisonService = new APSComparisonService();


import { modelDerivativeService } from './aps/model-derivative.service';

export interface BimProperty {
    elementId: number;
    name: string;
    category: string;
    properties: Record<string, any>; // Normalized properties (key: value)
}

export class BimQueryService {

    // Known category property paths in Revit/APS
    private readonly CATEGORY_PATHS = [
        ['Identity Data', 'Category'],
        ['__category__', 'Category'],
        ['Category', 'Category'],
        ['Element', 'Category'],
        ['General', 'Category'],
        ['__name__', '__category__']
    ];

    // Patterns to extract category from element name
    private readonly NAME_CATEGORY_PATTERNS = [
        { pattern: /^Cable Tray/i, category: 'Cable Trays' },
        { pattern: /^Conduit/i, category: 'Conduits' },
        { pattern: /^Pipe/i, category: 'Pipes' },
        { pattern: /^Duct/i, category: 'Ducts' },
        { pattern: /^Light|Lumin/i, category: 'Lighting Fixtures' },
        { pattern: /^Panel|Tablero/i, category: 'Electrical Equipment' },
        { pattern: /^MEP_/i, category: 'MEP Components' },
        { pattern: /^ELX/i, category: 'Electrical' },
        { pattern: /^Wall|Muro/i, category: 'Walls' },
        { pattern: /^Floor|Piso|Losa/i, category: 'Floors' },
        { pattern: /^Column|Columna/i, category: 'Structural Columns' },
        { pattern: /^Beam|Viga/i, category: 'Structural Framing' },
        { pattern: /^Door|Puerta/i, category: 'Doors' },
        { pattern: /^Window|Ventana/i, category: 'Windows' }
    ];

    /**
     * Mass extraction optimized for filters.
     */
    async queryModel(urn: string): Promise<BimProperty[]> {
        console.log(`🔍 Querying Model URN: ${urn}`);

        let rawProps;
        try {
            rawProps = await modelDerivativeService.getAllModelProperties(urn);
        } catch (error: any) {
            console.error('BimQueryService Error:', error.response?.data || error.message);
            if (error.response?.status === 404 || (error.response?.data?.diagnostic && error.response.data.diagnostic.includes('No Property Database'))) {
                throw new Error('APS_MODEL_NOT_READY: The model properties are not yet extracted. Please wait a moment and try again.');
            }
            throw error;
        }

        if (!rawProps || !rawProps.data || !rawProps.data.collection) {
            console.warn('⚠️ No property collection found.');
            return [];
        }

        console.log(`📦 Raw Objects Found: ${rawProps.data.collection.length}`);

        // Track category distribution for debugging
        const categoryStats: Record<string, number> = {};

        const normalized: BimProperty[] = rawProps.data.collection.map((obj: any) => {
            const name = obj.name || `Element ${obj.objectid}`;
            const flatProps: Record<string, any> = {};

            // Start with Uncategorized
            let category = "Uncategorized";

            // Flatten properties and search for category
            if (obj.properties) {
                for (const groupKey in obj.properties) {
                    const group = obj.properties[groupKey];

                    if (typeof group === 'object' && group !== null) {
                        for (const propKey in group) {
                            const value = group[propKey];
                            flatProps[`${groupKey}/${propKey}`] = value;
                            flatProps[propKey] = value;

                            // Check if this is a category field
                            if (propKey.toLowerCase() === 'category' && typeof value === 'string') {
                                category = value;
                            }
                        }
                    } else if (typeof group === 'string') {
                        flatProps[groupKey] = group;
                        // Check direct category property
                        if (groupKey.toLowerCase() === 'category') {
                            category = group;
                        }
                    }
                }
            }

            // Fallback 1: Check known paths explicitly
            if (category === "Uncategorized") {
                for (const [group, prop] of this.CATEGORY_PATHS) {
                    const value = obj.properties?.[group]?.[prop];
                    if (value && typeof value === 'string') {
                        category = value;
                        break;
                    }
                }
            }

            // Fallback 2: Try extracting from object name patterns
            if (category === "Uncategorized") {
                for (const { pattern, category: cat } of this.NAME_CATEGORY_PATTERNS) {
                    if (pattern.test(name)) {
                        category = cat;
                        break;
                    }
                }
            }

            // Fallback 3: Use the object 'type' if available
            if (category === "Uncategorized" && obj.type) {
                category = obj.type;
            }

            // Track stats
            categoryStats[category] = (categoryStats[category] || 0) + 1;

            return {
                elementId: obj.objectid,
                name: name,
                category: category,
                properties: flatProps
            };
        });

        // Log category distribution
        console.log('📊 Category Distribution:');
        Object.entries(categoryStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));

        console.log(`✅ Normalized ${normalized.length} Elements.`);
        return normalized;
    }
}

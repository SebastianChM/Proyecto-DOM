
import { v4 as uuidv4 } from 'uuid';
import { UniversalRequirement } from '../types/spec-grammar.types';
import { BimProperty } from './bim-query.service';
import { UnitNormalizerService } from './unit-normalizer.service';
import { ELECTRICAL_VOCABULARY, getRevitCategory } from '../config/electrical-vocabulary';

export interface Incident {
    id: string;
    requirementId: string;
    elementId: number;
    elementName: string;
    elementCategory: string;
    description: string;
    expected: string;
    actual: string;
    severity: 'CRITICAL' | 'WARNING';
    status: 'OPEN';
    timestamp: Date;
}

export interface GroupedIncidents {
    category: string;
    count: number;
    incidents: Incident[];
}

export class ComplianceKernelService {
    private normalizer = new UnitNormalizerService();

    // Electrical category mappings (Revit category names)
    private readonly ELECTRICAL_CATEGORIES = [
        'Cable Trays', 'Cable Tray Fittings',
        'Conduits', 'Conduit Fittings',
        'Electrical Equipment', 'Electrical Fixtures',
        'Lighting Fixtures', 'Lighting Devices',
        'Communication Devices', 'Data Devices',
        'Wire', 'Cables'
    ];

    // Property name aliases for better matching
    private readonly PROPERTY_ALIASES: Record<string, string[]> = {
        'width': ['width', 'ancho', 'w', 'breadth'],
        'height': ['height', 'alto', 'h', 'altura'],
        'depth': ['depth', 'profundidad', 'd'],
        'length': ['length', 'largo', 'longitud', 'l'],
        'diameter': ['diameter', 'diámetro', 'diametro', 'dia', 'ø'],
        'voltage': ['voltage', 'voltaje', 'tensión', 'tension', 'v'],
        'current': ['current', 'corriente', 'amperage', 'amperaje', 'a'],
        'power': ['power', 'potencia', 'wattage', 'w']
    };

    /**
     * Enhanced evaluation with strict matching and deduplication
     */
    evaluate(requirements: UniversalRequirement[], elements: BimProperty[]): Incident[] {
        const incidents: Incident[] = [];
        const seenKeys = new Set<string>(); // For deduplication

        console.log(`[Compliance] Starting evaluation: ${requirements.length} requirements vs ${elements.length} elements`);

        for (const req of requirements) {
            // Skip generic/invalid requirements
            if (this.isGenericRequirement(req)) {
                console.log(`[Compliance] Skipping generic requirement: "${req.parameter}"`);
                continue;
            }

            console.log(`[Compliance] Evaluating: "${req.parameter}" ${req.operator} ${req.value} | Category: "${req.derivedCategory}"`);

            // Pre-filter elements by category for efficiency
            const relevantElements = this.filterElementsByScope(elements, req.derivedCategory || 'General');
            console.log(`[Compliance] Found ${relevantElements.length} relevant elements for category "${req.derivedCategory}"`);

            for (const elem of relevantElements) {
                // Find matching property using aliases
                const matchedPropKey = this.findMatchingProperty(elem.properties, req.parameter);

                if (matchedPropKey) {
                    const actualValue = elem.properties[matchedPropKey];

                    // Compare values
                    const isCompliant = this.checkCompliance(req, actualValue);

                    if (!isCompliant) {
                        // Deduplication key
                        const dedupKey = `${req.id}-${elem.category}-${req.parameter}`;

                        if (!seenKeys.has(dedupKey)) {
                            seenKeys.add(dedupKey);

                            incidents.push({
                                id: uuidv4(),
                                requirementId: req.id,
                                elementId: elem.elementId,
                                elementName: elem.name,
                                elementCategory: elem.category,
                                description: this.formatDescription(req, actualValue, matchedPropKey),
                                expected: `${req.operator} ${req.value}`,
                                actual: String(actualValue),
                                severity: this.determineSeverity(req, actualValue),
                                status: 'OPEN',
                                timestamp: new Date()
                            });
                        }
                    }
                }
            }
        }

        console.log(`[Compliance] Evaluation complete: ${incidents.length} incidents found`);
        return incidents;
    }

    /**
     * Check if requirement is too generic to be useful
     * NOTE: Made less strict - only skip truly empty/meaningless requirements
     */
    private isGenericRequirement(req: UniversalRequirement): boolean {
        const param = (req.parameter || '').toLowerCase();

        // Only skip if parameter explicitly says "generic constraint"
        if (param === 'generic constraint') return true;

        // Skip if both parameter AND value are empty
        if (!req.parameter && (!req.value || req.value.trim() === '')) return true;

        // Skip if value is just "Exists" with no parameter
        if (req.value === 'Exists' && !req.parameter) return true;

        return false;
    }

    /**
     * Pre-filter elements by category for efficiency
     */
    private filterElementsByScope(elements: BimProperty[], reqCategory: string): BimProperty[] {
        // If no category or General, return ALL elements (including Uncategorized)
        // This allows matching when categories aren't properly extracted
        if (!reqCategory || reqCategory === 'General') {
            return elements; // Don't filter - match against all
        }

        return elements.filter(elem => this.isScopeMatch(reqCategory, elem.category, elem.name));
    }

    /**
     * Check if element is in an electrical category
     */
    private isElectricalCategory(category: string): boolean {
        const c = category.toLowerCase();
        return this.ELECTRICAL_CATEGORIES.some(ec => c.includes(ec.toLowerCase()));
    }

    /**
     * Find matching property with alias support
     */
    private findMatchingProperty(props: Record<string, any>, paramName: string): string | null {
        const search = paramName.toLowerCase();

        // First, try direct match
        for (const key of Object.keys(props)) {
            if (key.toLowerCase() === search) return key;
        }

        // Then, try alias match
        const aliases = this.PROPERTY_ALIASES[search] || [search];
        for (const alias of aliases) {
            for (const key of Object.keys(props)) {
                if (key.toLowerCase().includes(alias)) return key;
            }
        }

        // Fuzzy fallback
        return Object.keys(props).find(k => k.toLowerCase().includes(search)) || null;
    }

    /**
     * Enhanced scope matching with electrical category support
     */
    private isScopeMatch(reqCategory: string, elemCategory: string, elemName: string): boolean {
        const r = reqCategory.toUpperCase();
        const c = elemCategory.toUpperCase();
        const n = elemName.toUpperCase();

        // 1. Exact match
        if (c.includes(r) || r.includes(c)) return true;

        // 2. Singular/Plural handling
        const singular = r.endsWith('S') ? r.slice(0, -1) : r;
        if (c.includes(singular) || n.includes(singular)) return true;

        // 3. Electrical-specific mappings
        const electricalMappings: Record<string, string[]> = {
            'CABLE TRAY': ['CABLE TRAYS', 'CABLE TRAY FITTINGS'],
            'BANDEJA': ['CABLE TRAYS', 'CABLE TRAY FITTINGS'],
            'CONDUIT': ['CONDUITS', 'CONDUIT FITTINGS'],
            'TUBO': ['CONDUITS', 'CONDUIT FITTINGS'],
            'LUMINARIA': ['LIGHTING FIXTURES', 'LIGHTING DEVICES'],
            'LIGHTING': ['LIGHTING FIXTURES', 'LIGHTING DEVICES'],
            'TABLERO': ['ELECTRICAL EQUIPMENT', 'ELECTRICAL PANELS'],
            'PANEL': ['ELECTRICAL EQUIPMENT', 'ELECTRICAL PANELS']
        };

        for (const [key, values] of Object.entries(electricalMappings)) {
            if (r.includes(key)) {
                if (values.some(v => c.includes(v))) return true;
            }
        }

        return false;
    }

    /**
     * Check compliance with proper unit handling
     */
    private checkCompliance(req: UniversalRequirement, actual: any): boolean {
        // Parse actual value if it's a string with units
        let actualNum = actual;
        if (typeof actual === 'string') {
            const match = actual.match(/[\d.,]+/);
            if (match) {
                actualNum = parseFloat(match[0].replace(',', '.'));
            }
        }

        // Parse requirement value
        let reqValue = req.value;
        let reqNum = parseFloat(String(reqValue).replace(',', '.'));

        if (req.normalized && req.normalized.value) {
            reqNum = req.normalized.value;
        }

        if (typeof actualNum === 'number' && !isNaN(reqNum)) {
            switch (req.operator) {
                case '>=': case '≥': case 'MINIMUM': case 'MÍNIMO': case 'AT LEAST':
                    return actualNum >= reqNum;
                case '<=': case '≤': case 'MAXIMUM': case 'MÁXIMO': case 'AT MOST':
                    return actualNum <= reqNum;
                case '>': case 'MORE THAN': case 'MAYOR QUE':
                    return actualNum > reqNum;
                case '<': case 'LESS THAN': case 'MENOR QUE':
                    return actualNum < reqNum;
                case '=': case '==':
                    return Math.abs(actualNum - reqNum) < 0.001;
                default:
                    // Default: exact match within tolerance
                    return Math.abs(actualNum - reqNum) < 0.001;
            }
        }

        // String comparison
        if (typeof actual === 'string' && typeof reqValue === 'string') {
            return actual.toLowerCase().includes(reqValue.toLowerCase());
        }

        return false;
    }

    /**
     * Determine severity based on deviation
     */
    private determineSeverity(req: UniversalRequirement, actual: any): 'CRITICAL' | 'WARNING' {
        // Parse values
        let actualNum = parseFloat(String(actual).replace(',', '.'));
        let reqNum = parseFloat(String(req.value).replace(',', '.'));

        if (isNaN(actualNum) || isNaN(reqNum)) return 'WARNING';

        // Calculate deviation percentage
        const deviation = Math.abs((actualNum - reqNum) / reqNum) * 100;

        // > 20% deviation is critical
        return deviation > 20 ? 'CRITICAL' : 'WARNING';
    }

    /**
     * Format user-friendly description
     */
    private formatDescription(req: UniversalRequirement, actual: any, propKey: string): string {
        return `${propKey} - Required: ${req.operator} ${req.value}, Found: ${actual}`;
    }

    /**
     * Group incidents by element category for UI
     */
    groupByCategory(incidents: Incident[]): GroupedIncidents[] {
        const groups: Record<string, Incident[]> = {};

        for (const incident of incidents) {
            const cat = incident.elementCategory || 'Other';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(incident);
        }

        return Object.entries(groups)
            .map(([category, items]) => ({
                category,
                count: items.length,
                incidents: items
            }))
            .sort((a, b) => b.count - a.count);
    }
}

/**
 * Discipline Detector Service
 * 
 * Detects the specialty/discipline of a document based on:
 * - Filename patterns
 * - Content keywords
 * - Document structure
 */

export type Discipline = 'ELECTRICAL' | 'STRUCTURAL' | 'MEP' | 'ARCHITECTURAL' | 'GENERAL';

export interface DisciplineResult {
    discipline: Discipline;
    confidence: number;
    indicators: string[];
}

export class DisciplineDetectorService {
    // Filename patterns by discipline
    private readonly FILENAME_PATTERNS: Record<Discipline, RegExp[]> = {
        ELECTRICAL: [
            /elec|elect|elé?ctric/i,
            /ilu(m)?/i,           // Iluminación
            /baja[_\s]?tensión|bt/i,
            /alta[_\s]?tensión|at/i,
            /cable|conduit|bandeja/i,
            /-e-|-el-|-elu-/i     // Code patterns
        ],
        STRUCTURAL: [
            /estruct|struct/i,
            /hormigón|concrete|horm/i,
            /acero|steel/i,
            /ciment|foundation/i,
            /-s-|-st-|-str-/i
        ],
        MEP: [
            /mep|hvac|clima/i,
            /mecán|mechan/i,
            /plom|plumb|sanit/i,
            /duct|tuber/i,
            /-m-|-mep-/i
        ],
        ARCHITECTURAL: [
            /arq(u)?|arch/i,
            /fachada|facade/i,
            /acabado|finish/i,
            /distrib|layout/i,
            /-a-|-arq-/i
        ],
        GENERAL: []
    };

    // Content keywords by discipline (Spanish + English)
    private readonly CONTENT_KEYWORDS: Record<Discipline, string[]> = {
        ELECTRICAL: [
            'voltaje', 'voltage', 'tensión',
            'corriente', 'current', 'ampere', 'amp',
            'cable', 'conductor', 'wire',
            'bandeja', 'cable tray', 'tray',
            'conduit', 'tubo', 'emt', 'imc',
            'tablero', 'panel', 'switchboard',
            'iluminación', 'lighting', 'luminaria',
            'tomacorriente', 'outlet', 'receptacle',
            'interruptor', 'switch', 'breaker',
            'transformador', 'transformer',
            'puesta a tierra', 'grounding', 'ground',
            'circuito', 'circuit'
        ],
        STRUCTURAL: [
            'hormigón', 'concrete', 'concreto',
            'acero', 'steel', 'rebar', 'armadura',
            'columna', 'column', 'pilar',
            'viga', 'beam', 'joist',
            'losa', 'slab', 'floor',
            'cimentación', 'foundation', 'zapata',
            'muro', 'wall', 'shear wall',
            'resistencia', 'strength', "f'c",
            'refuerzo', 'reinforcement',
            'encofrado', 'formwork'
        ],
        MEP: [
            'hvac', 'climatización', 'aire acondicionado',
            'ducto', 'duct', 'damper',
            'tubería', 'pipe', 'piping',
            'sanitario', 'sanitary', 'plumbing',
            'bomba', 'pump', 'válvula', 'valve',
            'calefacción', 'heating', 'cooling',
            'ventilación', 'ventilation', 'fan',
            'chiller', 'caldera', 'boiler',
            'drenaje', 'drainage', 'alcantarillado'
        ],
        ARCHITECTURAL: [
            'fachada', 'facade', 'curtain wall',
            'acabado', 'finish', 'revestimiento',
            'puerta', 'door', 'ventana', 'window',
            'techo', 'roof', 'ceiling', 'cielo',
            'piso', 'floor', 'pavimento',
            'escalera', 'stair', 'rampa', 'ramp',
            'baño', 'bathroom', 'cocina', 'kitchen',
            'mobiliario', 'furniture', 'casework',
            'pintura', 'paint', 'color'
        ],
        GENERAL: []
    };

    /**
     * Detect discipline from filename
     */
    detectFromFilename(filename: string): DisciplineResult {
        const indicators: string[] = [];
        let bestMatch: Discipline = 'GENERAL';
        let bestScore = 0;

        for (const [discipline, patterns] of Object.entries(this.FILENAME_PATTERNS) as [Discipline, RegExp[]][]) {
            if (discipline === 'GENERAL') continue;

            let score = 0;
            for (const pattern of patterns) {
                if (pattern.test(filename)) {
                    score++;
                    indicators.push(`Filename matches ${discipline} pattern: ${pattern.source}`);
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = discipline;
            }
        }

        return {
            discipline: bestMatch,
            confidence: bestScore > 0 ? Math.min(0.5 + (bestScore * 0.15), 0.95) : 0.2,
            indicators
        };
    }

    /**
     * Detect discipline from document content
     */
    detectFromContent(text: string): DisciplineResult {
        const indicators: string[] = [];
        const scores: Record<Discipline, number> = {
            ELECTRICAL: 0,
            STRUCTURAL: 0,
            MEP: 0,
            ARCHITECTURAL: 0,
            GENERAL: 0
        };

        const normalizedText = text.toLowerCase();
        const words = normalizedText.split(/\s+/);
        const wordSet = new Set(words);

        for (const [discipline, keywords] of Object.entries(this.CONTENT_KEYWORDS) as [Discipline, string[]][]) {
            for (const keyword of keywords) {
                // Check for presence
                if (normalizedText.includes(keyword.toLowerCase())) {
                    scores[discipline]++;

                    // Count occurrences for stronger signal
                    const regex = new RegExp(keyword.toLowerCase(), 'gi');
                    const matches = normalizedText.match(regex);
                    if (matches && matches.length > 3) {
                        scores[discipline] += Math.min(matches.length / 5, 2);
                        indicators.push(`Found "${keyword}" ${matches.length} times`);
                    }
                }
            }
        }

        // Find winner
        let bestDiscipline: Discipline = 'GENERAL';
        let bestScore = 0;

        for (const [discipline, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestDiscipline = discipline as Discipline;
            }
        }

        // Calculate confidence based on score differential
        const sortedScores = Object.values(scores).sort((a, b) => b - a);
        const scoreDiff = sortedScores[0] - sortedScores[1];
        const confidence = Math.min(0.4 + (scoreDiff * 0.05) + (bestScore * 0.02), 0.95);

        return {
            discipline: bestDiscipline,
            confidence,
            indicators: indicators.slice(0, 5) // Top 5 indicators
        };
    }

    /**
     * Combined detection using both filename and content
     */
    detect(filename: string, content: string): DisciplineResult {
        const fromFilename = this.detectFromFilename(filename);
        const fromContent = this.detectFromContent(content);

        // If both agree, high confidence
        if (fromFilename.discipline === fromContent.discipline && fromFilename.discipline !== 'GENERAL') {
            return {
                discipline: fromFilename.discipline,
                confidence: Math.min(fromFilename.confidence + fromContent.confidence, 0.98),
                indicators: [...fromFilename.indicators, ...fromContent.indicators]
            };
        }

        // Prefer content analysis when confident
        if (fromContent.confidence > fromFilename.confidence + 0.2) {
            return fromContent;
        }

        // Prefer filename when content is unclear
        if (fromFilename.confidence > 0.5) {
            return fromFilename;
        }

        return fromContent;
    }

    /**
     * Get equipment categories relevant to a discipline
     */
    getRelevantCategories(discipline: Discipline): string[] {
        const categories: Record<Discipline, string[]> = {
            ELECTRICAL: [
                'Cable Trays', 'Cable Tray Fittings',
                'Conduits', 'Conduit Fittings',
                'Electrical Equipment', 'Electrical Fixtures',
                'Lighting Fixtures', 'Lighting Devices',
                'Communication Devices', 'Data Devices',
                'Electrical Panels', 'Switchboards',
                'Wire', 'Cables'
            ],
            STRUCTURAL: [
                'Structural Columns', 'Structural Framing',
                'Structural Foundations', 'Floors',
                'Walls', 'Structural Walls',
                'Rebar', 'Structural Connections'
            ],
            MEP: [
                'Ducts', 'Duct Fittings', 'Duct Accessories',
                'Pipes', 'Pipe Fittings', 'Pipe Accessories',
                'Mechanical Equipment', 'Plumbing Fixtures',
                'Sprinklers', 'Air Terminals'
            ],
            ARCHITECTURAL: [
                'Doors', 'Windows', 'Curtain Panels',
                'Roofs', 'Ceilings', 'Floors',
                'Stairs', 'Railings', 'Ramps',
                'Casework', 'Furniture', 'Planting'
            ],
            GENERAL: []
        };

        return categories[discipline] || [];
    }
}

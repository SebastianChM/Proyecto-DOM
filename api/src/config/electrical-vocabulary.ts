/**
 * Vocabulario Técnico Eléctrico
 * 
 * Diccionario de términos del dominio eléctrico para especificaciones técnicas.
 * Utilizado por el lexer para identificar parámetros en documentos ET.
 * Soporta terminología chilena/española e inglés técnico.
 */

export const ELECTRICAL_VOCABULARY = {
    // Tipos de equipos eléctricos según nomenclatura BIM/Revit
    equipment: {
        english: [
            'cable tray', 'cable tray fitting', 'tray',
            'conduit', 'conduit fitting', 'emt', 'imc', 'pvc conduit',
            'wire', 'cable', 'conductor',
            'panel', 'panelboard', 'switchboard', 'switchgear',
            'transformer', 'generator',
            'lighting fixture', 'luminaire', 'lamp',
            'outlet', 'receptacle', 'socket',
            'switch', 'breaker', 'circuit breaker', 'fuse',
            'junction box', 'pull box', 'outlet box',
            'busway', 'busduct', 'bus duct',
            'grounding', 'ground rod', 'ground wire'
        ],
        spanish: [
            'bandeja', 'bandeja portacables', 'escalerilla',
            'tubo', 'tubería eléctrica', 'conduit', 'emt',
            'cable', 'conductor', 'alambre',
            'tablero', 'cuadro eléctrico', 'gabinete',
            'transformador', 'generador',
            'luminaria', 'lámpara', 'artefacto',
            'tomacorriente', 'enchufe', 'toma',
            'interruptor', 'breaker', 'fusible',
            'caja de paso', 'caja de conexiones',
            'barra', 'busbar',
            'puesta a tierra', 'electrodo', 'malla de tierra'
        ]
    },

    // Parámetros técnicos extraídos de ETs
    parameters: {
        dimensions: {
            english: ['width', 'height', 'depth', 'length', 'diameter', 'size', 'gauge', 'awg'],
            spanish: ['ancho', 'alto', 'profundidad', 'largo', 'longitud', 'diámetro', 'calibre'],
            aliases: {
                'w': 'width',
                'h': 'height',
                'd': 'depth',
                'l': 'length',
                'dia': 'diameter',
                'ø': 'diameter'
            }
        },
        electrical: {
            english: ['voltage', 'current', 'power', 'frequency', 'phase', 'capacity', 'load', 'ampacity'],
            spanish: ['voltaje', 'tensión', 'corriente', 'potencia', 'frecuencia', 'fase', 'capacidad', 'carga', 'amperaje'],
            aliases: {
                'v': 'voltage',
                'a': 'current',
                'amp': 'current',
                'amps': 'current',
                'w': 'power',
                'kw': 'power',
                'hz': 'frequency',
                'kva': 'capacity',
                'mva': 'capacity'
            }
        },
        material: {
            english: ['material', 'finish', 'coating', 'insulation', 'type'],
            spanish: ['material', 'acabado', 'recubrimiento', 'aislamiento', 'tipo']
        }
    },

    // Factores de conversión a unidades base
    units: {
        length: {
            'mm': 1,
            'cm': 10,
            'm': 1000,
            'in': 25.4,
            '"': 25.4,
            'ft': 304.8,
            "'": 304.8
        },
        electrical: {
            'v': 1,
            'kv': 1000,
            'mv': 0.001,
            'a': 1,
            'ma': 0.001,
            'ka': 1000,
            'w': 1,
            'kw': 1000,
            'mw': 1000000,
            'va': 1,
            'kva': 1000,
            'mva': 1000000,
            'hz': 1,
            'khz': 1000
        },
        area: {
            'mm²': 1,
            'mm2': 1,
            'cm²': 100,
            'cm2': 100,
            'm²': 1000000,
            'm2': 1000000
        }
    },

    // Tabla de conversión AWG a mm² (estándar NEMA)
    awgToMm2: {
        '18': 0.823,
        '16': 1.31,
        '14': 2.08,
        '12': 3.31,
        '10': 5.26,
        '8': 8.37,
        '6': 13.3,
        '4': 21.2,
        '3': 26.7,
        '2': 33.6,
        '1': 42.4,
        '1/0': 53.5,
        '2/0': 67.4,
        '3/0': 85.0,
        '4/0': 107.2,
        '250': 127,
        '300': 152,
        '350': 177,
        '400': 203,
        '500': 253
    },

    // Operadores de comparación en documentos ET
    operators: {
        comparison: ['>=', '<=', '>', '<', '=', '≥', '≤', '≠'],
        textual: {
            english: ['minimum', 'maximum', 'at least', 'no more than', 'equal to', 'between'],
            spanish: ['mínimo', 'máximo', 'al menos', 'no mayor que', 'igual a', 'entre']
        }
    },

    // Verbos modales que indican obligatoriedad en normas técnicas
    modals: {
        mandatory: {
            english: ['shall', 'must', 'required', 'mandatory', 'will'],
            spanish: ['debe', 'deberá', 'obligatorio', 'requerido', 'será']
        },
        recommended: {
            english: ['should', 'recommended', 'preferred'],
            spanish: ['debería', 'recomendado', 'preferible']
        },
        optional: {
            english: ['may', 'can', 'optional'],
            spanish: ['puede', 'podrá', 'opcional']
        }
    },

    // Mapeo de términos a categorías de Revit
    revitCategories: {
        'cable tray': 'Cable Trays',
        'bandeja': 'Cable Trays',
        'bandeja portacables': 'Cable Trays',
        'escalerilla': 'Cable Trays',
        'cable tray fitting': 'Cable Tray Fittings',
        'conduit': 'Conduits',
        'tubo': 'Conduits',
        'tubería eléctrica': 'Conduits',
        'conduit fitting': 'Conduit Fittings',
        'luminaire': 'Lighting Fixtures',
        'luminaria': 'Lighting Fixtures',
        'lámpara': 'Lighting Fixtures',
        'panel': 'Electrical Equipment',
        'panelboard': 'Electrical Equipment',
        'tablero': 'Electrical Equipment',
        'cuadro eléctrico': 'Electrical Equipment',
        'transformer': 'Electrical Equipment',
        'transformador': 'Electrical Equipment',
        'generator': 'Electrical Equipment',
        'generador': 'Electrical Equipment',
        'outlet': 'Electrical Fixtures',
        'receptacle': 'Electrical Fixtures',
        'tomacorriente': 'Electrical Fixtures',
        'enchufe': 'Electrical Fixtures',
        'switch': 'Lighting Devices',
        'interruptor': 'Lighting Devices',
        'breaker': 'Electrical Equipment',
        'circuit breaker': 'Electrical Equipment'
    }
};

/** Obtiene todos los términos de equipos (EN + ES) */
export function getAllEquipmentTerms(): string[] {
    return [
        ...ELECTRICAL_VOCABULARY.equipment.english,
        ...ELECTRICAL_VOCABULARY.equipment.spanish
    ];
}

/** Obtiene todos los términos de parámetros técnicos */
export function getAllParameterTerms(): string[] {
    const params = ELECTRICAL_VOCABULARY.parameters;
    return [
        ...params.dimensions.english,
        ...params.dimensions.spanish,
        ...params.electrical.english,
        ...params.electrical.spanish,
        ...params.material.english,
        ...params.material.spanish
    ];
}

/** Normaliza un nombre de parámetro a su forma canónica en inglés */
export function normalizeParameter(param: string): string {
    const p = param.toLowerCase().trim();

    // Verificar aliases de dimensiones
    const dimAliases = ELECTRICAL_VOCABULARY.parameters.dimensions.aliases;
    if (dimAliases[p as keyof typeof dimAliases]) {
        return dimAliases[p as keyof typeof dimAliases];
    }

    // Verificar aliases eléctricos
    const elecAliases = ELECTRICAL_VOCABULARY.parameters.electrical.aliases;
    if (elecAliases[p as keyof typeof elecAliases]) {
        return elecAliases[p as keyof typeof elecAliases];
    }

    // Traducciones español → inglés
    const translations: Record<string, string> = {
        'ancho': 'width',
        'alto': 'height',
        'profundidad': 'depth',
        'largo': 'length',
        'longitud': 'length',
        'diámetro': 'diameter',
        'calibre': 'gauge',
        'voltaje': 'voltage',
        'tensión': 'voltage',
        'corriente': 'current',
        'amperaje': 'current',
        'potencia': 'power',
        'frecuencia': 'frequency',
        'fase': 'phase',
        'capacidad': 'capacity',
        'carga': 'load'
    };

    return translations[p] || p;
}

/** Convierte calibre AWG a mm² */
export function awgToMm2(awg: string): number | null {
    const table = ELECTRICAL_VOCABULARY.awgToMm2;
    return table[awg as keyof typeof table] || null;
}

/** Obtiene la categoría de Revit correspondiente a un equipo */
export function getRevitCategory(equipment: string): string | null {
    const e = equipment.toLowerCase().trim();
    const categories = ELECTRICAL_VOCABULARY.revitCategories;
    return categories[e as keyof typeof categories] || null;
}

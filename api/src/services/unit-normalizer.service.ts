
export interface NormalizedValue {
    original: string;
    numericValue: number;
    unit: string; // 'mm', 'cm', 'm', 'kg', 'MPa'
    standardValue: number; // Converted to SI (m, Pa, kg)
    standardUnit: string;  // 'm', 'Pa', 'kg'
}

export class UnitNormalizerService {

    // Supported units map
    private unitMap: Record<string, string> = {
        'mm': 'm',
        'cm': 'm',
        'm': 'm',
        'km': 'm',
        'g': 'kg',
        'kg': 'kg',
        'ton': 'kg',
        'MPa': 'Pa',
        'psi': 'Pa',
        'bar': 'Pa'
    };

    normalize(text: string): NormalizedValue | null {
        // Cleaning
        const cleanText = text.trim().replace(/,/, '.'); // Handle "0,5" -> "0.5"

        // Regex: Number + Unit (e.g. "20 mm", "4.5kg")
        const regex = /^([0-9\.]+)\s*([A-Za-z]+)$/;
        const match = cleanText.match(regex);

        if (!match) return null;

        const val = parseFloat(match[1]);
        const unit = match[2];
        const standardUnit = this.unitMap[unit];

        if (!standardUnit) return null; // Unknown unit

        return {
            original: text,
            numericValue: val,
            unit: unit,
            standardValue: this.convertToStandard(val, unit),
            standardUnit: standardUnit
        };
    }

    private convertToStandard(val: number, unit: string): number {
        switch (unit) {
            case 'mm': return val / 1000;
            case 'cm': return val / 100;
            case 'm': return val;
            case 'km': return val * 1000;
            case 'g': return val / 1000;
            case 'kg': return val;
            case 'ton': return val * 1000;
            case 'MPa': return val * 1000000;
            case 'bar': return val * 100000;
            case 'psi': return val * 6894.76;
            default: return val;
        }
    }
}

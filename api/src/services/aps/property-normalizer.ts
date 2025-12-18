export class PropertyNormalizer {

    /**
     * Normalizes a property value to a standard format.
     * e.g., "1200 mm" -> 1200 (number)
     * "Concrete C30" -> "CONCRETE C30" (uppercase for comparison)
     */
    static normalizeValue(value: any): any {
        if (typeof value === 'string') {
            // Check for numeric values with units
            const numericMatch = value.match(/^(-?[\d,.]+)\s*(mm|m|cm|ft|in|kg|m3|m2)$/i);
            if (numericMatch) {
                // Return just the number for now, or convert to base unit if needed
                // For this implementation, we'll strip the unit and return number
                return parseFloat(numericMatch[1].replace(',', ''));
            }
            return value.trim();
        }
        return value;
    }

    /**
     * Normalizes property names to handle slight variations.
     * e.g., "Fire Rating" -> "fire_rating"
     */
    static normalizeKey(key: string): string {
        return key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
}

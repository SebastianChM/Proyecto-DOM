import { unitConversionService } from "./dictionary/unit-conversion.service";
import { logger } from "../lib/logger";

export interface NormalizedValue {
  original: string;
  numericValue: number;
  unit: string; // 'mm', 'cm', 'm', 'kg', 'MPa'
  standardValue: number; // Converted to SI (m, Pa, kg)
  standardUnit: string; // 'm', 'Pa', 'kg'
}

export interface IUnitNormalizerService {
  normalize(text: string): Promise<NormalizedValue | null>;
}

export class UnitNormalizerService implements IUnitNormalizerService {
  async normalize(text: string): Promise<NormalizedValue | null> {
    // Cleaning
    const cleanText = text.trim().replace(/,/, "."); // Handle "0,5" -> "0.5"

    // Regex: Number + Unit (e.g. "20 mm", "4.5kg")
    const regex = /^([0-9.]+)\s*([A-Za-z]+)$/;
    const match = cleanText.match(regex);

    if (!match) return null;

    const val = parseFloat(match[1]);
    const unit = match[2];

    try {
      const result = await unitConversionService.normalize(val, unit);
      return {
        original: text,
        numericValue: val,
        unit: unit,
        standardValue: result.value,
        standardUnit: result.unit,
      };
    } catch (error) {
      logger.warn("[UnitNormalizer] Could not normalize", { text, unit, error });
      return null;
    }
  }
}

/**
 * Dictionary service types for Compliance Engine V3
 */

export interface PropertyEntry {
  id: string;
  canonicalName: string;
  locale: string;
  displayName: string;
  aliases: string[];
  revitPropertyPath: string | null;
  ifcPropertyPath: string | null;
  unit: string | null;
  dataType: string;
}

export interface CategoryEntry {
  id: string;
  canonicalName: string;
  locale: string;
  displayName: string;
  aliases: string[];
  revitCategory: string;
  ifcEntity: string | null;
  discipline: string | null;
}

export interface NormalizedValue {
  value: number;
  unit: string;
  originalUnit: string;
}

export interface IPropertyDictionaryService {
  resolve(rawName: string, locale: string): Promise<PropertyEntry | null>;
  getByCanonical(canonicalName: string, locale: string): Promise<PropertyEntry>;
  getAll(locale: string): Promise<PropertyEntry[]>;
}

export interface ICategoryDictionaryService {
  resolve(rawCategory: string, locale: string): Promise<CategoryEntry | null>;
  getAll(locale: string): Promise<CategoryEntry[]>;
}

export interface IUnitConversionService {
  convert(value: number, fromUnit: string, toUnit: string): Promise<number>;
  normalize(value: number, unit: string): Promise<NormalizedValue>;
}

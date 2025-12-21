export interface PropertyChange {
  category?: string;
  name: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DiffItem {
  id: number; // dbId (Autodesk Viewer ID)
  externalId?: string; // Stable ID if available
  name: string;
  categoryId?: number;
  categoryName?: string;
  changes?: PropertyChange[];
}

export interface DiffResult {
  baseUrn: string;
  targetUrn: string;
  timestamp: Date;
  summary: {
    added: number;
    removed: number;
    modified: number;
    identical: number;
  };
  details: {
    added: DiffItem[];
    removed: DiffItem[];
    modified: DiffItem[];
  };
}

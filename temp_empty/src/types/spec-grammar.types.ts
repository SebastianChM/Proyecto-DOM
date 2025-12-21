export enum GrammarType {
  KEY_VALUE_PAIR = "KEY_VALUE", // "Strength: 30MPa"
  NARRATIVE = "NARRATIVE", // "The concrete shall have a strength of 30MPa"
  LIST_ITEM = "LIST", // "1. Strength 30MPa"
  TABULAR = "TABLE", // Detected from grid alignment
}

// --- COMPILER TYPES ---

export enum TokenType {
  SECTION_HEADER = "SECTION_HEADER", // "1.1", "2.3.4"
  KEYWORD_ENTITY = "KEYWORD_ENTITY", // "Concrete", "Wall", "Beam"
  KEYWORD_MODAL = "KEYWORD_MODAL", // "Shall", "Must", "Should"
  KEYWORD_PARAM = "KEYWORD_PARAM", // "Thickness", "Strength", "Grade"
  OPERATOR = "OPERATOR", // ">", "=", "at least"
  NUMERIC = "NUMERIC", // "30", "2.5"
  UNIT = "UNIT", // "MPa", "mm", "kg"
  PUNCTUATION = "PUNCTUATION", // ":", ".", ","
  TEXT = "TEXT", // Generic text
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  position: number; // Index in string
  line?: number;
}

export enum ASTNodeType {
  ROOT = "ROOT",
  REQUIREMENT = "REQUIREMENT",
  CONDITION = "CONDITION", // "If exposed to weather..."
  ENTITY = "ENTITY", // "Concrete"
  CONSTRAINT = "CONSTRAINT", // "strength > 30MPa"
}

export interface ASTNode {
  type: ASTNodeType;
  children: ASTNode[];
  value?: unknown;
  tokens?: Token[]; // Traceability
}

// --- END COMPILER TYPES ---

export interface UniversalRequirement {
  id: string; // UUID for tracking
  sourceLine: number; // Line number in original text
  page?: number; // PDF Page number
  originalText: string; // "Concrete strength shall be 30MPa"
  grammarType: GrammarType;

  // Extracted Data
  parameter: string; // "Strength"
  operator: string; // "SHALL BE", ">=", "="
  value: string; // "30MPa"

  // Normalization (Added)
  normalized?: {
    value: number;
    unit: string;
  };

  // Context
  derivedCategory?: string; // "Concrete" (Inferred from section)
  section?: string; // "1.1"
  source?: string; // "Spec"
  confidence: number; // 0.0 - 1.0 (How sure is the heuristic?)
}

export interface ExtractionResult {
  totalLinesProcessed: number;
  requirements: UniversalRequirement[];
  parseDurationMs: number;
}

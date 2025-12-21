import { Token, TokenType } from "../../types/spec-grammar.types";
import { normalizeParameter } from "../../config/electrical-vocabulary";

export class LexerService {
  private pos = 0;
  private input = "";

  // Modal keywords (English + Spanish)
  private readonly KEYWORDS_MODAL = [
    "SHALL",
    "MUST",
    "SHOULD",
    "REQUIRED",
    "REQUIRES",
    "WILL",
    "DEBE",
    "DEBERÁ",
    "DEBERA",
    "OBLIGATORIO",
    "REQUERIDO",
    "SERÁ",
    "SERA",
  ];

  // Entity keywords (English + Spanish, includes electrical equipment)
  private readonly KEYWORDS_ENTITY = [
    // Structural
    "CONCRETE",
    "STEEL",
    "WALL",
    "COLUMN",
    "BEAM",
    "SLAB",
    "REBAR",
    "CEMENT",
    "HORMIGÓN",
    "HORMIGON",
    "ACERO",
    "MURO",
    "COLUMNA",
    "VIGA",
    "LOSA",
    // Electrical
    "CABLE",
    "CONDUCTOR",
    "WIRE",
    "TRAY",
    "BANDEJA",
    "CONDUIT",
    "TUBO",
    "PANEL",
    "TABLERO",
    "TRANSFORMER",
    "TRANSFORMADOR",
    "LUMINAIRE",
    "LUMINARIA",
    "OUTLET",
    "TOMACORRIENTE",
    "SWITCH",
    "INTERRUPTOR",
    "BREAKER",
    "LIGHTING",
    "ILUMINACIÓN",
    "ILUMINACION",
  ];

  // Parameter keywords (English + Spanish)
  private readonly KEYWORDS_PARAM = [
    // Dimensions
    "STRENGTH",
    "THICKNESS",
    "WIDTH",
    "HEIGHT",
    "DEPTH",
    "LENGTH",
    "DIAMETER",
    "SIZE",
    "GAUGE",
    "RESISTENCIA",
    "ESPESOR",
    "ANCHO",
    "ALTO",
    "ALTURA",
    "PROFUNDIDAD",
    "LARGO",
    "LONGITUD",
    "DIÁMETRO",
    "DIAMETRO",
    "CALIBRE",
    // Electrical
    "VOLTAGE",
    "CURRENT",
    "POWER",
    "FREQUENCY",
    "PHASE",
    "AMPACITY",
    "CAPACITY",
    "LOAD",
    "VOLTAJE",
    "TENSIÓN",
    "TENSION",
    "CORRIENTE",
    "POTENCIA",
    "FRECUENCIA",
    "FASE",
    "AMPERAJE",
    "CAPACIDAD",
    "CARGA",
    // General
    "GRADE",
    "CLASS",
    "SPACING",
    "TYPE",
    "MATERIAL",
    "GRADO",
    "CLASE",
    "ESPACIAMIENTO",
    "TIPO",
  ];

  // Operators (English + Spanish)
  private readonly OPERATORS = [
    ">=",
    "<=",
    ">",
    "<",
    "=",
    "≥",
    "≤",
    "AT LEAST",
    "AT MOST",
    "MINIMUM",
    "MAXIMUM",
    "EXCEED",
    "LESS THAN",
    "MORE THAN",
    "MÍNIMO",
    "MINIMO",
    "MÁXIMO",
    "MAXIMO",
    "AL MENOS",
    "NO MAYOR",
    "NO MENOR",
    "MAYOR QUE",
    "MENOR QUE",
  ];

  // Units (with proper recognition)
  private readonly UNITS = [
    // Length
    "MM",
    "CM",
    "M",
    "IN",
    "FT",
    // Pressure/Strength
    "MPA",
    "PSI",
    "KPA",
    // Electrical
    "V",
    "KV",
    "MV",
    "A",
    "MA",
    "KA",
    "W",
    "KW",
    "MW",
    "VA",
    "KVA",
    "MVA",
    "HZ",
    "KHZ",
    // Area
    "MM2",
    "CM2",
    "M2",
    "MM²",
    "CM²",
    "M²",
    "AWG",
    "MCM",
    // Other
    "KG",
    "LBS",
    "%",
    "DEGREE",
    "GRADO",
  ];

  public tokenize(input: string): Token[] {
    this.input = input;
    this.pos = 0;
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      // Skip whitespace
      if (/\s/.test(char)) {
        this.pos++;
        continue;
      }

      // 1. Numbers (including decimals with comma or dot)
      if (/[0-9]/.test(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      // 2. Multi-char operators
      const opToken = this.tryReadOperator();
      if (opToken) {
        tokens.push(opToken);
        continue;
      }

      // 3. Punctuation
      if (/[;:.,()]/.test(char)) {
        tokens.push({
          type: TokenType.PUNCTUATION,
          value: char,
          position: this.pos++,
        });
        continue;
      }

      // 4. Words (Entities, Modals, Params, Units)
      if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(char)) {
        tokens.push(this.readWord());
        continue;
      }

      // 5. Special characters (≥, ≤, ², ³, etc.)
      if (/[≥≤²³°%]/.test(char)) {
        if (char === "≥") {
          tokens.push({
            type: TokenType.OPERATOR,
            value: ">=",
            position: this.pos++,
          });
        } else if (char === "≤") {
          tokens.push({
            type: TokenType.OPERATOR,
            value: "<=",
            position: this.pos++,
          });
        } else {
          tokens.push({
            type: TokenType.TEXT,
            value: char,
            position: this.pos++,
          });
        }
        continue;
      }

      // 6. Unknown - skip
      this.pos++;
    }

    tokens.push({ type: TokenType.EOF, value: "", position: this.pos });
    return tokens;
  }

  private readNumber(): Token {
    const start = this.pos;
    // Handle numbers with comma or dot as decimal separator
    while (
      this.pos < this.input.length &&
      /[0-9.,]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    let value = this.input.substring(start, this.pos);
    // Normalize comma to dot for decimals
    value = value.replace(",", ".");
    // Remove trailing dots/commas
    value = value.replace(/[.,]$/, "");
    return { type: TokenType.NUMERIC, value, position: start };
  }

  private tryReadOperator(): Token | null {
    const remaining = this.input.substring(this.pos).toUpperCase();

    // Sort operators by length (longest first) to match correctly
    const sortedOps = [...this.OPERATORS].sort((a, b) => b.length - a.length);

    for (const op of sortedOps) {
      if (remaining.startsWith(op)) {
        // Make sure it's a word boundary for text operators
        if (op.length > 2 && /[A-Z]/.test(op[0])) {
          const nextChar = this.input[this.pos + op.length] || " ";
          if (/[a-zA-Z]/.test(nextChar)) continue; // Not a word boundary
        }
        const token = {
          type: TokenType.OPERATOR,
          value: op,
          position: this.pos,
        };
        this.pos += op.length;
        return token;
      }
    }
    return null;
  }

  private readWord(): Token {
    const start = this.pos;
    // Include accented characters and allow alphanumeric
    while (
      this.pos < this.input.length &&
      /[a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ]/.test(this.input[this.pos])
    ) {
      this.pos++;
    }
    const value = this.input.substring(start, this.pos);
    const upper = value.toUpperCase();

    // Check token types in order of specificity
    if (this.KEYWORDS_MODAL.includes(upper)) {
      return { type: TokenType.KEYWORD_MODAL, value, position: start };
    }
    if (this.KEYWORDS_PARAM.includes(upper)) {
      return {
        type: TokenType.KEYWORD_PARAM,
        value: normalizeParameter(value),
        position: start,
      };
    }
    if (this.KEYWORDS_ENTITY.includes(upper)) {
      return { type: TokenType.KEYWORD_ENTITY, value, position: start };
    }
    if (this.UNITS.includes(upper)) {
      return { type: TokenType.UNIT, value: upper, position: start };
    }

    return { type: TokenType.TEXT, value, position: start };
  }
}

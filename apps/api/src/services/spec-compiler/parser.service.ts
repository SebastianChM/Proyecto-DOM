import {
  Token,
  TokenType,
  ASTNode,
  ASTNodeType,
  UniversalRequirement,
  GrammarType,
} from "../../types/spec-grammar.types";

export class ParserService {
  public parse(tokens: Token[]): ASTNode | null {
    // Simple Recursive Descent Strategy (or Pattern Matching for now)

    // Pattern 1: Explicit Requirement
    // [PARAM/ENTITY] + [OP] + [NUM] + [UNIT]?
    const explicitNode = this.matchExplicit(tokens);
    if (explicitNode) return explicitNode;

    // Pattern 2: Key-Value (Colon)
    // [PARAM] + [:] + [VALUE]
    // This is often handled by the Lexer as Text: Text, but if Lexer sees punctuation...

    return null; // Reject if no pattern matches
  }

  private matchExplicit(tokens: Token[]): ASTNode | null {
    // 1. Locate Operator or Modal
    const opIndex = tokens.findIndex((t) => t.type === TokenType.OPERATOR);
    const modalIndex = tokens.findIndex(
      (t) => t.type === TokenType.KEYWORD_MODAL,
    );
    const pivotIndex = opIndex !== -1 ? opIndex : modalIndex;

    if (pivotIndex === -1) {
      // No operator or modal? Maybe it's just "Value Unit" (Contextual)
      // e.g. "30 MPa"
      if (this.isValueUnitOnly(tokens)) {
        return this.createNode(ASTNodeType.CONSTRAINT, tokens);
      }
      return null; // No verb/pivot, likely noise
    }

    // 2. Check LHS (Subject)
    const lhsTokens = tokens.slice(0, pivotIndex);
    const hasEntityOrParam = lhsTokens.some(
      (t) =>
        t.type === TokenType.KEYWORD_ENTITY ||
        t.type === TokenType.KEYWORD_PARAM,
    );

    // 3. Check RHS (Value)
    const rhsTokens = tokens.slice(pivotIndex + 1);
    const hasNumber = rhsTokens.some((t) => t.type === TokenType.NUMERIC);

    // Strict Rule: Must have a TECHNICAL Keyword on LHS, OR a valid Number on RHS
    if (!hasEntityOrParam && !hasNumber) {
      return null;
    }

    return this.createNode(ASTNodeType.REQUIREMENT, tokens);
  }

  private isValueUnitOnly(tokens: Token[]): boolean {
    // e.g. "30 MPa"
    // Must have Number AND Unit, and very little else.
    const numCount = tokens.filter((t) => t.type === TokenType.NUMERIC).length;
    const unitCount = tokens.filter((t) => t.type === TokenType.UNIT).length;
    const textCount = tokens.filter((t) => t.type === TokenType.TEXT).length;

    // Valid if: 1 Number, >=1 Unit, and minimal noise (<= 1 word e.g. "at")
    return numCount === 1 && unitCount >= 1 && textCount <= 1;
  }

  private createNode(type: ASTNodeType, tokens: Token[]): ASTNode {
    return {
      type,
      children: [],
      tokens,
      value: tokens.map((t) => t.value).join(" "),
    };
  }

  // Helper to convert AST to UniversalRequirement
  public compileToRequirement(
    node: ASTNode,
    originalText: string,
    page: number,
  ): UniversalRequirement {
    // Logic to extraction parameter/value from Tokens
    const tokens = node.tokens || [];

    const op =
      tokens.find((t) => t.type === TokenType.OPERATOR)?.value || "MUST";
    const valToken = tokens.find((t) => t.type === TokenType.NUMERIC);
    const unitToken = tokens.find((t) => t.type === TokenType.UNIT);
    const paramToken = tokens.find(
      (t) =>
        t.type === TokenType.KEYWORD_PARAM ||
        t.type === TokenType.KEYWORD_ENTITY,
    );

    const valueStr = (valToken?.value || "") + " " + (unitToken?.value || "");

    return {
      id: crypto.randomUUID(),
      sourceLine: page, // simplified
      page: page, // Explicitly pass page for frontend highlighting
      originalText: originalText,
      grammarType: GrammarType.NARRATIVE,
      parameter: paramToken?.value || "Generic Constraint",
      operator: op,
      value: valueStr.trim() || "Exists",
      confidence: 0.95,
    };
  }
}

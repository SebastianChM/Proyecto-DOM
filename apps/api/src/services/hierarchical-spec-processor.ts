import { StructuredNode } from "./hierarchical-parser.service";
import { LexerService } from "./spec-compiler/lexer.service";
import { ParserService } from "./spec-compiler/parser.service";
import { inferCategory } from "../utils/category-inferer";
import { logger } from "../lib/logger";

export class HierarchicalSpecProcessor {
  private lexer: LexerService;
  private parser: ParserService;

  constructor() {
    this.lexer = new LexerService();
    this.parser = new ParserService();
  }

  /**
   * Flattens the Tree back into requirements, but with inherited context.
   * @param sourceName Allows tagging as 'Spec', 'Normative', or specific document name.
   */
  processTree(
    nodes: StructuredNode[],
    parentContext: string = "",
    sourceName: string = "Spec",
  ): Array<Record<string, unknown>> {
    let requirements: Array<Record<string, unknown>> = [];

    for (const node of nodes) {
      // 1. Determine Context
      const currentCategory = this.inferCategory(node.title) || parentContext;

      // 2. Extract Rules from this node's explicit content
      const nodeReqs = this.extractFromText(
        node.content,
        node.section,
        currentCategory,
        sourceName,
      );
      requirements = requirements.concat(nodeReqs);

      // 3. Recurse into children
      const childReqs = this.processTree(
        node.children,
        currentCategory,
        sourceName,
      );
      requirements = requirements.concat(childReqs);
    }

    return requirements;
  }

  private inferCategory(title: string): string | null {
    const result = inferCategory(title);
    if (result) {
      logger.debug(
        `[SPEC_PROCESSOR] InferCategory matched: "${title}" → "${result}"`,
      );
    } else {
      logger.debug(`[SPEC_PROCESSOR] InferCategory no match for "${title}"`);
    }
    return result;
  }

  private extractFromText(
    segments: { text: string; page: number }[],
    section: string,
    category: string,
    sourceName: string,
  ): Array<Record<string, unknown>> {
    const reqs: Array<Record<string, unknown>> = [];

    // DEBUG
    if (segments.length > 0) {
      logger.debug(
        `[SPEC_PROCESSOR] Processing ${segments.length} segments. Sample Page: ${segments[0].page}`,
      );
    }

    let currentBuffer = "";
    let startPage = segments.length > 0 ? segments[0].page : 1;

    // Custom Segmentation Logic
    const propertyRegex = /^([a-zA-Z0-9\s()-_]{3,60})[:=]\s*(.+)$/;
    for (const seg of segments) {
      // Heuristic: If this segment looks like a distinct Key-Value pair (Property: Value),
      // we should treat it as a new sentence start and flush the previous buffer.
      const isKeyValuePair = propertyRegex.test(seg.text);

      if (isKeyValuePair && currentBuffer.trim().length > 0) {
        this.analyzeSentence(
          currentBuffer,
          startPage,
          section,
          category,
          sourceName,
          reqs,
        );
        currentBuffer = "";
        startPage = seg.page;
      }

      // Split segment by sentence delimiters
      const parts = seg.text.split(/([.;]|\n+)/);

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (/[.;]|\n+/.test(part)) {
          // Delimiter
          if (currentBuffer.trim().length > 0) {
            this.analyzeSentence(
              currentBuffer,
              startPage,
              section,
              category,
              sourceName,
              reqs,
            );
          }
          currentBuffer = "";
          startPage = seg.page; // Next sentence starts on current page
        } else {
          if (part.trim().length > 0) {
            if (currentBuffer.length === 0) startPage = seg.page;
            currentBuffer += (currentBuffer.length > 0 ? " " : "") + part;
          }
        }
      }
    }
    // Flush remaining
    if (currentBuffer.trim().length > 0) {
      this.analyzeSentence(
        currentBuffer,
        startPage,
        section,
        category,
        sourceName,
        reqs,
      );
    }

    return reqs;
  }

  /**
   * Replaced by Semantic Compiler Pipeline.
   * Uses Tokenizer -> Parser -> AST -> Requirement logic.
   */
  private analyzeSentence(
    text: string,
    page: number,
    section: string,
    category: string,
    sourceName: string,
    reqs: Array<Record<string, unknown>>,
  ) {
    // [COMPILER PIPELINE]
    // 1. Lexical Analysis (Tokenization)
    const tokens = this.lexer.tokenize(text);

    // 2. Syntactic Analysis (Parsing / AST)
    const ast = this.parser.parse(tokens);

    if (ast) {
      // 3. Compilation (AST -> Requirement)
      const req = this.parser.compileToRequirement(ast, text, page);

      // Context Injection (Scope Resolution)
      // SELF-HEALING: If hierarchy provided no category, try to infer from the rule text itself.
      let finalCategory = category;
      if (!finalCategory || finalCategory === "General") {
        // Try to find subject in the text (e.g. "Doors Height...")
        const inferredFromText = this.inferCategory(text);
        if (inferredFromText) {
          logger.debug(
            `[SPEC_PROCESSOR] Self-healing: inferred scope '${inferredFromText}' from text: "${text}"`,
          );
          finalCategory = inferredFromText;
        }
      }

      req.derivedCategory = finalCategory || "General";
      req.section = section;
      req.source = sourceName;

      reqs.push(req as unknown as Record<string, unknown>);
    }
    // Else: Rejected by Grammar (Validation Integrity Verified)
  }
}

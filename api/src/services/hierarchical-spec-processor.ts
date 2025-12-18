import { v4 as uuidv4 } from 'uuid';
import { StructuredNode } from './hierarchical-parser.service';
import { LexerService } from './spec-compiler/lexer.service';
import { ParserService } from './spec-compiler/parser.service';

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
    processTree(nodes: StructuredNode[], parentContext: string = '', sourceName: string = 'Spec'): any[] {
        let requirements: any[] = [];

        for (const node of nodes) {
            // 1. Determine Context
            let currentCategory = this.inferCategory(node.title) || parentContext;

            // 2. Extract Rules from this node's explicit content
            const nodeReqs = this.extractFromText(node.content, node.section, currentCategory, sourceName);
            requirements = requirements.concat(nodeReqs);

            // 3. Recurse into children
            const childReqs = this.processTree(node.children, currentCategory, sourceName);
            requirements = requirements.concat(childReqs);
        }

        return requirements;
    }

    private inferCategory(title: string): string | null {
        const t = title.toUpperCase();
        console.log(`[InferCategory] Analyzing: "${title}" (Normalized: "${t}")`);

        if (t.includes('CONCRETE') || t.includes('HORMIGON')) return 'Structural Columns/Framing';
        if (t.includes('STEEL') || t.includes('ACERO')) return 'Structural Framing';
        if (t.includes('WALL') || t.includes('MURO') || t.includes('PARED')) return 'Walls';
        if (t.includes('ROOF') || t.includes('CUBIERTA') || t.includes('TECHO')) return 'Roofs';
        if (t.includes('FLOOR') || t.includes('SUELO') || t.includes('PISO') || t.includes('LOSA')) return 'Floors';
        if (t.includes('DOOR') || t.includes('PUERTA')) return 'Doors';
        if (t.includes('WINDOW') || t.includes('VENTANA')) return 'Windows';

        console.log(`[InferCategory] No match found for "${title}"`);
        return null; // Inherit
    }

    private extractFromText(segments: { text: string; page: number }[], section: string, category: string, sourceName: string): any[] {
        const reqs: any[] = [];
        // Legacy keywords for fallback (though Compiler handles this via Grammar)
        const keywords = ['SHALL', 'MUST', 'REQUIRED', 'DEBE', 'MINIMO', 'MAXIMO'];
        const propertyRegex = /^([a-zA-Z0-9\s\(\)\-\_]{3,60})[:=]\s*(.+)$/;
        const narrativeRegex = /([a-zA-Z0-9\s]+) (?:shall be|must be|debe ser|será) (.+)/i;

        // DEBUG
        if (segments.length > 0) {
            console.log(`[SpecProcessor] Processing ${segments.length} segments. Sample Page: ${segments[0].page}`);
        }

        let currentBuffer = '';
        let startPage = segments.length > 0 ? segments[0].page : 1;

        // Custom Segmentation Logic
        for (const seg of segments) {
            // Heuristic: If this segment looks like a distinct Key-Value pair (Property: Value),
            // we should treat it as a new sentence start and flush the previous buffer.
            const isKeyValuePair = propertyRegex.test(seg.text);

            if (isKeyValuePair && currentBuffer.trim().length > 0) {
                this.analyzeSentence(currentBuffer, startPage, section, category, sourceName, reqs, keywords, propertyRegex, narrativeRegex);
                currentBuffer = '';
                startPage = seg.page;
            }

            // Split segment by sentence delimiters
            const parts = seg.text.split(/([.;]|\n+)/);

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (/[.;]|\n+/.test(part)) { // Delimiter
                    if (currentBuffer.trim().length > 0) {
                        this.analyzeSentence(currentBuffer, startPage, section, category, sourceName, reqs, keywords, propertyRegex, narrativeRegex);
                    }
                    currentBuffer = '';
                    startPage = seg.page; // Next sentence starts on current page
                } else {
                    if (part.trim().length > 0) {
                        if (currentBuffer.length === 0) startPage = seg.page;
                        currentBuffer += (currentBuffer.length > 0 ? ' ' : '') + part;
                    }
                }
            }
        }
        // Flush remaining
        if (currentBuffer.trim().length > 0) {
            this.analyzeSentence(currentBuffer, startPage, section, category, sourceName, reqs, keywords, propertyRegex, narrativeRegex);
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
        reqs: any[],
        keywords: string[],
        propertyRegex: RegExp,
        narrativeRegex: RegExp
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
            if (!finalCategory || finalCategory === 'General') {
                // Try to find subject in the text (e.g. "Doors Height...")
                const inferredFromText = this.inferCategory(text);
                if (inferredFromText) {
                    console.log(`[Self-Healing] Hierarchy failed, but inferred scope '${inferredFromText}' from text: "${text}"`);
                    finalCategory = inferredFromText;
                }
            }

            req.derivedCategory = finalCategory || 'General';
            req.section = section;
            req.source = sourceName;

            reqs.push(req);
        }
        // Else: Rejected by Grammar (Validation Integrity Verified)
    }
}

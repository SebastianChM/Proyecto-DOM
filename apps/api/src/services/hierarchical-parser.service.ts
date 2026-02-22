import { PDFExtract, PDFExtractOptions } from "pdf.js-extract";
import fs from "fs";
import { logger } from "../lib/logger";

export interface StructuredNode {
  id: string;
  section: string; // "1.1", "2.0"
  title: string; // "Material Requirements"
  content: { text: string; page: number }[]; // Content segments with page info
  children: StructuredNode[];
  parent?: string;
}

export class HierarchicalParserService {
  private pdfExtract: PDFExtract;

  constructor() {
    this.pdfExtract = new PDFExtract();
  }

  async parse(filePath: string): Promise<StructuredNode[]> {
    if (
      filePath.toLowerCase().endsWith(".html") ||
      filePath.toLowerCase().endsWith(".htm")
    ) {
      return this.parseHtml(filePath);
    }

    const buffer = fs.readFileSync(filePath);
    const options: PDFExtractOptions = {};

    try {
      const data = await this.pdfExtract.extractBuffer(buffer, options);
      return this.buildTree(data);
    } catch (err: unknown) {
      const error = err as { message?: string };
      logger.error("[HIERARCHICAL_PARSER] PDF Structure Error", {
        error: (error as { message?: string }).message || "Unknown",
      });
      throw new Error("Failed to extract PDF structure");
    }
  }

  private parseHtml(filePath: string): StructuredNode[] {
    logger.info(`[HIERARCHICAL_PARSER] Parsing HTML file: ${filePath}`);
    const content = fs.readFileSync(filePath, "utf-8");
    // Simple regex-based HTML parsing for our test spec
    // Assuming structure: <h2>Title</h2> ... rules ...
    const root: StructuredNode = {
      id: "root",
      section: "0",
      title: "HTML Spec",
      content: [],
      children: [],
    };
    let activeNode = root;

    const lines = content.split("\n");
    const page = 1; // Default to page 1 for HTML

    for (const line of lines) {
      const cleanLine = line.replace(/<[^>]*>/g, " ").trim(); // Strip tags
      if (cleanLine.length === 0) continue;

      const h2Match = line.match(/<h2>(.*?)<\/h2>/i);
      if (h2Match) {
        // New Section
        const title = h2Match[1];
        logger.debug(`[HIERARCHICAL_PARSER] Found Section: ${title}`);
        const parts = title.split(".");
        const sectionId = parts[0]?.trim() || "1";

        const newNode: StructuredNode = {
          id: sectionId,
          section: sectionId,
          title: title,
          content: [],
          children: [],
        };
        root.children.push(newNode);
        activeNode = newNode;
      } else {
        // Content
        if (activeNode) {
          activeNode.content.push({ text: cleanLine, page: page });
        }
      }
    }
    logger.info(
      `[HIERARCHICAL_PARSER] HTML Parse Complete. Nodes: ${root.children.length}`,
    );
    return root.children;
  }

  /**
   * Core Logic: Converts flat pages of text chunks into a Section Tree.
   */
  private buildTree(data: { pages: unknown[] }): StructuredNode[] {
    const root: StructuredNode = {
      id: "root",
      section: "0",
      title: "Document",
      content: [],
      children: [],
    };

    // 1. Flatten all lines from all pages into a single stream, sorted by position
    const headerRegex = /^(\d+(\.\d+)*)\s+(.*)$/;

    data.pages.forEach((page: unknown, pageIndex: number) => {
      const p = page as { content?: unknown[] };
      p.content?.forEach((item: unknown) => {
        const i = item as { str?: string };
        if (i.str?.trim().length === 0) return;

        const text = i.str?.trim() || "";
        const match = text.match(headerRegex);

        if (match) {
          // Found a potential Header!
          const sectionId = match[1]; // "1.1"
          const title = match[3]; // "Scope"

          const newNode: StructuredNode = {
            id: sectionId,
            section: sectionId,
            title: title,
            content: [],
            children: [],
          };
          this.addToTree(root, newNode);
        } else {
          // Normal Content
          const activeNode = this.findLastActive(root);
          activeNode.content.push({ text: text, page: pageIndex + 1 });
        }
      });
    });

    return root.children;
  }

  // Helper to place a node in the correct place in the tree based on Section ID
  private addToTree(parent: StructuredNode, node: StructuredNode) {
    if (parent.id === "root") {
      const lastChild = parent.children[parent.children.length - 1];
      if (lastChild && node.section.startsWith(lastChild.section + ".")) {
        this.addToTree(lastChild, node);
      } else {
        parent.children.push(node);
      }
    } else {
      const lastChild = parent.children[parent.children.length - 1];
      if (lastChild && node.section.startsWith(lastChild.section + ".")) {
        this.addToTree(lastChild, node);
      } else {
        parent.children.push(node);
      }
    }
  }

  private findLastActive(node: StructuredNode): StructuredNode {
    if (node.children.length === 0) return node;
    return this.findLastActive(node.children[node.children.length - 1]);
  }
}

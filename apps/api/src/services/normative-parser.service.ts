import { HierarchicalParserService } from "./hierarchical-parser.service";
import { HierarchicalSpecProcessor } from "./hierarchical-spec-processor";
import { logger } from "../lib/logger";

export class NormativeParserService {
  private parser: HierarchicalParserService;
  private processor: HierarchicalSpecProcessor;

  constructor() {
    this.parser = new HierarchicalParserService();
    this.processor = new HierarchicalSpecProcessor();
  }

  async parse(filePath: string): Promise<Array<Record<string, unknown>>> {
    logger.info(`[NormativeParser] Parsing: ${filePath}`);

    // 1. Build Structure Tree
    const tree = await this.parser.parse(filePath);

    // 2. Extract Requirements with 'Normative' source tag
    // We might add specific 'Normative' keywords in the future here
    const requirements = this.processor.processTree(tree, "", "Normative");

    logger.info(
      `[NormativeParser] Extracted ${requirements.length} normative rules.`,
    );
    return requirements;
  }
}

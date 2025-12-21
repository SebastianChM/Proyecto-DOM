import { apsAuthService } from "./auth.service";

export class APSModelPropertiesService {
  // private api: ModelPropertiesClient; // Removed to avoid dependency error

  constructor() {
    // this.api = new ModelPropertiesClient();
  }

  /**
   * Create a diff index between two versions
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createDiffIndex(prevVersionUrn: string, curVersionUrn: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const token = await apsAuthService.getInternalToken();

    // Placeholder return
    return {
      diffId: "diff-id-placeholder",
      status: "processing",
    };
  }

  /**
   * Query diff results
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async queryDiff(diffId: string, query: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const token = await apsAuthService.getInternalToken();

    return {
      result: [],
      pagination: {},
    };
  }

  /**
   * Get diff status
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getDiffStatus(diffId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const token = await apsAuthService.getInternalToken();
    return {
      state: "COMPLETED",
      progress: 100,
    };
  }
}

export const modelPropertiesService = new APSModelPropertiesService();

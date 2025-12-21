import { apsAuthService } from "./auth.service";
import { apsOssService } from "./oss.service";
import axios from "axios";

const DA_BASE_URL = "https://developer.api.autodesk.com/da/us-east/v3";
const FORGE_CLIENT_ID = process.env.APS_CLIENT_ID || "";
// Use configured nickname or fallback to client ID (which is the default if not set)
const NICKNAME = process.env.APS_DA_NICKNAME || FORGE_CLIENT_ID;

export class APSDesignAutomationService {
  constructor() {
    // No forge-apis needed, we use REST API directly
  }

  /**
   * Get authorization header
   */
  private async getAuthHeader() {
    const token = await apsAuthService.getInternalToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Setup nickname (required once per account)
   */
  async setupNickname() {
    try {
      const headers = await this.getAuthHeader();
      // Check if nickname is already set by trying to get it (not directly possible via simple GET,
      // but we can try to create it and handle 409)

      console.log(`🔧 Setting up Design Automation nickname: ${NICKNAME}`);

      await axios.patch(
        `${DA_BASE_URL}/forgeapps/me`,
        { nickname: NICKNAME },
        { headers },
      );
      console.log(`✅ Nickname set to: ${NICKNAME}`);
      return true;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      // 409 means nickname already exists, which is fine
      if (err.response?.status === 409) {
        console.log(`✅ Nickname already exists (or conflict): ${NICKNAME}`);
        return true;
      }
      console.error(
        "Failed to setup nickname:",
        err.response?.data || err.message || "Unknown error",
      );
      return false;
    }
  }

  /**
   * Check if DWG to PDF activity exists, create if not
   */
  async ensureDwgToPdfActivity(): Promise<string> {
    const activityId = `${NICKNAME}.DwgToPdfActivity+prod`;
    const headers = await this.getAuthHeader();

    try {
      // Check if activity exists
      await axios.get(`${DA_BASE_URL}/activities/${activityId}`, { headers });
      console.log(`✅ Activity exists: ${activityId}`);
      return activityId;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      if (err.response?.status !== 404) {
        console.error(
          `❌ Error checking activity ${activityId}:`,
          err.response?.data || err.message || "Unknown error",
        );
        throw error;
      }
    }

    // Create the activity using AutoCAD's built-in PlotToPDF command
    console.log(`📝 Creating DWG to PDF activity: ${activityId}...`);

    // Ensure nickname is set up before creating activity
    await this.setupNickname();

    const activity = {
      id: "DwgToPdfActivity",
      commandLine: [
        '$(engine.path)\\accoreconsole.exe /i "$(args[inputFile].path)" /s "$(settings[script].path)"',
      ],
      parameters: {
        inputFile: {
          verb: "get",
          description: "Input DWG file",
          required: true,
          localName: "input.dwg",
        },
        outputPdf: {
          verb: "put",
          description: "Output PDF file",
          required: true,
          localName: "output.pdf",
        },
      },
      engine: "Autodesk.AutoCAD+24_3", // AutoCAD 2024.3 (supported until 2027)
      description: "Converts DWG to high-quality PDF",
      settings: {
        script: {
          value: "_-EXPORT _PDF _ALL output.pdf\n",
        },
      },
    };

    try {
      const response = await axios.post(`${DA_BASE_URL}/activities`, activity, {
        headers,
      });
      console.log(`✅ Activity created: ${response.data.id}`);

      // Create alias 'prod' for the activity
      await axios.post(
        `${DA_BASE_URL}/activities/${activity.id}/aliases`,
        { id: "prod", version: 1 },
        { headers },
      );
      console.log(`✅ Activity alias 'prod' created`);

      return activityId;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      console.error(
        "Failed to create activity:",
        err.response?.data || err.message || "Unknown error",
      );

      // If it failed because it already exists (race condition or partial setup), try to return the ID anyway
      if (err.response?.status === 409) {
        console.log("Activity already exists (409), returning ID.");
        return activityId;
      }
      throw error;
    }
  }

  /**
   * Convert DWG to PDF using Design Automation
   */
  async convertDwgToPdf(
    inputObjectId: string,
    outputObjectId: string,
    bucketKey: string,
    webhookUrl?: string,
  ): Promise<string> {
    const headers = await this.getAuthHeader();

    // Ensure the activity exists
    const activityId = await this.ensureDwgToPdfActivity();

    // Create SIGNED URLs for input/output (required by Design Automation)
    // Bearer token headers are NOT supported - must use signed URLs
    console.log(`🔐 Getting signed URLs for input: ${inputObjectId}`);
    const inputSignedUrl = await apsOssService.getSignedUrl(inputObjectId);
    const outputSignedUrl =
      await apsOssService.getSignedWriteUrl(outputObjectId);

    console.log(`✅ Got signed URLs`);

    const workItem: {
      activityId: string;
      arguments: {
        inputFile: { url: string };
        outputPdf: { url: string; verb: string };
        onComplete?: { verb: string; url: string };
      };
    } = {
      activityId: activityId,
      arguments: {
        inputFile: {
          url: inputSignedUrl,
        },
        outputPdf: {
          url: outputSignedUrl,
          verb: "put",
        },
      },
    };

    if (webhookUrl) {
      console.log(`🔗 Attaching webhook to WorkItem: ${webhookUrl}`);
      workItem.arguments.onComplete = {
        verb: "post",
        url: webhookUrl,
      };
    }

    console.log(`📤 Creating work item for DWG to PDF conversion...`);
    console.log(`   Activity: ${activityId}`);
    console.log(`   Input: ${inputObjectId}`);
    console.log(`   Output: ${outputObjectId}`);

    try {
      const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, {
        headers,
      });
      console.log(`✅ Work item created: ${response.data.id}`);
      return response.data.id;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error(
        "Failed to create work item:",
        err.response?.data || err.message || "Unknown error",
      );
      throw error;
    }
  }

  /**
   * Get work item status via REST API
   */
  async getWorkItemStatusRest(workItemId: string): Promise<unknown> {
    const headers = await this.getAuthHeader();
    const response = await axios.get(`${DA_BASE_URL}/workitems/${workItemId}`, {
      headers,
    });
    return response.data;
  }

  /**
   * Get all app bundles
   */
  async getAppBundles() {
    const headers = await this.getAuthHeader();
    const response = await axios.get(`${DA_BASE_URL}/appbundles`, { headers });
    return response.data;
  }

  /**
   * Get all activities
   */
  async getActivities() {
    const headers = await this.getAuthHeader();
    const response = await axios.get(`${DA_BASE_URL}/activities`, { headers });
    return response.data;
  }

  /**
   * Create a new activity
   */
  async createActivity(activity: Record<string, unknown>) {
    const headers = await this.getAuthHeader();
    const response = await axios.post(`${DA_BASE_URL}/activities`, activity, {
      headers,
    });
    return response.data;
  }

  /**
   * Create a new app bundle
   */
  async createAppBundle(appBundle: Record<string, unknown>) {
    const headers = await this.getAuthHeader();
    const response = await axios.post(`${DA_BASE_URL}/appbundles`, appBundle, {
      headers,
    });
    return response.data;
  }

  /**
   * Submit a work item (job)
   */
  async createWorkItem(workItem: Record<string, unknown>) {
    const headers = await this.getAuthHeader();
    const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, {
      headers,
    });
    return response.data;
  }

  /**
   * Get work item status
   */
  async getWorkItemStatus(id: string) {
    const headers = await this.getAuthHeader();
    const response = await axios.get(`${DA_BASE_URL}/workitems/${id}`, {
      headers,
    });
    return response.data;
  }

  /**
   * Delete a work item (cancel)
   */
  async deleteWorkItem(id: string) {
    const headers = await this.getAuthHeader();
    await axios.delete(`${DA_BASE_URL}/workitems/${id}`, { headers });
  }
  /**
   * Ensure Revit to PDF Activity exists
   */
  async ensureRevitToPdfActivity(): Promise<string> {
    const activityId = `${NICKNAME}.RevitToPdfActivity+prod`;
    const headers = await this.getAuthHeader();

    try {
      await axios.get(`${DA_BASE_URL}/activities/${activityId}`, { headers });
      console.log(`✅ Revit Activity exists: ${activityId}`);
      return activityId;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status !== 404) throw error;
    }

    console.log(`📝 Creating Revit to PDF activity...`);
    await this.setupNickname();

    const activity = {
      id: "RevitToPdfActivity",
      commandLine: [
        `$(engine.path)\\\\revitcoreconsole.exe /i "$(args[inputFile].path)" /al "$(appbundles[RevitToPdfApp].path)"`,
      ],
      parameters: {
        inputFile: {
          verb: "get",
          description: "Input Revit File",
          required: true,
          localName: "$(inputFile)",
        },
        outputPdf: {
          verb: "put",
          description: "Output PDF File",
          required: true,
          localName: "output.pdf",
        },
      },
      engine: "Autodesk.Revit+2024",
      appbundles: [`${NICKNAME}.RevitToPdfApp+prod`],
      description: "Exports Revit sheets to PDF using custom AppBundle",
    };

    try {
      const response = await axios.post(`${DA_BASE_URL}/activities`, activity, {
        headers,
      });
      console.log(`✅ Revit Activity created: ${response.data.id}`);

      // Create alias
      await axios.post(
        `${DA_BASE_URL}/activities/${activity.id}/aliases`,
        { id: "prod", version: 1 },
        { headers },
      );
      return activityId;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown } };
      console.error("Failed to create Revit Activity:", err.response?.data);
      if (err.response?.status === 409) return activityId;
      throw error;
    }
  }

  /**
   * Create WorkItem for Revit to PDF
   */
  async convertRevitToPdf(
    inputObjectId: string,
    outputObjectId: string,
    bucketKey: string,
    webhookUrl?: string,
  ): Promise<string> {
    const headers = await this.getAuthHeader();
    const token = await apsAuthService.getInternalToken();
    const activityId = await this.ensureRevitToPdfActivity();

    const inputUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${inputObjectId}`;
    const outputUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${outputObjectId}`;

    const workItem = {
      activityId: activityId,
      arguments: {
        inputFile: {
          url: inputUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
        outputPdf: {
          url: outputUrl,
          verb: "put",
          headers: { Authorization: `Bearer ${token}` },
        },
        onComplete: webhookUrl
          ? {
              verb: "post",
              url: webhookUrl,
            }
          : undefined,
      },
    };

    console.log(`📤 Submitting Revit WorkItem...`);
    const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, {
      headers,
    });
    return response.data.id;
  }
}

export const designAutomationService = new APSDesignAutomationService();

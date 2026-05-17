import { apsAuthService } from "./auth.service";
import { apsOssService } from "./oss.service";
import axios from "axios";
import * as fs from "fs";
import FormData from "form-data";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";

const DA_BASE_URL = "https://developer.api.autodesk.com/da/us-east/v3";
const NICKNAME = env.APS_DA_NICKNAME;

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

      logger.debug("[DA] Setting up nickname", { nickname: NICKNAME });

      await axios.patch(
        `${DA_BASE_URL}/forgeapps/me`,
        { nickname: NICKNAME },
        { headers },
      );
      logger.info("[DA] Nickname set", { nickname: NICKNAME });
      return true;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      // 409 means nickname already exists, which is fine
      if (err.response?.status === 409) {
        logger.debug("[DA] Nickname already exists", { nickname: NICKNAME });
        return true;
      }
      logger.error("[DA] Failed to setup nickname", {
        error: err.response?.data || err.message || "Unknown error",
      });
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
      logger.debug("[DA] Activity exists", { activityId });
      return activityId;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      if (err.response?.status !== 404) {
        logger.error("[DA] Error checking activity", {
          activityId,
          error: err.response?.data || err.message || "Unknown error",
        });
        throw error;
      }
    }

    // Create the activity using AutoCAD's built-in PlotToPDF command
    logger.debug("[DA] Creating DWG to PDF activity", { activityId });

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
      logger.info("[DA] Activity created", { id: response.data.id });

      // Create alias 'prod' for the activity
      await axios.post(
        `${DA_BASE_URL}/activities/${activity.id}/aliases`,
        { id: "prod", version: 1 },
        { headers },
      );
      logger.debug("[DA] Activity alias 'prod' created");

      return activityId;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      logger.error("[DA] Failed to create activity", {
        error: err.response?.data || err.message || "Unknown error",
      });

      if (err.response?.status === 409) {
        logger.debug("[DA] Activity already exists (409), returning ID");
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
    logger.debug("[DA] Getting signed URLs", { inputObjectId });
    const inputSignedUrl = await apsOssService.getSignedUrl(inputObjectId);
    const outputSignedUrl =
      await apsOssService.getSignedWriteUrl(outputObjectId);

    logger.debug("[DA] Got signed URLs");

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
      logger.debug("[DA] Attaching webhook to WorkItem", { webhookUrl });
      workItem.arguments.onComplete = {
        verb: "post",
        url: webhookUrl,
      };
    }

    logger.debug("[DA] Creating work item for DWG to PDF", {
      activityId,
      inputObjectId,
      outputObjectId,
    });

    try {
      const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, {
        headers,
      });
      logger.info("[DA] Work item created", { id: response.data.id });
      return response.data.id;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      logger.error("[DA] Failed to create work item", {
        error: err.response?.data || err.message || "Unknown error",
      });
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
      logger.debug("[DA] Revit Activity exists", { activityId });
      return activityId;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status !== 404) throw error;
    }

    logger.debug("[DA] Creating Revit to PDF activity");
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
      logger.info("[DA] Revit Activity created", { id: response.data.id });

      await axios.post(
        `${DA_BASE_URL}/activities/${activity.id}/aliases`,
        { id: "prod", version: 1 },
        { headers },
      );
      return activityId;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown } };
      logger.error("[DA] Failed to create Revit Activity", {
        error: err.response?.data,
      });
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
    _bucketKey: string,
    webhookUrl?: string,
  ): Promise<string> {
    const headers = await this.getAuthHeader();
    const activityId = await this.ensureRevitToPdfActivity();

    // Use signed URLs (same pattern as convertDwgToPdf) so no short-lived
    // bearer token is embedded in the work item payload sent to Autodesk.
    logger.debug("[DA] Getting signed URLs for Revit conversion", {
      inputObjectId,
    });
    const inputSignedUrl = await apsOssService.getSignedUrl(inputObjectId);
    const outputSignedUrl =
      await apsOssService.getSignedWriteUrl(outputObjectId);
    logger.debug("[DA] Got signed URLs");

    const workItem = {
      activityId,
      arguments: {
        inputFile: {
          url: inputSignedUrl,
        },
        outputPdf: {
          url: outputSignedUrl,
          verb: "put",
        },
        onComplete: webhookUrl ? { verb: "post", url: webhookUrl } : undefined,
      },
    };

    logger.debug("[DA] Submitting Revit WorkItem");
    const response = await axios.post(`${DA_BASE_URL}/workitems`, workItem, {
      headers,
    });
    return response.data.id;
  }

  /**
   * Deploy App Bundle (Upload + Register + Alias)
   */
  async deployAppBundle(
    appName: string,
    zipFilePath: string,
    engine: string,
    description: string,
  ): Promise<string> {
    logger.debug("[DA] Deploying AppBundle", { appName });
    await this.setupNickname();

    const appBundleId = `${NICKNAME}.${appName}`;
    const headers = await this.getAuthHeader();

    const appBundleSpec = {
      id: appName,
      engine: engine,
      description: description,
    };

    let uploadParams = null;

    try {
      const res = await axios.post(`${DA_BASE_URL}/appbundles`, appBundleSpec, {
        headers,
      });
      uploadParams = res.data.uploadParameters;
      logger.info("[DA] AppBundle created, uploading binary");
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 409) {
        logger.debug(
          "[DA] AppBundle exists, getting upload URL for new version",
        );
        const res = await axios.post(
          `${DA_BASE_URL}/appbundles/${appName}/versions`,
          { engine, description },
          { headers },
        );
        uploadParams = res.data.uploadParameters;
        logger.info("[DA] New version created", { version: res.data.version });
      } else {
        throw error;
      }
    }

    // 2. Upload ZIP using the parameters provided by APS (Direct to S3)
    const formData = new FormData();
    Object.keys(uploadParams.formData).forEach((key) => {
      formData.append(key, uploadParams.formData[key]);
    });
    formData.append("file", fs.createReadStream(zipFilePath));

    try {
      await axios.post(uploadParams.endpointURL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      logger.info("[DA] ZIP Uploaded successfully");
    } finally {
      // Always delete the local zip to prevent disk accumulation,
      // regardless of whether the upload succeeded or failed.
      await fs.promises.unlink(zipFilePath).catch((unlinkErr: unknown) => {
        logger.warn("[DA] Could not delete temp AppBundle zip", {
          zipFilePath,
          error:
            unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
        });
      });
    }

    const version = uploadParams.version || 1;
    const aliasId = "prod";

    try {
      await axios.get(
        `${DA_BASE_URL}/appbundles/${appName}/aliases/${aliasId}`,
        { headers },
      );
      await axios.patch(
        `${DA_BASE_URL}/appbundles/${appName}/aliases/${aliasId}`,
        { version },
        { headers },
      );
      logger.info("[DA] Alias 'prod' updated", { version });
    } catch {
      logger.info("[DA] Alias 'prod' created", { version });
    }

    return appBundleId;
  }
}

export const designAutomationService = new APSDesignAutomationService();

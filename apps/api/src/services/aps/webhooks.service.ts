import axios from "axios";
import { apsAuthService } from "./auth.service";
import { APP_CONFIG } from "../../config/constants";

const WEHOOKS_API_URL =
  "https://developer.api.autodesk.com/webhooks/v1/systems";

export class APSWebhooksService {
  /**
   * Get Authorization Header with internal token
   */
  private async getAuthHeader() {
    const token = await apsAuthService.getInternalToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get all active webhooks for the system
   * @param system 'data' (Data Management) or 'derivative' (Model Derivative)
   */
  async getWebhooks(system: string = "data") {
    const headers = await this.getAuthHeader();
    try {
      const response = await axios.get(`${WEHOOKS_API_URL}/${system}/hooks`, {
        headers,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error(
        `❌ Failed to get webhooks for system ${system}:`,
        err.response?.data || err.message,
      );
      throw error;
    }
  }

  /**
   * Create a webhook subscription
   * @param system 'data' or 'derivative'
   * @param event 'dm.version.added', 'extraction.finished', etc.
   * @param scopeObject The scope object (e.g. { folder: folderId })
   */
  async createWebhook(
    system: string,
    event: string,
    scopeObject: Record<string, unknown>,
  ) {
    if (!APP_CONFIG.APS.WEBHOOK_URL) {
      console.warn(
        "⚠️ APS_WEBHOOK_URL is not configured. Skipping webhook creation.",
      );
      return null;
    }

    const headers = await this.getAuthHeader();
    const callbackUrl = APP_CONFIG.APS.WEBHOOK_URL;

    const body = {
      callbackUrl: callbackUrl,
      scope: scopeObject,
    };

    console.log(`🔗 Creating webhook for ${event}...`);
    console.log(`   Callback: ${callbackUrl}`);
    console.log(`   Scope:`, JSON.stringify(scopeObject));

    try {
      const response = await axios.post(
        `${WEHOOKS_API_URL}/${system}/events/${event}/hooks`,
        body,
        { headers },
      );
      console.log(`✅ Webhook created successfully: ${response.data.hookId}`);
      return response.data;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      // Check if it already exists (409 Conflict) - This is common and acceptable
      if (err.response?.status === 409) {
        console.log(`ℹ️ Webhook already exists for this scope.`);
        return { status: "exists" };
      }

      console.error(
        `❌ Failed to create webhook:`,
        err.response?.data || err.message,
      );
      // Don't throw, just return null so the flow doesn't break
      return null;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(system: string, event: string, hookId: string) {
    const headers = await this.getAuthHeader();
    try {
      await axios.delete(
        `${WEHOOKS_API_URL}/${system}/events/${event}/hooks/${hookId}`,
        { headers },
      );
      console.log(`🗑️ Webhook ${hookId} deleted.`);
      return true;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error(
        `❌ Failed to delete webhook:`,
        err.response?.data || err.message,
      );
      return false;
    }
  }

  /**
   * Subscribe to Folder Updates (dm.version.added)
   * This will notify us when ANY file in this folder (or subfolders) gets a new version.
   */
  async subscribeToFolderUpdates(folderId: string) {
    return this.createWebhook("data", "dm.version.added", { folder: folderId });
  }
}

export const apsWebhooksService = new APSWebhooksService();

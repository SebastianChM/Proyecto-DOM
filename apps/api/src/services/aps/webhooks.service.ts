import axios from "axios";
import { apsAuthService } from "./auth.service";
import { APP_CONFIG } from "../../config/constants";
import { logger } from "../../lib/logger";

const WEBHOOKS_API_URL =
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
      const response = await axios.get(`${WEBHOOKS_API_URL}/${system}/hooks`, {
        headers,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      logger.error("[APS_WEBHOOKS] Failed to get webhooks", {
        system,
        error: err.response?.data || err.message,
      });
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
      logger.warn(
        "[APS_WEBHOOKS] APS_WEBHOOK_URL is not configured. Skipping webhook creation.",
      );
      return null;
    }

    const headers = await this.getAuthHeader();
    const callbackUrl = APP_CONFIG.APS.WEBHOOK_URL;

    const body = {
      callbackUrl: callbackUrl,
      scope: scopeObject,
    };

    logger.info("[APS_WEBHOOKS] Creating webhook", {
      event,
      callbackUrl,
      scope: JSON.stringify(scopeObject),
    });

    try {
      const response = await axios.post(
        `${WEBHOOKS_API_URL}/${system}/events/${event}/hooks`,
        body,
        { headers },
      );
      logger.info("[APS_WEBHOOKS] Webhook created successfully", {
        hookId: response.data.hookId,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      // Check if it already exists (409 Conflict) - This is common and acceptable
      if (err.response?.status === 409) {
        logger.debug("[APS_WEBHOOKS] Webhook already exists for this scope");
        return { status: "exists" };
      }

      logger.error("[APS_WEBHOOKS] Failed to create webhook", {
        error: err.response?.data || err.message,
      });
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
        `${WEBHOOKS_API_URL}/${system}/events/${event}/hooks/${hookId}`,
        { headers },
      );
      logger.info("[APS_WEBHOOKS] Webhook deleted", { hookId });
      return true;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      logger.error("[APS_WEBHOOKS] Failed to delete webhook", {
        hookId,
        error: err.response?.data || err.message,
      });
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

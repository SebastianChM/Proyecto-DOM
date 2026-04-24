// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../types/forge-apis.d.ts" />
import { DerivativesApi } from "forge-apis";
import { apsAuthService } from "./auth.service";
import axios from "axios";
import { logger } from "../../lib/logger";

export class APSModelDerivativeService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private api: any; // DerivativesApi from forge-apis has incomplete types
  private formatsCache: unknown = null;
  private lastCacheTime: number = 0;
  private lastModified: string | null = null;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  constructor() {
    this.api = new DerivativesApi();
  }

  /**
   * Delete manifest to allow re-translation
   * This is needed when a previous translation failed
   */
  async deleteManifest(urn: string): Promise<boolean> {
    try {
      const token = await apsAuthService.getInternalToken();
      await axios.delete(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      logger.debug("[MODEL_DERIVATIVE] Deleted old manifest");
      return true;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      if (err.response?.status === 404) {
        logger.debug("[MODEL_DERIVATIVE] No manifest to delete");
        return true;
      }
      logger.warn("[MODEL_DERIVATIVE] Could not delete manifest", {
        error: err.response?.data || err.message || "Unknown error",
      });
      return false;
    }
  }

  /**
   * Get supported formats (Cached)
   */
  async getFormats() {
    // Return cached data if valid
    if (
      this.formatsCache &&
      Date.now() - this.lastCacheTime < this.CACHE_DURATION
    ) {
      logger.debug("[MODEL_DERIVATIVE] Serving formats from cache");
      return this.formatsCache;
    }

    const token = await apsAuthService.getInternalToken();
    try {
      logger.debug("[MODEL_DERIVATIVE] Fetching formats from Autodesk");

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      if (this.lastModified) {
        headers["If-Modified-Since"] = this.lastModified;
      }

      const response = await axios.get(
        "https://developer.api.autodesk.com/modelderivative/v2/designdata/formats",
        { headers },
      );

      // Update cache
      this.formatsCache = response.data;
      this.lastCacheTime = Date.now();
      this.lastModified = response.headers["last-modified"] || null;

      return response.data;
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      // Handle 304 Not Modified
      if (err.response?.status === 304 && this.formatsCache) {
        logger.debug(
          "[MODEL_DERIVATIVE] Formats not modified (304), serving from cache",
        );
        this.lastCacheTime = Date.now();
        return this.formatsCache;
      }

      logger.error("[MODEL_DERIVATIVE] Failed to get formats", {
        error: err.response?.data || err.message || "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Translate a file to SVF2 (for Viewer)
   */
  async translateToSVF2(urn: string) {
    const token = await apsAuthService.getInternalToken();

    const job = {
      input: {
        urn,
        compressedUrn: false,
      },
      output: {
        formats: [
          {
            type: "svf2",
            views: ["2d", "3d"],
          },
        ],
      },
    };

    // forge-apis expects { access_token: string } as credentials
    const result = await this.api.translate(job, { xAdsForce: true }, null, {
      access_token: token,
    });
    return result.body;
  }

  /**
   * Translate to PDF using REST API directly
   * This gives us more control over the request format
   */
  async translateToPDF(urn: string) {
    const token = await apsAuthService.getInternalToken();

    /**
     * Strategy for DWG to PDF:
     * 1. Try direct PDF translation first (works for most files)
     * 2. If that fails, fall back to SVF2 + 2dviews:pdf
     */

    // Strategy 1: Direct PDF translation (most compatible)
    const jobDirectPdf = {
      input: { urn },
      output: {
        destination: { region: "us" },
        formats: [
          {
            type: "pdf",
          },
        ],
      },
    };

    logger.debug("[MODEL_DERIVATIVE] [Strategy 1] Direct PDF translation");
    logger.debug("[MODEL_DERIVATIVE] Request body", { job: jobDirectPdf });

    try {
      const response = await axios.post(
        "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
        jobDirectPdf,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            // Do NOT use x-ads-force here — it wipes existing SVF2 derivatives
          },
        },
      );
      logger.info("[MODEL_DERIVATIVE] Translation job started (Direct PDF)", {
        result: response.data,
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { diagnostic?: string } };
        message?: string;
      };
      const errorMsg =
        err.response?.data?.diagnostic || err.message || "Unknown error";
      logger.warn("[MODEL_DERIVATIVE] Strategy 1 (Direct PDF) failed", {
        error: errorMsg,
      });

      logger.debug("[MODEL_DERIVATIVE] [Strategy 2] SVF2 with 2dviews: pdf");

      const jobSvf2Pdf = {
        input: { urn },
        output: {
          destination: { region: "us" },
          formats: [
            {
              type: "svf2",
              views: ["2d"],
              advanced: {
                "2dviews": "pdf",
              },
            },
          ],
        },
      };

      try {
        const response = await axios.post(
          "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
          jobSvf2Pdf,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        logger.info(
          "[MODEL_DERIVATIVE] Translation job started (SVF2 + 2dviews:pdf)",
          { result: response.data },
        );
        return response.data;
      } catch (fallbackError: unknown) {
        const fbErr = fallbackError as {
          response?: { data?: unknown };
          message?: string;
        };
        logger.error(
          "[MODEL_DERIVATIVE] Strategy 2 (SVF2+2dviews) also failed",
          {
            error: fbErr.response?.data || fbErr.message || "Unknown error",
          },
        );
        throw new Error(
          `PDF conversion failed for URN: ${urn}. Both direct PDF and SVF2 methods failed.`,
        );
      }
    }
  }

  /**
   * Translate to IFC
   */
  async translateToIFC(urn: string) {
    const token = await apsAuthService.getInternalToken();

    const job = {
      input: { urn },
      output: {
        formats: [
          {
            type: "ifc",
            advanced: { exportFileStructure: "multiple" },
          },
        ],
      },
    };

    const result = await this.api.translate(job, { xAdsForce: true }, null, {
      access_token: token,
    });
    return result.body;
  }

  /**
   * Get manifest (translation status)
   */
  async getManifest(urn: string) {
    const token = await apsAuthService.getInternalToken();
    const result = await this.api.getManifest(urn, {}, null, {
      access_token: token,
    });
    return result.body;
  }

  /**
   * Get metadata (hierarchy)
   */
  async getMetadata(urn: string) {
    const token = await apsAuthService.getInternalToken();
    const result = await this.api.getMetadata(urn, {}, null, {
      access_token: token,
    });
    return result.body;
  }

  /**
   * Get properties of a specific view/guid
   */
  async getProperties(urn: string, guid: string) {
    const token = await apsAuthService.getInternalToken();
    const result = await this.api.getModelviewProperties(urn, guid, {}, null, {
      access_token: token,
    });
    return result.body;
  }

  /**
   * Get object tree (hierarchy) for a specific view/guid
   * This returns the hierarchical structure with categories and families
   */
  async getObjectTree(urn: string, guid: string) {
    const token = await apsAuthService.getInternalToken();
    try {
      const result = await this.api.getModelviewMetadata(urn, guid, {}, null, {
        access_token: token,
      });
      return result.body;
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      logger.error("[MODEL_DERIVATIVE] Failed to get object tree", {
        error: err.response?.data || err.message || "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get all properties for the default 3D view of the model
   */
  async getAllModelProperties(urn: string) {
    const metadata = await this.getMetadata(urn);
    const viewGeometry =
      metadata.data.metadata.find(
        (m: unknown) =>
          (m as { role?: string; isMasterView?: boolean }).role === "3d" &&
          (m as { isMasterView?: boolean }).isMasterView,
      ) ||
      metadata.data.metadata.find(
        (m: unknown) => (m as { role?: string }).role === "3d",
      );

    if (!viewGeometry) {
      throw new Error("No 3D view found in model metadata");
    }

    return this.getProperties(urn, viewGeometry.guid);
  }

  /**
   * Get download URL and cookies for a derivative using signed cookies
   */
  async getDerivativeDownloadInfo(
    urn: string,
    derivativeUrn: string,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    const token = await apsAuthService.getInternalToken();
    const encodedUrn = encodeURIComponent(derivativeUrn);
    const url = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest/${encodedUrn}/signedcookies`;

    logger.debug("[MODEL_DERIVATIVE] Getting signed cookies/url", { url });

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // The response can contain 'url' or 'downloadUrl' depending on the API version/state
      const downloadUrl = response.data.url || response.data.downloadUrl;

      if (!downloadUrl) {
        throw new Error("No download URL found in signedcookies response");
      }

      // Extract cookies from Set-Cookie header
      const setCookie = response.headers["set-cookie"];
      const headers: Record<string, string> = {};

      if (setCookie) {
        headers["Cookie"] = setCookie
          .map((c: string) => c.split(";")[0])
          .join("; ");
      }

      return { url: downloadUrl, headers };
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      logger.error("[MODEL_DERIVATIVE] Failed to get signed download URL", {
        error: err.response?.data || err.message || "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Download a derivative
   */
  async getDerivative(urn: string, derivativeUrn: string): Promise<Buffer> {
    const token = await apsAuthService.getInternalToken();

    // Use axios directly to ensure we get proper binary data
    const encodedUrn = encodeURIComponent(derivativeUrn);
    const url = `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest/${encodedUrn}`;

    logger.debug("[MODEL_DERIVATIVE] Fetching derivative", { url });

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "arraybuffer",
    });

    logger.debug("[MODEL_DERIVATIVE] Received derivative", {
      bytes: response.data.length,
      contentType: response.headers["content-type"],
    });

    return Buffer.from(response.data);
  }
}

// Conditional: use mock when APS_MOCK=true
import { env } from "../../config/env";
import { MockAPSModelDerivativeService } from "../../mocks/aps-mock";

export const modelDerivativeService: APSModelDerivativeService = env.APS_MOCK
  ? (new MockAPSModelDerivativeService() as unknown as APSModelDerivativeService)
  : new APSModelDerivativeService();

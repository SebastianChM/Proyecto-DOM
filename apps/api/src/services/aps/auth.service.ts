import {
  AuthClientTwoLegged,
  AuthClientThreeLegged,
  UserProfileApi,
} from "forge-apis";
import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";

/**
 * In-memory cache for 2-legged tokens.
 * Autodesk tokens last 3600s (1h). We cache with a 5-minute safety margin.
 */
const TOKEN_CACHE_MARGIN_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
}

export class APSAuthService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private twoLeggedClient: any; // AuthClientTwoLegged instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private threeLeggedClient: any; // AuthClientThreeLegged instance

  /** In-memory cache for the 2-legged (internal) token */
  private cachedInternalToken: CachedToken | null = null;

  constructor() {
    const clientId = env.APS_CLIENT_ID;
    const clientSecret = env.APS_CLIENT_SECRET;
    const callbackUrl = env.APS_CALLBACK_URL;

    if (!clientId || !clientSecret || !callbackUrl) {
      logger.warn(
        "[APS_AUTH] APS credentials missing. Auth service will not work correctly.",
      );
    }

    this.twoLeggedClient = new AuthClientTwoLegged(
      clientId!,
      clientSecret!,
      [
        "data:read",
        "data:write",
        "data:create",
        "bucket:read",
        "bucket:create",
        "bucket:delete",
        "code:all",
      ],
      true,
    );

    this.threeLeggedClient = new AuthClientThreeLegged(
      clientId!,
      clientSecret!,
      callbackUrl!,
      ["data:read", "data:write", "user:read", "account:read"],
      true,
    );
  }

  /**
   * Get 2-legged token (for internal server operations)
   * This token is used for data management, model derivative, etc.
   *
   * CACHED: Tokens are cached in-memory until 5 minutes before expiry.
   * Autodesk 2-legged tokens typically last 3600s (1 hour).
   */
  async getInternalToken(): Promise<string> {
    // Return cached token if still valid
    if (
      this.cachedInternalToken &&
      Date.now() < this.cachedInternalToken.expiresAt
    ) {
      return this.cachedInternalToken.accessToken;
    }

    logger.debug("[APS_AUTH] Fetching new 2-legged token (cache miss/expired)");
    const credentials = await this.twoLeggedClient.authenticate();

    // Cache the token with a safety margin
    const expiresInMs = (credentials.expires_in || 3600) * 1000;
    this.cachedInternalToken = {
      accessToken: credentials.access_token,
      expiresAt: Date.now() + expiresInMs - TOKEN_CACHE_MARGIN_MS,
    };

    logger.info("[APS_AUTH] 2-legged token cached", {
      expiresInMinutes: Math.round(
        (expiresInMs - TOKEN_CACHE_MARGIN_MS) / 60000,
      ),
    });

    return credentials.access_token;
  }

  /**
   * Get viewer token (public, read-only)
   */
  async getViewerToken() {
    return await this.twoLeggedClient.authenticate();
  }

  /**
   * Get authorization URL for 3-legged OAuth
   */
  getAuthorizationUrl(state?: string): string {
    const url = this.threeLeggedClient.generateAuthUrl();
    // Replace the state=undefined injected by forge-apis SDK with a real CSRF token
    if (state) {
      return url.replace(/state=undefined/, `state=${encodeURIComponent(state)}`);
    }
    // Remove state=undefined if no state provided
    return url.replace(/[&?]state=undefined/, '');
  }

  /**
   * Get 3-legged token (for user operations)
   */
  async getPublicToken(code: string) {
    return await this.threeLeggedClient.getToken(code);
  }

  /**
   * Refresh 3-legged access token
   */
  async refreshPublicToken(refreshToken: string) {
    const credentials = this.threeLeggedClient.refreshToken({ refreshToken });
    return credentials;
  }

  /**
   * Get User Profile from Autodesk
   */
  async getUserProfile(accessToken: string) {
    // Method 1: Try SDK first (Standard way)
    try {
      const api = new UserProfileApi();
      const response = await api.getUserProfile(this.threeLeggedClient, {
        access_token: accessToken,
      });
      return response.body;
    } catch (sdkError: unknown) {
      const err = sdkError as { message?: string };
      logger.warn(
        "[APS_AUTH] SDK getUserProfile failed, trying direct API call",
        {
          error: err.message || "Unknown error",
        },
      );

      // Method 2: Try Direct Axios call (Fallback)
      try {
        const response = await axios.get(
          "https://api.userprofile.autodesk.com/user/v1/users/@me",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        return response.data;
      } catch (axiosError: unknown) {
        const axErr = axiosError as { message?: string };
        const sdkErr = sdkError as { message?: string };
        logger.error("[APS_AUTH] Both SDK and direct API calls failed", {
          sdk: sdkErr.message || "Unknown SDK error",
          axios: axErr.message || "Unknown axios error",
        });
        throw new Error(
          `Both SDK and Direct calls failed. SDK: ${sdkErr.message || "Unknown"}. Axios: ${axErr.message || "Unknown"}`,
        );
      }
    }
  }
}

// Conditional: use mock when APS_MOCK=true
import { MockAPSAuthService } from "../../mocks/aps-mock";

export const apsAuthService: APSAuthService = env.APS_MOCK
  ? (new MockAPSAuthService() as unknown as APSAuthService)
  : new APSAuthService();

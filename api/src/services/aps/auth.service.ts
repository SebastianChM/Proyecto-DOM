import {
  AuthClientTwoLegged,
  AuthClientThreeLegged,
  UserProfileApi,
} from "forge-apis";
import axios from "axios";

export class APSAuthService {
  private twoLeggedClient: any;
  private threeLeggedClient: any;

  constructor() {
    const clientId = process.env.APS_CLIENT_ID;
    const clientSecret = process.env.APS_CLIENT_SECRET;
    const callbackUrl = process.env.APS_CALLBACK_URL;

    if (!clientId || !clientSecret || !callbackUrl) {
      console.warn(
        "APS credentials missing. Auth service will not work correctly.",
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
   */
  async getInternalToken(): Promise<string> {
    const credentials = await this.twoLeggedClient.authenticate();
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
  getAuthorizationUrl(): string {
    return this.threeLeggedClient.generateAuthUrl();
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
    } catch (sdkError: any) {
      console.warn(
        "SDK getUserProfile failed, trying direct API call:",
        sdkError.message,
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
      } catch (axiosError: any) {
        console.error("Both SDK and direct API calls failed:", {
          sdk: sdkError.message,
          axios: axiosError.message,
        });
        throw new Error(
          `Both SDK and Direct calls failed. SDK: ${sdkError.message}. Axios: ${axiosError.message}`,
        );
      }
    }
  }
}

export const apsAuthService = new APSAuthService();

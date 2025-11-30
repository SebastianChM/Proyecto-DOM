import { AuthClientTwoLegged, AuthClientThreeLegged } from 'forge-apis';
import axios from 'axios';

export class APSAuthService {
    private twoLeggedClient: any;
    private threeLeggedClient: any;

    constructor() {
        const clientId = process.env.APS_CLIENT_ID;
        const clientSecret = process.env.APS_CLIENT_SECRET;
        const callbackUrl = process.env.APS_CALLBACK_URL;

        if (!clientId || !clientSecret || !callbackUrl) {
            console.warn('APS credentials missing. Auth service will not work correctly.');
        }

        this.twoLeggedClient = new AuthClientTwoLegged(
            clientId!,
            clientSecret!,
            ['data:read', 'data:write', 'data:create', 'bucket:read', 'bucket:create', 'bucket:delete', 'code:all'],
            true
        );

        this.threeLeggedClient = new AuthClientThreeLegged(
            clientId!,
            clientSecret!,
            callbackUrl!,
            ['data:read', 'data:write', 'user:read'],
            true
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
        try {
            const response = await axios.get('https://api.userprofile.autodesk.com/user/v1/users/@me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Failed to get user profile:', error);
            throw new Error('Failed to get user profile');
        }
    }
}

export const apsAuthService = new APSAuthService();

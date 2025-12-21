/**
 * Token Resolver
 * Central module for resolving correct APS tokens
 *  
 * Hito 2.2: Separate internal (2-legged) and user (3-legged) tokens
 */

import { Request } from "express";
import { apsAuthService } from "./auth.service";
import { ApsError, ApsErrorCode } from "./aps-error";

/**
 * Get user access token from session
 * Throws APS_REFRESH_REQUIRED if session invalid or expired
 */
export async function getUserAccessToken(req: Request): Promise<string> {
    if (!req.session || !req.session.token) {
        throw new ApsError(
            ApsErrorCode.APS_REFRESH_REQUIRED,
            401,
            "User session required. Please re-authenticate.",
        );
    }

    // Check if token is expired
    if (req.session.expiresAt && Date.now() > req.session.expiresAt) {
        throw new ApsError(
            ApsErrorCode.APS_REFRESH_REQUIRED,
            401,
            "Session expired. Please re-authenticate.",
        );
    }

    return req.session.token;
}

/**
 * Get internal (2-legged) access token
 * Used for server operations without user context
 */
export async function getInternalAccessToken(): Promise<string> {
    try {
        return await apsAuthService.getInternalToken();
    } catch (error) {
        throw ApsError.fromUpstream(error);
    }
}

/**
 * Determine if request has valid user session
 */
export function hasUserSession(req: Request): boolean {
    return !!(
        req.session?.token &&
        req.session?.expiresAt &&
        Date.now() < req.session.expiresAt
    );
}

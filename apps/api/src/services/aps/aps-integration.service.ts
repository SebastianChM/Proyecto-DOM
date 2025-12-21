/**
 * APS Integration Service
 * Central service for all APS operations
 * 
 * Hito 2.1: Centralize APS integration with:
 * - Token management (with refresh)
 * - Rate limiting
 * - Redis caching (with stampede prevention)
 * - Normalized error handling
 */

import { Request } from "express";
import { apsDataManagementService } from "./data-management.service";
import { tokenRefreshService } from "./token-refresh.service";
import { apsOutboundRateLimiter } from "./aps-outbound-rate-limit";
import {
    apsCacheService,
    ApsCacheKeys,
    ApsCacheOptions,
} from "./aps-cache";
import { ApsError } from "./aps-error";

export class ApsIntegrationService {
    /**
     * Get hubs for authenticated user
     * Uses cache, rate limiting, and token refresh
     */
    async getHubsForUser(
        req: Request,
        options: ApsCacheOptions = {},
    ): Promise<unknown> {
        // 1. Ensure valid token (refresh if needed)
        const token = await tokenRefreshService.ensureValidToken(req);
        const userId = req.session?.user?.id;
        const requestId = req.headers["x-request-id"] as string | undefined;

        if (!userId) {
            throw new ApsError(
                "APS_UNAUTHORIZED" as never,
                401,
                "User ID not found in session",
            );
        }

        // 2. Get scope for cache key
        const scope = req.session.scope || "data:read";

        // 3. Use cache with automatic deduplication
        const cacheKey = ApsCacheKeys.hubs(userId, scope, "v1");

        return await apsCacheService.getOrFetch(
            cacheKey,
            async () => {
                // Rate limiting before APS call
                await apsOutboundRateLimiter.checkUser(userId, requestId);
                await apsOutboundRateLimiter.checkGlobal(requestId);

                console.log("[APS_INTEGRATION] Fetching hubs from APS", {
                    userId: userId.substring(0, 8),
                    requestId,
                    timestamp: new Date().toISOString(),
                });

                return await apsDataManagementService.getHubs(token);
            },
            {
                ttl: options.ttl || 300, // 5 minutes default
                skipCache: options.skipCache,
            },
        );
    }

    /**
     * Get projects for a hub
     * Uses cache, rate limiting, and token refresh
     */
    async getProjectsForHub(
        req: Request,
        hubId: string,
        options: ApsCacheOptions = {},
    ): Promise<unknown> {
        // 1. Ensure valid token
        const token = await tokenRefreshService.ensureValidToken(req);
        const userId = req.session?.user?.id;
        const requestId = req.headers["x-request-id"] as string | undefined;

        if (!userId) {
            throw new ApsError(
                "APS_UNAUTHORIZED" as never,
                401,
                "User ID not found in session",
            );
        }

        // 2. Get scope for cache key
        const scope = req.session.scope || "data:read";

        // 3. Use cache with automatic deduplication
        const cacheKey = ApsCacheKeys.projects(userId, hubId, scope, "v1");

        return await apsCacheService.getOrFetch(
            cacheKey,
            async () => {
                // Rate limiting before APS call
                await apsOutboundRateLimiter.checkUser(userId, requestId);
                await apsOutboundRateLimiter.checkGlobal(requestId);

                console.log("[APS_INTEGRATION] Fetching projects from APS", {
                    userId: userId.substring(0, 8),
                    hubId: hubId.substring(0, 8),
                    requestId,
                    timestamp: new Date().toISOString(),
                });

                return await apsDataManagementService.getProjects(hubId, token);
            },
            {
                ttl: options.ttl || 300,
                skipCache: options.skipCache,
            },
        );
    }

    /**
     * Get folder contents
     * Uses cache, rate limiting, and token refresh
     */
    async getFolderContents(
        req: Request,
        projectId: string,
        folderId: string,
        options: ApsCacheOptions = {},
    ): Promise<unknown> {
        // 1. Ensure valid token
        const token = await tokenRefreshService.ensureValidToken(req);
        const userId = req.session?.user?.id;
        const requestId = req.headers["x-request-id"] as string | undefined;

        if (!userId) {
            throw new ApsError(
                "APS_UNAUTHORIZED" as never,
                401,
                "User ID not found in session",
            );
        }

        // 2. Get scope for cache key
        const scope = req.session.scope || "data:read";

        // 3. Use cache with automatic deduplication
        const cacheKey = ApsCacheKeys.folderContents(
            userId,
            projectId,
            folderId,
            scope,
            "v1",
        );

        return await apsCacheService.getOrFetch(
            cacheKey,
            async () => {
                // Rate limiting before APS call
                await apsOutboundRateLimiter.checkUser(userId, requestId);
                await apsOutboundRateLimiter.checkGlobal(requestId);

                console.log("[APS_INTEGRATION] Fetching folder contents from APS", {
                    userId: userId.substring(0, 8),
                    projectId: projectId.substring(0, 8),
                    folderId: folderId.substring(0, 8),
                    requestId,
                    timestamp: new Date().toISOString(),
                });

                return await apsDataManagementService.getFolderContents(
                    projectId,
                    folderId,
                    token,
                );
            },
            {
                ttl: options.ttl || 60, // 1 minute for folder contents
                skipCache: options.skipCache,
            },
        );
    }

    /**
     * Invalidate cache for a user
     */
    async invalidateUserCache(userId: string): Promise<void> {
        await apsCacheService.invalidatePattern(`aps:*:*:*:user:${userId}:*`);
        console.log("[APS_INTEGRATION] Cache invalidated for user", {
            userId: userId.substring(0, 8),
            timestamp: new Date().toISOString(),
        });
    }
}

export const apsIntegrationService = new ApsIntegrationService();

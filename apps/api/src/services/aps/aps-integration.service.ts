/**
 * APS Integration Service
 * Central service for all APS operations
 * 
 * Hito 2.1: Centralize APS integration with:
 * - Token management
 * - Rate limiting
 * - Redis caching
 * - Normalized error handling
 */

import { Request } from "express";
import { apsDataManagementService } from "./data-management.service";
import { getUserAccessToken } from "./token-resolver";
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
     * Uses cache and rate limiting
     */
    async getHubsForUser(
        req: Request,
        options: ApsCacheOptions = {},
    ): Promise<unknown> {
        // 1. Get user token (throws if session invalid)
        const token = await getUserAccessToken(req);
        const userId = req.session?.user?.id;

        if (!userId) {
            throw new ApsError(
                "APS_UNAUTHORIZED" as never,
                401,
                "User ID not found in session",
            );
        }

        // 2. Check cache
        if (!options.skipCache) {
            const cacheKey = ApsCacheKeys.hubs(userId);

            // Check if marked as not found
            if (await apsCacheService.isNotFound(cacheKey)) {
                throw new ApsError(
                    "APS_NOT_FOUND" as never,
                    404,
                    "Hubs not found (cached)",
                );
            }

            const cached = await apsCacheService.get(cacheKey);
            if (cached) {
                console.log("[APS_INTEGRATION] Cache hit: hubs", {
                    userId: userId.substring(0, 8),
                    requestId: req.headers["x-request-id"],
                });
                return cached;
            }
        }

        // 3. Apply rate limiting
        await apsOutboundRateLimiter.checkUser(userId);
        await apsOutboundRateLimiter.checkGlobal();

        // 4. Call APS
        try {
            console.log("[APS_INTEGRATION] Fetching hubs from APS", {
                userId: userId.substring(0, 8),
                requestId: req.headers["x-request-id"],
            });

            const hubs = await apsDataManagementService.getHubs(token);

            // 5. Cache successful response
            const cacheKey = ApsCacheKeys.hubs(userId);
            await apsCacheService.set(cacheKey, hubs, {
                ttl: options.ttl || 300, // 5 minutes default
            });

            return hubs;
        } catch (error) {
            // 6. Map to normalized error
            const apsError = ApsError.fromUpstream(error);

            // Cache 404s with short TTL
            if (apsError.status === 404) {
                const cacheKey = ApsCacheKeys.hubs(userId);
                await apsCacheService.setNotFound(cacheKey);
            }

            throw apsError;
        }
    }

    /**
     * Get projects for a hub
     * Uses cache and rate limiting
     */
    async getProjectsForHub(
        req: Request,
        hubId: string,
        options: ApsCacheOptions = {},
    ): Promise<unknown> {
        // 1. Get user token
        const token = await getUserAccessToken(req);
        const userId = req.session?.user?.id;

        if (!userId) {
            throw new ApsError(
                "APS_UNAUTHORIZED" as never,
                401,
                "User ID not found in session",
            );
        }

        // 2. Check cache
        if (!options.skipCache) {
            const cacheKey = ApsCacheKeys.projects(userId, hubId);

            if (await apsCacheService.isNotFound(cacheKey)) {
                throw new ApsError(
                    "APS_NOT_FOUND" as never,
                    404,
                    "Projects not found (cached)",
                );
            }

            const cached = await apsCacheService.get(cacheKey);
            if (cached) {
                console.log("[APS_INTEGRATION] Cache hit: projects", {
                    userId: userId.substring(0, 8),
                    hubId: hubId.substring(0, 8),
                    requestId: req.headers["x-request-id"],
                });
                return cached;
            }
        }

        // 3. Apply rate limiting
        await apsOutboundRateLimiter.checkUser(userId);
        await apsOutboundRateLimiter.checkGlobal();

        // 4. Call APS
        try {
            console.log("[APS_INTEGRATION] Fetching projects from APS", {
                userId: userId.substring(0, 8),
                hubId: hubId.substring(0, 8),
                requestId: req.headers["x-request-id"],
            });

            const projects = await apsDataManagementService.getProjects(
                hubId,
                token,
            );

            // 5. Cache successful response
            const cacheKey = ApsCacheKeys.projects(userId, hubId);
            await apsCacheService.set(cacheKey, projects, {
                ttl: options.ttl || 300,
            });

            return projects;
        } catch (error) {
            const apsError = ApsError.fromUpstream(error);

            if (apsError.status === 404) {
                const cacheKey = ApsCacheKeys.projects(userId, hubId);
                await apsCacheService.setNotFound(cacheKey);
            }

            throw apsError;
        }
    }

    /**
     * Get folder contents
     * Uses cache and rate limiting
     */
    async getFolderContents(
        req: Request,
        projectId: string,
        folderId: string,
        options: ApsCacheOptions = {},
    ): Promise<unknown> {
        // 1. Get user token
        const token = await getUserAccessToken(req);
        const userId = req.session?.user?.id;

        if (!userId) {
            throw new ApsError(
                "APS_UNAUTHORIZED" as never,
                401,
                "User ID not found in session",
            );
        }

        // 2. Check cache
        if (!options.skipCache) {
            const cacheKey = ApsCacheKeys.folderContents(userId, projectId, folderId);

            if (await apsCacheService.isNotFound(cacheKey)) {
                throw new ApsError(
                    "APS_NOT_FOUND" as never,
                    404,
                    "Folder contents not found (cached)",
                );
            }

            const cached = await apsCacheService.get(cacheKey);
            if (cached) {
                console.log("[APS_INTEGRATION] Cache hit: folder", {
                    userId: userId.substring(0, 8),
                    projectId: projectId.substring(0, 8),
                    folderId: folderId.substring(0, 8),
                    requestId: req.headers["x-request-id"],
                });
                return cached;
            }
        }

        // 3. Apply rate limiting
        await apsOutboundRateLimiter.checkUser(userId);
        await apsOutboundRateLimiter.checkGlobal();

        // 4. Call APS
        try {
            console.log("[APS_INTEGRATION] Fetching folder contents from APS", {
                userId: userId.substring(0, 8),
                projectId: projectId.substring(0, 8),
                folderId: folderId.substring(0, 8),
                requestId: req.headers["x-request-id"],
            });

            const contents = await apsDataManagementService.getFolderContents(
                projectId,
                folderId,
                token,
            );

            // 5. Cache successful response
            const cacheKey = ApsCacheKeys.folderContents(userId, projectId, folderId);
            await apsCacheService.set(cacheKey, contents, {
                ttl: options.ttl || 60, // 1 minute for folder contents
            });

            return contents;
        } catch (error) {
            const apsError = ApsError.fromUpstream(error);

            if (apsError.status === 404) {
                const cacheKey = ApsCacheKeys.folderContents(
                    userId,
                    projectId,
                    folderId,
                );
                await apsCacheService.setNotFound(cacheKey);
            }

            throw apsError;
        }
    }

    /**
     * Invalidate cache for a user
     */
    async invalidateUserCache(userId: string): Promise<void> {
        await apsCacheService.invalidatePattern(`aps:*:user:${userId}:*`);
        console.log("[APS_INTEGRATION] Cache invalidated for user", {
            userId: userId.substring(0, 8),
        });
    }
}

export const apsIntegrationService = new ApsIntegrationService();

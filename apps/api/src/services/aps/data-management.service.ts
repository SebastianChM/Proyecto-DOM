import {
  HubsApi,
  ProjectsApi,
  FoldersApi,
  ItemsApi,
  VersionsApi,
} from "forge-apis";
import { logger } from "../../lib/logger";

interface ApsAttributes {
  name: string;
  displayName?: string;
  region?: string;
  lastModifiedTime?: string;
  versionNumber?: number;
  fileType?: string;
  storageSize?: number;
  createTime?: string;
  createUserId?: string;
  createUserName?: string;
}

interface ApsRelationships {
  tip?: { data?: { id?: string } };
  rootFolder?: { data?: { id?: string } };
  storage?: { meta?: { link?: { href?: string } } };
}

interface ApsResource {
  id: string;
  type: string;
  attributes: ApsAttributes;
  relationships?: ApsRelationships;
}

class ApsDataManagementService {
  // Using any for API instances to avoid namespace collision issues with forge-apis types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hubsApi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private projectsApi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private foldersApi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private itemsApi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private versionsApi: any;

  constructor() {
    this.hubsApi = new HubsApi();
    this.projectsApi = new ProjectsApi();
    this.foldersApi = new FoldersApi();
    this.itemsApi = new ItemsApi();
    this.versionsApi = new VersionsApi();
  }

  /**
   * Get all Hubs accessible by the user (2-legged or 3-legged token)
   */
  async getHubs(accessToken: string) {
    try {
      logger.debug("[APS_DM] getHubs called");
      const response = await this.hubsApi.getHubs(
        null,
        null,
        this.getAuth(accessToken) as never,
      );

      return response.body.data.map((hub: ApsResource) => ({
        id: hub.id,
        name: hub.attributes.name,
        region: hub.attributes.region,
      }));
    } catch (error) {
      logger.error("[APS_DM] Error fetching hubs", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get projects for a specific Hub
   */
  async getProjects(hubId: string, accessToken: string) {
    try {
      const response = await this.projectsApi.getHubProjects(
        hubId,
        null,
        null,
        this.getAuth(accessToken) as never,
      );
      return response.body.data.map((project: ApsResource) => ({
        id: project.id,
        name: project.attributes.name,
        rootFolderId: project.relationships?.rootFolder?.data?.id,
      }));
    } catch (error) {
      logger.error("[APS_DM] Error fetching projects", {
        hubId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get contents of a folder (subfolders and items)
   */
  async getFolderContents(
    projectId: string,
    folderId: string,
    accessToken: string,
  ) {
    try {
      // Note: getFolderContents usually takes (projectId, folderId, filter, oauth, creds)
      const response = await this.foldersApi.getFolderContents(
        projectId,
        folderId,
        null,
        null,
        this.getAuth(accessToken) as never,
      );

      const contents = response.body.data.map((item: ApsResource) => {
        const isFolder = item.type === "folders";
        return {
          id: item.id,
          name: item.attributes.displayName || item.attributes.name, // Display name is safer
          type: item.type, // 'folders' or 'items'
          // For items, get version info
          versionId: isFolder ? null : item.relationships?.tip?.data?.id,
          lastModified: item.attributes.lastModifiedTime,
        };
      });

      return contents;
    } catch (error) {
      logger.error("[APS_DM] Error fetching folder contents", {
        folderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get versions of an item
   */
  async getItemVersions(
    projectId: string,
    itemId: string,
    accessToken: string,
  ) {
    try {
      const response = await this.itemsApi.getItemVersions(
        projectId,
        itemId,
        null,
        null,
        this.getAuth(accessToken) as never,
      );
      return response.body.data.map((version: ApsResource) => ({
        id: version.id,
        name: version.attributes.displayName || version.attributes.name,
        baseVersion: version.attributes.versionNumber,
        lastModified: version.attributes.lastModifiedTime,
        urn: version.relationships?.storage?.meta?.link?.href,
      }));
    } catch (error) {
      logger.error("[APS_DM] Error fetching versions", {
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return []; // Return empty array on error to prevent crash
    }
  }

  /**
   * Get specific version details
   */
  async getVersion(projectId: string, versionId: string, accessToken: string) {
    try {
      const response = await this.versionsApi.getVersion(
        projectId,
        versionId,
        null,
        this.getAuth(accessToken) as never,
      );
      const data = response.body.data as ApsResource;
      return {
        id: data.id,
        name: data.attributes.displayName || data.attributes.name,
        fileName: data.attributes.name, // The actual filename
        fileType: data.attributes.fileType,
        versionNumber: data.attributes.versionNumber,
        lastModified: data.attributes.lastModifiedTime,
        storageSize: data.attributes.storageSize, // Might be undefined depending on file type
        createTime: data.attributes.createTime,
        createUserId: data.attributes.createUserId,
        createUserName: data.attributes.createUserName,
        urn: data.relationships?.storage?.meta?.link?.href,
      };
    } catch (error) {
      logger.error("[APS_DM] Error fetching version", {
        versionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get download URL for an item (latest version)
   * Returns the storage URL that can be used to download the file
   */
  async getItemDownloadUrl(
    projectId: string,
    itemId: string,
    accessToken: string,
  ): Promise<string | null> {
    try {
      // Get the latest version of the item
      const versions = await this.getItemVersions(
        projectId,
        itemId,
        accessToken,
      );

      if (versions.length === 0) {
        logger.warn("[APS_DM] No versions found for item", { itemId });
        return null;
      }

      // Get the most recent version (first in the array)
      const latestVersion = versions[0];

      // The urn field contains the storage URL
      if (latestVersion.urn) {
        return latestVersion.urn;
      }

      // If urn is not in the versions response, try to get version details
      const versionDetails = await this.getVersion(
        projectId,
        latestVersion.id,
        accessToken,
      );
      return versionDetails.urn || null;
    } catch (error) {
      logger.error("[APS_DM] Error getting download URL", {
        itemId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Helper to wrap token for forge-apis calls
   */
  private getAuth(token: string) {
    return {
      access_token: token,
    }; // forge-apis expects object or OAuth2 object, passing simple object often works or need null as second arg depending on version.
    // Actually forge-apis calls usually take (hubId, queryParams, oauth2client, credentials)
    // If we don't have oauth2client instance, we can pass { access_token: token } as credentials
    // Let's verify the signature.
    // getHubs(opts, oauth2client, credentials)
  }
}

export const apsDataManagementService = new ApsDataManagementService();

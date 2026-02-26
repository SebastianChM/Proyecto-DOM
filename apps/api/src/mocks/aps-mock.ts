/**
 * APS Mock Services
 *
 * Provides mock implementations of all Autodesk Platform Services (APS) for
 * local development and testing without real Autodesk credentials.
 *
 * Activated by: APS_MOCK=true in environment
 * Safety: Cannot be enabled in production (enforced by env.ts)
 *
 * Each mock class mirrors the public API of its real counterpart so the
 * conditional export in the service files is transparent to consumers.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_TOKEN = "mock-aps-access-token-for-development";
const MOCK_EXPIRES_IN = 3599; // seconds (≈1 hour)

// ---------------------------------------------------------------------------
// Mock APS Auth Service  (mirrors APSAuthService)
// ---------------------------------------------------------------------------

export class MockAPSAuthService {
  async getInternalToken(): Promise<string> {
    logger.debug("[APS_MOCK] getInternalToken → mock token");
    return MOCK_TOKEN;
  }

  async getViewerToken() {
    logger.debug("[APS_MOCK] getViewerToken → mock credentials");
    return {
      access_token: MOCK_TOKEN,
      token_type: "Bearer",
      expires_in: MOCK_EXPIRES_IN,
    };
  }

  getAuthorizationUrl(): string {
    return "http://localhost:8080/api/auth/mock-callback?code=mock-code";
  }

  async getPublicToken(_code: string) {
    return {
      access_token: `mock-user-token-${Date.now()}`,
      token_type: "Bearer",
      expires_in: MOCK_EXPIRES_IN,
      refresh_token: "mock-refresh-token",
    };
  }

  async refreshPublicToken(_refreshToken: string) {
    return {
      access_token: `mock-refreshed-token-${Date.now()}`,
      token_type: "Bearer",
      expires_in: MOCK_EXPIRES_IN,
      refresh_token: "mock-refresh-token-new",
    };
  }

  async getUserProfile(_accessToken: string) {
    return {
      userId: "mock-user-001",
      userName: "Mock Developer",
      emailId: "dev@dom.mock",
      firstName: "Mock",
      lastName: "Developer",
      profileImages: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Mock Viewer Token Service  (mirrors ViewerTokenService)
// ---------------------------------------------------------------------------

export class MockViewerTokenService {
  async getViewerToken(requestId?: string) {
    logger.debug("[APS_MOCK] MockViewerTokenService.getViewerToken");
    return {
      access_token: MOCK_TOKEN,
      token_type: "Bearer",
      expires_in: MOCK_EXPIRES_IN,
      expires_at: Date.now() + MOCK_EXPIRES_IN * 1000,
      requestId,
    };
  }
}

// ---------------------------------------------------------------------------
// Mock Data Management Service  (mirrors ApsDataManagementService)
// ---------------------------------------------------------------------------

export class MockApsDataManagementService {
  async getHubs(_accessToken: string) {
    logger.debug("[APS_MOCK] getHubs → fixture");
    return [
      {
        id: "b.mock-hub-001",
        name: "DOM Mock Hub",
        region: "US",
      },
    ];
  }

  async getProjects(_hubId: string, _accessToken: string) {
    logger.debug("[APS_MOCK] getProjects → fixture");
    return [
      {
        id: "b.mock-project-001",
        name: "Mock BIM Project",
        rootFolderId: "urn:adsk.wipprod:fs.folder:mock-root-folder",
      },
    ];
  }

  async getFolderContents(
    _projectId: string,
    _folderId: string,
    _accessToken: string,
  ) {
    logger.debug("[APS_MOCK] getFolderContents → empty");
    return [];
  }

  async getItemVersions(
    _projectId: string,
    _itemId: string,
    _accessToken: string,
  ) {
    logger.debug("[APS_MOCK] getItemVersions → empty");
    return [];
  }

  async getVersion(
    _projectId: string,
    _versionId: string,
    _accessToken: string,
  ) {
    logger.debug("[APS_MOCK] getVersion → fixture");
    return {
      id: _versionId,
      name: "mock-version.rvt",
      fileName: "mock-version.rvt",
      fileType: "rvt",
      versionNumber: 1,
      lastModified: new Date().toISOString(),
      storageSize: 1024,
      createTime: new Date().toISOString(),
      createUserId: "mock-user-001",
      createUserName: "Mock Developer",
      urn: null,
    };
  }

  async getItemDownloadUrl(
    _projectId: string,
    _itemId: string,
    _accessToken: string,
  ): Promise<string | null> {
    logger.debug("[APS_MOCK] getItemDownloadUrl → null");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mock Model Derivative Service  (mirrors APSModelDerivativeService)
// ---------------------------------------------------------------------------

export class MockAPSModelDerivativeService {
  async deleteManifest(_urn: string): Promise<boolean> {
    logger.debug("[APS_MOCK] deleteManifest → true");
    return true;
  }

  async getFormats() {
    logger.debug("[APS_MOCK] getFormats → fixture");
    return {
      formats: {
        svf2: { name: "SVF2", extensions: ["rvt", "dwg", "ifc", "nwd"] },
        obj: { name: "OBJ", extensions: ["rvt", "dwg"] },
        step: { name: "STEP", extensions: ["rvt"] },
        iges: { name: "IGES", extensions: ["rvt"] },
      },
    };
  }

  async translateToSVF2(_urn: string) {
    logger.debug("[APS_MOCK] translateToSVF2 → fixture");
    return {
      result: "success",
      urn: _urn,
      acceptedJobs: {
        output: { formats: [{ type: "svf2", views: ["2d", "3d"] }] },
      },
    };
  }

  async translateToPDF(_urn: string) {
    logger.debug("[APS_MOCK] translateToPDF → fixture");
    return {
      result: "success",
      urn: _urn,
      acceptedJobs: { output: { formats: [{ type: "pdf" }] } },
    };
  }

  async translateToIFC(_urn: string) {
    logger.debug("[APS_MOCK] translateToIFC → fixture");
    return {
      result: "success",
      urn: _urn,
      acceptedJobs: { output: { formats: [{ type: "ifc" }] } },
    };
  }

  async getManifest(_urn: string) {
    logger.debug("[APS_MOCK] getManifest → fixture");
    return {
      type: "manifest",
      hasThumbnail: "true",
      status: "success",
      progress: "complete",
      region: "US",
      urn: _urn,
      derivatives: [
        {
          name: "mock-model",
          hasThumbnail: "true",
          status: "success",
          progress: "complete",
          outputType: "svf2",
        },
      ],
    };
  }

  async getMetadata(_urn: string) {
    logger.debug("[APS_MOCK] getMetadata → fixture");
    return { data: { metadata: [] } };
  }

  async getProperties(_urn: string, _guid: string) {
    logger.debug("[APS_MOCK] getProperties → fixture");
    return { data: { collection: [] } };
  }

  async getObjectTree(_urn: string, _guid: string) {
    logger.debug("[APS_MOCK] getObjectTree → fixture");
    return { data: { objects: [] } };
  }

  async getAllModelProperties(_urn: string) {
    logger.debug("[APS_MOCK] getAllModelProperties → fixture");
    return { data: { collection: [] } };
  }

  async getDerivativeDownloadInfo(
    _urn: string,
    _derivativeUrn: string,
  ): Promise<{ url: string; headers: Record<string, string> }> {
    logger.debug("[APS_MOCK] getDerivativeDownloadInfo → fixture");
    return {
      url: `http://localhost:8080/mock/derivative/${_derivativeUrn}`,
      headers: {},
    };
  }

  async getDerivative(_urn: string, _derivativeUrn: string): Promise<Buffer> {
    logger.debug("[APS_MOCK] getDerivative → empty buffer");
    return Buffer.alloc(0);
  }
}

// ---------------------------------------------------------------------------
// Mock OSS Service  (mirrors ApsOssService)
// ---------------------------------------------------------------------------

export class MockApsOssService {
  private bucketKey = "dom-bim-mock";

  async ensureBucketExists() {
    logger.debug("[APS_MOCK] ensureBucketExists → mock");
    return { bucketKey: this.bucketKey, policyKey: "transient" };
  }

  async copyObject(_objectName: string, newObjectName: string) {
    logger.debug("[APS_MOCK] copyObject → fixture");
    return {
      objectId: `urn:adsk.objects:os.object:${this.bucketKey}/${newObjectName}`,
    };
  }

  async uploadObject(_buffer: Buffer, filename: string) {
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectName = `${Date.now()}-${safeFilename}`;
    logger.debug("[APS_MOCK] uploadObject → fixture", { objectName });
    return {
      objectId: `urn:adsk.objects:os.object:${this.bucketKey}/${objectName}`,
      objectKey: objectName,
      size: _buffer.length,
    };
  }

  async uploadStream(
    _stream: unknown,
    filename: string,
    _contentLength: number,
  ) {
    return this.uploadObject(Buffer.alloc(0), filename);
  }

  async uploadBuffer(buffer: Buffer, filename: string) {
    return this.uploadObject(buffer, filename);
  }

  async uploadFile(file: { originalname: string; size: number; path: string }) {
    return this.uploadObject(Buffer.alloc(file.size || 0), file.originalname);
  }

  async getObjectDetails(_objectName: string) {
    logger.debug("[APS_MOCK] getObjectDetails → fixture");
    return {
      objectId: `urn:adsk.objects:os.object:${this.bucketKey}/${_objectName}`,
      objectKey: _objectName,
      size: 1024,
      contentType: "application/octet-stream",
    };
  }

  async getSignedUrl(_objectName: string) {
    logger.debug("[APS_MOCK] getSignedUrl → fixture");
    return `http://localhost:8080/mock/download/${_objectName}`;
  }

  async getSignedWriteUrl(_objectName: string) {
    logger.debug("[APS_MOCK] getSignedWriteUrl → fixture");
    return `http://localhost:8080/mock/upload/${_objectName}`;
  }

  getDerivativeUrn(storageId: string): string {
    return Buffer.from(storageId)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  decodeUrn(urn: string): string {
    const padded = urn.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padding);
    return Buffer.from(base64, "base64").toString("utf-8");
  }
}

// ---------------------------------------------------------------------------
// Mock APS Integration Service  (mirrors ApsIntegrationService)
// ---------------------------------------------------------------------------

export class MockApsIntegrationService {
  async getHubsForUser(): Promise<unknown> {
    logger.debug("[APS_MOCK] getHubsForUser → fixture");
    return [
      {
        id: "b.mock-hub-001",
        name: "DOM Mock Hub",
        region: "US",
      },
    ];
  }

  async getProjectsForHub(): Promise<unknown> {
    logger.debug("[APS_MOCK] getProjectsForHub → fixture");
    return [
      {
        id: "b.mock-project-001",
        name: "Mock BIM Project",
      },
    ];
  }

  async getFolderContents(): Promise<unknown> {
    logger.debug("[APS_MOCK] getFolderContents → empty");
    return [];
  }

  async invalidateUserCache(_userId: string): Promise<void> {
    // no-op
  }
}

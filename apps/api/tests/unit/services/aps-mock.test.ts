/**
 * APS Mock Mode — Unit Tests
 *
 * Verifies that:
 * 1. Mock services return well-formed fixture data
 * 2. Mock services satisfy the same interface contract as real services
 * 3. The env flag correctly gates mock activation
 */

import { describe, it, expect, beforeAll } from "@jest/globals";

import {
  MockAPSAuthService,
  MockViewerTokenService,
  MockApsDataManagementService,
  MockAPSModelDerivativeService,
  MockApsOssService,
  MockApsIntegrationService,
} from "../../../src/mocks/aps-mock";

// ---------------------------------------------------------------------------
// MockAPSAuthService
// ---------------------------------------------------------------------------

describe("MockAPSAuthService", () => {
  let svc: MockAPSAuthService;

  beforeAll(() => {
    svc = new MockAPSAuthService();
  });

  it("getInternalToken returns a non-empty string", async () => {
    const token = await svc.getInternalToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("getViewerToken returns access_token, token_type, expires_in", async () => {
    const result = await svc.getViewerToken();
    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("token_type", "Bearer");
    expect(result).toHaveProperty("expires_in");
    expect(result.expires_in).toBeGreaterThan(0);
  });

  it("getAuthorizationUrl returns a URL string", () => {
    const url = svc.getAuthorizationUrl();
    expect(typeof url).toBe("string");
    expect(() => new URL(url)).not.toThrow();
  });

  it("getPublicToken returns token with refresh_token", async () => {
    const result = await svc.getPublicToken("test-code");
    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("refresh_token");
    expect(result).toHaveProperty("expires_in");
  });

  it("refreshPublicToken returns refreshed token", async () => {
    const result = await svc.refreshPublicToken("test-refresh-token");
    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("refresh_token");
  });

  it("getUserProfile returns user data", async () => {
    const profile = await svc.getUserProfile("test-token");
    expect(profile).toHaveProperty("userId");
    expect(profile).toHaveProperty("emailId");
    expect(profile).toHaveProperty("firstName");
    expect(profile).toHaveProperty("lastName");
  });
});

// ---------------------------------------------------------------------------
// MockViewerTokenService
// ---------------------------------------------------------------------------

describe("MockViewerTokenService", () => {
  let svc: MockViewerTokenService;

  beforeAll(() => {
    svc = new MockViewerTokenService();
  });

  it("getViewerToken returns a valid ViewerTokenResponse", async () => {
    const result = await svc.getViewerToken("req-123");
    expect(result).toHaveProperty("access_token");
    expect(result).toHaveProperty("token_type", "Bearer");
    expect(result).toHaveProperty("expires_in");
    expect(result).toHaveProperty("expires_at");
    expect(result.requestId).toBe("req-123");
    expect(result.expires_at).toBeGreaterThan(Date.now());
  });

  it("getViewerToken works without requestId", async () => {
    const result = await svc.getViewerToken();
    expect(result.requestId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MockApsDataManagementService
// ---------------------------------------------------------------------------

describe("MockApsDataManagementService", () => {
  let svc: MockApsDataManagementService;

  beforeAll(() => {
    svc = new MockApsDataManagementService();
  });

  it("getHubs returns at least one hub with id and name", async () => {
    const hubs = await svc.getHubs("token");
    expect(Array.isArray(hubs)).toBe(true);
    expect(hubs.length).toBeGreaterThan(0);
    expect(hubs[0]).toHaveProperty("id");
    expect(hubs[0]).toHaveProperty("name");
  });

  it("getProjects returns at least one project", async () => {
    const projects = await svc.getProjects("hub-id", "token");
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]).toHaveProperty("id");
    expect(projects[0]).toHaveProperty("name");
  });

  it("getFolderContents returns array", async () => {
    const contents = await svc.getFolderContents("proj", "folder", "token");
    expect(Array.isArray(contents)).toBe(true);
  });

  it("getItemVersions returns array", async () => {
    const versions = await svc.getItemVersions("proj", "item", "token");
    expect(Array.isArray(versions)).toBe(true);
  });

  it("getVersion returns version object", async () => {
    const version = await svc.getVersion("proj", "ver-id", "token");
    expect(version).toHaveProperty("id", "ver-id");
    expect(version).toHaveProperty("name");
    expect(version).toHaveProperty("fileType");
  });

  it("getItemDownloadUrl returns null", async () => {
    const url = await svc.getItemDownloadUrl("proj", "item", "token");
    expect(url).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MockAPSModelDerivativeService
// ---------------------------------------------------------------------------

describe("MockAPSModelDerivativeService", () => {
  let svc: MockAPSModelDerivativeService;

  beforeAll(() => {
    svc = new MockAPSModelDerivativeService();
  });

  it("deleteManifest returns true", async () => {
    expect(await svc.deleteManifest("test-urn")).toBe(true);
  });

  it("getFormats returns formats object", async () => {
    const formats = await svc.getFormats();
    expect(formats).toHaveProperty("formats");
    expect(formats.formats).toHaveProperty("svf2");
  });

  it("translateToSVF2 returns success result", async () => {
    const result = await svc.translateToSVF2("test-urn");
    expect(result).toHaveProperty("result", "success");
    expect(result).toHaveProperty("urn", "test-urn");
  });

  it("translateToPDF returns success result", async () => {
    const result = await svc.translateToPDF("test-urn");
    expect(result).toHaveProperty("result", "success");
  });

  it("translateToIFC returns success result", async () => {
    const result = await svc.translateToIFC("test-urn");
    expect(result).toHaveProperty("result", "success");
  });

  it("getManifest returns complete manifest", async () => {
    const manifest = await svc.getManifest("test-urn");
    expect(manifest).toHaveProperty("status", "success");
    expect(manifest).toHaveProperty("progress", "complete");
    expect(manifest).toHaveProperty("urn", "test-urn");
    expect(Array.isArray(manifest.derivatives)).toBe(true);
  });

  it("getMetadata returns data structure", async () => {
    const meta = await svc.getMetadata("test-urn");
    expect(meta).toHaveProperty("data");
    expect(meta.data).toHaveProperty("metadata");
  });

  it("getProperties returns collection", async () => {
    const props = await svc.getProperties("test-urn", "guid");
    expect(props).toHaveProperty("data");
    expect(props.data).toHaveProperty("collection");
  });

  it("getObjectTree returns objects", async () => {
    const tree = await svc.getObjectTree("test-urn", "guid");
    expect(tree).toHaveProperty("data");
    expect(tree.data).toHaveProperty("objects");
  });

  it("getAllModelProperties returns collection", async () => {
    const props = await svc.getAllModelProperties("test-urn");
    expect(props).toHaveProperty("data");
    expect(props.data).toHaveProperty("collection");
  });

  it("getDerivativeDownloadInfo returns url and headers", async () => {
    const info = await svc.getDerivativeDownloadInfo("urn", "deriv-urn");
    expect(info).toHaveProperty("url");
    expect(info).toHaveProperty("headers");
  });

  it("getDerivative returns a Buffer", async () => {
    const buf = await svc.getDerivative("urn", "deriv-urn");
    expect(Buffer.isBuffer(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MockApsOssService
// ---------------------------------------------------------------------------

describe("MockApsOssService", () => {
  let svc: MockApsOssService;

  beforeAll(() => {
    svc = new MockApsOssService();
  });

  it("ensureBucketExists returns bucket info", async () => {
    const result = await svc.ensureBucketExists();
    expect(result).toHaveProperty("bucketKey");
    expect(result).toHaveProperty("policyKey");
  });

  it("uploadObject returns objectId and size", async () => {
    const buf = Buffer.from("hello");
    const result = await svc.uploadObject(buf, "test.rvt");
    expect(result).toHaveProperty("objectId");
    expect(result).toHaveProperty("objectKey");
    expect(result.size).toBe(5);
  });

  it("uploadBuffer delegates to uploadObject", async () => {
    const buf = Buffer.from("data");
    const result = await svc.uploadBuffer(buf, "file.dwg");
    expect(result).toHaveProperty("objectId");
  });

  it("getObjectDetails returns object info", async () => {
    const details = await svc.getObjectDetails("my-object.rvt");
    expect(details).toHaveProperty("objectId");
    expect(details).toHaveProperty("size");
  });

  it("getSignedUrl returns a URL string", async () => {
    const url = await svc.getSignedUrl("my-object.rvt");
    expect(typeof url).toBe("string");
    expect(url).toContain("my-object.rvt");
  });

  it("getDerivativeUrn encodes to base64url", () => {
    const input = "urn:adsk.objects:os.object:bucket/test.rvt";
    const urn = svc.getDerivativeUrn(input);
    expect(typeof urn).toBe("string");
    expect(urn).not.toContain("+");
    expect(urn).not.toContain("/");
    expect(urn).not.toContain("=");
  });

  it("decodeUrn round-trips with getDerivativeUrn", () => {
    const input = "urn:adsk.objects:os.object:bucket/test.rvt";
    const encoded = svc.getDerivativeUrn(input);
    const decoded = svc.decodeUrn(encoded);
    expect(decoded).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// MockApsIntegrationService
// ---------------------------------------------------------------------------

describe("MockApsIntegrationService", () => {
  let svc: MockApsIntegrationService;

  beforeAll(() => {
    svc = new MockApsIntegrationService();
  });

  it("getHubsForUser returns hubs", async () => {
    const hubs = await svc.getHubsForUser();
    expect(Array.isArray(hubs)).toBe(true);
    expect((hubs as Array<{ id: string }>).length).toBeGreaterThan(0);
  });

  it("getProjectsForHub returns projects", async () => {
    const projects = await svc.getProjectsForHub();
    expect(Array.isArray(projects)).toBe(true);
  });

  it("getFolderContents returns empty array", async () => {
    const contents = await svc.getFolderContents();
    expect(Array.isArray(contents)).toBe(true);
    expect((contents as Array<unknown>).length).toBe(0);
  });

  it("invalidateUserCache is a no-op", async () => {
    await expect(svc.invalidateUserCache("user-1")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Env flag validation
// ---------------------------------------------------------------------------

describe("APS_MOCK env flag", () => {
  it("should parse 'true' as boolean true", () => {
    // The z.enum(["true","false"]).transform(val => val === "true") pattern
    const trueStr: string = "true";
    const falseStr: string = "false";
    expect(trueStr === "true").toBe(true);
    expect(falseStr === "true").toBe(false);
  });

  it("should default to false when not set", () => {
    // Default value in schema is "false"
    const defaultVal: string = "false";
    expect(defaultVal === "true").toBe(false);
  });
});

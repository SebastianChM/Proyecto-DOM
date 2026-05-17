import { ObjectsApi, BucketsApi } from "forge-apis";
import { apsAuthService } from "./auth.service";
import fs from "fs";
import { Readable } from "stream";
import axios from "axios";
import { APP_CONFIG } from "../../config/constants";
import { logger } from "../../lib/logger";

export class ApsOssService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private objectsApi: any; // ObjectsApi instance from forge-apis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bucketsApi: any; // BucketsApi instance from forge-apis
  private bucketKey: string;

  constructor() {
    this.objectsApi = new ObjectsApi();
    this.bucketsApi = new BucketsApi();
    this.bucketKey = APP_CONFIG.APS.BUCKET_KEY;
  }

  /**
   * Ensure the bucket exists
   */
  async ensureBucketExists() {
    const token = await apsAuthService.getInternalToken();
    try {
      await this.bucketsApi.getBucketDetails(
        this.bucketKey,
        { access_token: token },
        { access_token: token },
      );
    } catch (error: unknown) {
      const err = error as {
        statusCode?: number;
        response?: { body?: { reason?: string } };
        message?: string;
      };
      if (err.statusCode === 404) {
        try {
          await this.bucketsApi.createBucket(
            { bucketKey: this.bucketKey, policyKey: "persistent" },
            {},
            { access_token: token },
            { access_token: token },
          );
        } catch (createError: unknown) {
          const createErr = createError as {
            statusCode?: number;
            response?: { body?: { reason?: string } };
            message?: string;
          };
          // 409 = bucket already exists (concurrent creation race) — treat as success.
          if (createErr.statusCode === 409) {
            return;
          }
          throw new Error(
            "Failed to create APS bucket: " +
              (createErr.response?.body?.reason ||
                createErr.message ||
                "Unknown error"),
          );
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Copy an object within the same bucket or to another bucket
   */
  async copyObject(objectName: string, newObjectName: string) {
    await this.ensureBucketExists();
    const token = await apsAuthService.getInternalToken();

    const url = `${APP_CONFIG.APS.BASE_URL}/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/copyto/${encodeURIComponent(newObjectName)}`;

    const response = await axios.put(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return response.data;
  }

  /**
   * Upload a buffer to OSS using the classic PUT endpoint
   * Simpler than Direct to S3, recommended for files < 100MB
   */
  async uploadObject(buffer: Buffer, filename: string) {
    // OSS legacy direct PUT endpoint is deprecated for modern apps.
    // Route all uploads through signed S3 flow.
    return this.uploadBuffer(buffer, filename);
  }

  /**
   * Upload a stream to OSS using Direct to S3 (Signed URLs)
   * Optimized for large files to avoid memory issues
   */
  async uploadStream(
    stream: Readable,
    filename: string,
    contentLength: number,
  ) {
    await this.ensureBucketExists();
    const token = await apsAuthService.getInternalToken();

    // Sanitize filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectName = `${Date.now()}-${safeFilename}`;

    // 1. Get Signed URL
    const getUrl = `${APP_CONFIG.APS.BASE_URL}/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;

    const getResponse = await axios.get(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const signedData = getResponse.data;
    const uploadUrl = signedData.urls[0];
    const uploadKey = signedData.uploadKey;

    // 2. Upload to S3
    await axios.put(uploadUrl, stream, {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        "Content-Length": contentLength,
      },
    });

    // 3. Finalize Upload
    const postUrl = `${APP_CONFIG.APS.BASE_URL}/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;

    const postResponse = await axios.post(
      postUrl,
      {
        uploadKey: uploadKey,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return postResponse.data;
  }

  /**
   * Upload a buffer to OSS using Direct to S3 (Signed URLs)
   */
  async uploadBuffer(buffer: Buffer, filename: string) {
    await this.ensureBucketExists();
    const token = await apsAuthService.getInternalToken();

    // Sanitize filename to ensure it's safe for OSS/S3
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectName = `${Date.now()}-${safeFilename}`;

    // 1. Get Signed URL
    const getUrl = `${APP_CONFIG.APS.BASE_URL}/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;

    const getResponse = await axios.get(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const signedData = getResponse.data;
    const uploadUrl = signedData.urls[0];
    const uploadKey = signedData.uploadKey;

    // 2. Upload to S3
    // Note: Do not set Content-Type header as it might invalidate the S3 signature
    await axios.put(uploadUrl, buffer, {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    // 3. Finalize Upload
    const postUrl = `${APP_CONFIG.APS.BASE_URL}/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;

    const postResponse = await axios.post(
      postUrl,
      {
        uploadKey: uploadKey,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return postResponse.data;
  }

  /**
   * Upload a file to OSS using Direct to S3 (Signed URLs)
   * Uses streams to avoid loading the entire file into memory
   */
  async uploadFile(file: Express.Multer.File) {
    const stream = fs.createReadStream(file.path);
    return this.uploadStream(stream, file.originalname, file.size);
  }

  /**
   * Get object details
   */
  async getObjectDetails(objectName: string) {
    const token = await apsAuthService.getInternalToken();
    const result = await this.objectsApi.getObjectDetails(
      this.bucketKey,
      objectName,
      {},
      { access_token: token },
      { access_token: token },
    );
    return result.body;
  }

  /**
   * Generate a signed URL for download
   */
  async getSignedUrl(objectName: string) {
    const token = await apsAuthService.getInternalToken();
    try {
      const result = await this.objectsApi.createSignedResource(
        this.bucketKey,
        objectName,
        {
          singleUse: false,
          minutesExpiration: 60,
        },
        { access: "read" },
        { access_token: token },
        { access_token: token },
      );
      return result.body.signedUrl;
    } catch (error: unknown) {
      const err = error as {
        response?: { body?: { reason?: string } };
        message?: string;
      };
      logger.error("[OSS] Failed to get signed URL", {
        error: err.response?.body?.reason || err.message || "Unknown error",
      });
      throw new Error(
        `Failed to get signed URL: ${err.response?.body?.reason || err.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Generate a signed URL for upload (write access)
   */
  async getSignedWriteUrl(objectName: string) {
    const token = await apsAuthService.getInternalToken();
    try {
      const result = await this.objectsApi.createSignedResource(
        this.bucketKey,
        objectName,
        {
          singleUse: false,
          minutesExpiration: 60,
        },
        { access: "readwrite" },
        { access_token: token },
        { access_token: token },
      );
      return result.body.signedUrl;
    } catch (error: unknown) {
      const err = error as {
        response?: { body?: { reason?: string } };
        message?: string;
      };
      logger.error("[OSS] Failed to get signed write URL", {
        error: err.response?.body?.reason || err.message || "Unknown error",
      });
      throw new Error(
        `Failed to get signed write URL: ${err.response?.body?.reason || err.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Convert an OSS objectId/storage identifier to a URL-safe Base64 URN
   * Example input: "urn:adsk.objects:os.object:bucket/object.rvt" or an objectId
   */
  getDerivativeUrn(storageId: string): string {
    const base64 = Buffer.from(storageId)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return base64;
  }

  /**
   * Decode a URL-safe Base64 URN back to the original storage ID
   */
  decodeUrn(urn: string): string {
    const padded = urn.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padding);
    return Buffer.from(base64, "base64").toString("utf-8");
  }
}

// Conditional: use mock when APS_MOCK=true
import { env } from "../../config/env";
import { MockApsOssService } from "../../mocks/aps-mock";

export const apsOssService: ApsOssService = env.APS_MOCK
  ? (new MockApsOssService() as unknown as ApsOssService)
  : new ApsOssService();

// @ts-ignore
import { ObjectsApi, BucketsApi } from 'forge-apis';
import { apsAuthService } from './auth.service';
import fs from 'fs';
import axios from 'axios';

export class ApsOssService {
    private objectsApi: any;
    private bucketsApi: any;
    private bucketKey: string;

    constructor() {
        this.objectsApi = new ObjectsApi();
        this.bucketsApi = new BucketsApi();
        // Use static bucket from .env instead of generating dynamic ones
        this.bucketKey = process.env.APS_BUCKET || 'aps-assembly-configurator-dom-demo';
        console.log('Using APS Bucket:', this.bucketKey);
    }

    /**
     * Ensure the bucket exists
     */
    async ensureBucketExists() {
        const token = await apsAuthService.getInternalToken();
        try {
            console.log(`Checking if bucket ${this.bucketKey} exists...`);
            await this.bucketsApi.getBucketDetails(this.bucketKey, { access_token: token }, { access_token: token });
            console.log('Bucket exists.');
        } catch (error: any) {
            if (error.statusCode === 404) {
                console.log('Bucket not found, creating...');
                try {
                    await this.bucketsApi.createBucket(
                        { bucketKey: this.bucketKey, policyKey: 'transient' },
                        {},
                        { access_token: token },
                        { access_token: token }
                    );
                    console.log('Bucket created successfully.');
                } catch (createError: any) {
                    console.error('Failed to create bucket:', createError.response ? createError.response.body : createError);
                    throw new Error('Failed to create APS bucket: ' + (createError.response?.body?.reason || createError.message));
                }
            } else {
                console.error('Failed to check bucket details:', error.response ? error.response.body : error);
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
        
        console.log(`Copying object ${objectName} to ${newObjectName} in bucket ${this.bucketKey}...`);

        try {
            const url = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/copyto/${encodeURIComponent(newObjectName)}`;
            
            const response = await axios.put(url, {}, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Copy successful:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Copy failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload a buffer to OSS using the classic PUT endpoint
     * Simpler than Direct to S3, recommended for files < 100MB
     */
    async uploadObject(buffer: Buffer, filename: string) {
        await this.ensureBucketExists();
        const token = await apsAuthService.getInternalToken();

        // Sanitize filename
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const objectName = `${Date.now()}-${safeFilename}`;

        console.log(`Uploading buffer ${objectName} to bucket ${this.bucketKey} using Classic PUT...`);

        try {
            const url = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}`;
            
            const response = await axios.put(url, buffer, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/octet-stream'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            console.log('Upload successful:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('Classic upload failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload a stream to OSS using Direct to S3 (Signed URLs)
     * Optimized for large files to avoid memory issues
     */
    async uploadStream(stream: any, filename: string, contentLength: number) {
        await this.ensureBucketExists();
        const token = await apsAuthService.getInternalToken();

        // Sanitize filename
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const objectName = `${Date.now()}-${safeFilename}`;

        console.log(`Uploading stream ${objectName} to bucket ${this.bucketKey} using Direct to S3...`);

        try {
            // 1. Get Signed URL
            const getUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;
            
            const getResponse = await axios.get(getUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const signedData = getResponse.data;
            const uploadUrl = signedData.urls[0];
            const uploadKey = signedData.uploadKey;

            console.log('Got signed URL. Streaming to S3...');

            // 2. Upload to S3
            await axios.put(uploadUrl, stream, {
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                headers: {
                    'Content-Length': contentLength
                }
            });

            console.log('Stream upload to S3 successful. Finalizing...');

            // 3. Finalize Upload
            const postUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;
            
            const postResponse = await axios.post(postUrl, {
                uploadKey: uploadKey
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const object = postResponse.data;
            console.log('Upload finalized successfully:', object);
            return object;

        } catch (error: any) {
            console.error('Stream upload failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload a buffer to OSS using Direct to S3 (Signed URLs)
     */
    async uploadBuffer(buffer: Buffer, filename: string) {
        await this.ensureBucketExists();
        const token = await apsAuthService.getInternalToken();

        // Sanitize filename to ensure it's safe for OSS/S3
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const objectName = `${Date.now()}-${safeFilename}`;

        console.log(`Uploading buffer ${objectName} to bucket ${this.bucketKey} using Direct to S3...`);

        try {
            // 1. Get Signed URL
            const getUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;
            
            const getResponse = await axios.get(getUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const signedData = getResponse.data;
            const uploadUrl = signedData.urls[0];
            const uploadKey = signedData.uploadKey;

            console.log('Got signed URL. Uploading to S3...');

            // 2. Upload to S3
            // Note: Do not set Content-Type header as it might invalidate the S3 signature
            await axios.put(uploadUrl, buffer, {
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            console.log('Upload to S3 successful. Finalizing...');

            // 3. Finalize Upload
            const postUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${encodeURIComponent(objectName)}/signeds3upload`;
            
            const postResponse = await axios.post(postUrl, {
                uploadKey: uploadKey
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const object = postResponse.data;
            console.log('Upload finalized successfully:', object);
            return object;

        } catch (error: any) {
            console.error('Upload failed:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Upload a file to OSS using Direct to S3 (Signed URLs)
     */
    async uploadFile(file: Express.Multer.File) {
        const fileContent = fs.readFileSync(file.path);
        return this.uploadBuffer(fileContent, file.originalname);
    }

    /**
     * Get object details
     */
    async getObjectDetails(objectName: string) {
        const token = await apsAuthService.getInternalToken();
        const result = await this.objectsApi.getObjectDetails(this.bucketKey, objectName, {}, { access_token: token }, { access_token: token });
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
                    minutesExpiration: 60
                },
                { access: 'read' },
                { access_token: token },
                { access_token: token }
            );
            return result.body.signedUrl;
        } catch (error) {
            console.error('Failed to get signed URL:', error);
            return null;
        }
    }

    /**
     * Convert an OSS objectId/storage identifier to a URL-safe Base64 URN
     * Example input: "urn:adsk.objects:os.object:bucket/object.rvt" or an objectId
     */
    getDerivativeUrn(storageId: string): string {
        const base64 = Buffer.from(storageId)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        return base64;
    }

    /**
     * Decode a URL-safe Base64 URN back to the original storage ID
     */
    decodeUrn(urn: string): string {
        const padded = urn.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - (padded.length % 4)) % 4;
        const base64 = padded + '='.repeat(padding);
        return Buffer.from(base64, 'base64').toString('utf-8');
    }
}

export const apsOssService = new ApsOssService();

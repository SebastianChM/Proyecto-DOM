import { ObjectsApi, BucketsApi } from 'forge-apis';
import { apsAuthService } from './auth.service';
import fs from 'fs';

export class APSDataManagementService {
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
     * Upload a file to OSS using Direct to S3 (Signed URLs)
     */
    async uploadFile(file: Express.Multer.File) {
        await this.ensureBucketExists();
        const token = await apsAuthService.getInternalToken();

        const fileContent = fs.readFileSync(file.path);
        const objectName = `${Date.now()}-${file.originalname}`;

        console.log(`Uploading file ${objectName} to bucket ${this.bucketKey} using Direct to S3...`);

        try {
            // 1. Get Signed URL
            const getUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${objectName}/signeds3upload`;
            const getResponse = await fetch(getUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!getResponse.ok) {
                const errorText = await getResponse.text();
                throw new Error(`Failed to get signed URL: ${getResponse.status} - ${errorText}`);
            }

            const signedData = await getResponse.json() as any;
            const uploadUrl = signedData.urls[0];
            const uploadKey = signedData.uploadKey;

            console.log('Got signed URL. Uploading to S3...');

            // 2. Upload to S3
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: fileContent
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Failed to upload to S3: ${uploadResponse.status} - ${errorText}`);
            }

            console.log('Upload to S3 successful. Finalizing...');

            // 3. Finalize Upload
            const postUrl = `https://developer.api.autodesk.com/oss/v2/buckets/${this.bucketKey}/objects/${objectName}/signeds3upload`;
            const postResponse = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uploadKey: uploadKey
                })
            });

            if (!postResponse.ok) {
                const errorText = await postResponse.text();
                throw new Error(`Failed to finalize upload: ${postResponse.status} - ${errorText}`);
            }

            const object = await postResponse.json();
            console.log('Upload finalized successfully:', object);
            return object;

        } catch (error: any) {
            console.error('Upload failed:', error);
            throw error;
        }
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
}

export const apsDataService = new APSDataManagementService();

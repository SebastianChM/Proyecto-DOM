import prisma from '../lib/prisma';
import { apsOssService } from './aps/oss.service';
import { modelDerivativeService } from './aps/model-derivative.service';
import { APP_CONFIG } from '../config/constants';
import fs from 'fs';
import path from 'path';

export class FileService {

    static getFileType(filename: string) {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext === 'rvt') return 'RVT';
        if (ext === 'dwg') return 'DWG';
        if (ext === 'pdf') return 'PDF';
        if (ext === 'ifc') return 'IFC';
        if (ext === 'nwc') return 'NWC';
        if (ext === 'dwf') return 'DWF';
        return 'OTHER';
    }

    /**
     * Handle file upload with ASYNCHRONOUS APS upload
     * Creates DB record immediately, responds fast, then uploads to APS in background
     */
    async handleFileUpload(file: Express.Multer.File, projectId: string, forceLocal: boolean = false) {
        // Check File Size Limit
        if (file.size > APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES) {
            throw new Error(`File size exceeds limit of ${APP_CONFIG.LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
        }

        // Check Project File Count Limit
        const fileCount = await prisma.file.count({
            where: { projectId }
        });

        if (fileCount >= APP_CONFIG.LIMITS.MAX_FILES_PER_PROJECT) {
            throw new Error(`Project file limit reached (${APP_CONFIG.LIMITS.MAX_FILES_PER_PROJECT} files max)`);
        }

        const fileType = FileService.getFileType(file.originalname);
        const isPdf = fileType === 'PDF';
        const s3Key = `files/${projectId}/${Date.now()}-${file.originalname}`;

        // STEP 1: Create DB record IMMEDIATELY with UPLOADING status
        // This allows us to respond to the user quickly
        const dbFile = await prisma.file.create({
            data: {
                name: file.originalname,
                originalName: file.originalname,
                type: fileType,
                size: file.size,
                s3Key,
                apsUrn: 'UPLOADING', // Will be updated after background upload
                projectId,
                localPath: path.resolve(file.path), // Save ABSOLUTE local path for resilience
                status: 'UPLOADING' // New status to indicate upload in progress
            }
        });

        console.log(`📤 File ${file.originalname} registered, starting background upload...`);

        // STEP 2: Start BACKGROUND upload to APS (non-blocking)
        // The file path is still valid at this point since multer hasn't cleaned it up yet
        const filePath = file.path;
        const fileId = dbFile.id;

        // Use setImmediate to not block the response
        setImmediate(async () => {
            try {
                if (forceLocal) {
                    throw new Error('Forced Local Mode');
                }

                // Upload to APS
                console.log(`🚀 Background APS upload started for ${file.originalname}`);
                const startTime = Date.now();

                const stream = fs.createReadStream(filePath);
                // OPTIMIZATION: Use uploadObject (Classic) instead of uploadStream (S3 Direct)
                // This avoids potential firewall/negotiation latency with S3 Signed URLs.
                const buffer = fs.readFileSync(filePath);
                const apsObject = await apsOssService.uploadObject(buffer, file.originalname);

                const apsUrn = Buffer.from((apsObject as any).objectId).toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');

                const uploadTime = Date.now() - startTime;
                console.log(`✅ APS upload completed for ${file.originalname} in ${uploadTime}ms`);

                // Update DB with the URN
                const newStatus = isPdf ? 'READY' : 'UPLOADED';
                await prisma.file.update({
                    where: { id: fileId },
                    data: {
                        apsUrn,
                        status: newStatus
                    }
                });

                // Trigger translation for non-PDF files
                if (!isPdf) {
                    try {

                        await modelDerivativeService.translateToSVF2(apsUrn);
                        await prisma.file.update({
                            where: { id: fileId },
                            data: { status: 'TRANSLATING' }
                        });
                        console.log(`🔄 Translation started for ${file.originalname}`);
                    } catch (translateError: any) {
                        console.warn(`⚠️ Translation failed to start for ${file.originalname}:`, translateError.message);
                    }

                    // --- PREDICTIVE CONVERSION ---
                    // Automatically start PDF conversion for DWG files to reduce wait time
                    if (fileType === 'DWG') {
                        try {
                            console.log(`🤖 Predictive Conversion: queueing PDF for ${file.originalname}...`);
                            await prisma.conversion.create({
                                data: {
                                    fileId: fileId,
                                    targetFormat: 'pdf',
                                    status: 'PENDING' // Worker will pick this up
                                }
                            });
                        } catch (pcError) {
                            console.warn('Predictive conversion failed to queue:', pcError);
                        }
                    }
                }


            } catch (apsError: any) {
                console.error(`❌ Background APS upload failed for ${file.originalname}:`, apsError.message);

                if (APP_CONFIG.DEMO_MODE) {
                    // In demo mode, use local fallback
                    const localUrn = `local-${Date.now()}-${Buffer.from(file.originalname).toString('base64').replace(/=/g, '')}`;
                    await prisma.file.update({
                        where: { id: fileId },
                        data: {
                            apsUrn: localUrn,
                            status: isPdf ? 'READY' : 'LOCAL_ONLY'
                        }
                    });
                    console.log(`📁 Using local fallback for ${file.originalname}`);
                } else {
                    // Mark as failed
                    await prisma.file.update({
                        where: { id: fileId },
                        data: { status: 'FAILED' }
                    });
                }

            }
        });

        // STEP 3: Return IMMEDIATELY - don't wait for APS upload
        return {
            dbFile,
            apsUrn: 'UPLOADING', // Will be updated in background
            uploadWarning: null,
            fileStatus: 'UPLOADING',
            message: 'File registered. Upload to cloud storage in progress...'
        };
    }
}

export const fileService = new FileService();


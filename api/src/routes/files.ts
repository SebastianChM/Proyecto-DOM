import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import prisma from '../lib/prisma';
import { apsDataManagementService } from '../services/aps/data-management.service';
import { apsOssService } from '../services/aps/oss.service';
import { modelDerivativeService } from '../services/aps/model-derivative.service';
import { apsAuthService } from '../services/aps/auth.service';
import { fileService } from '../services/files.service';
import { APP_CONFIG } from '../config/constants';
import axios from 'axios';
import archiver from 'archiver';

import { cacheService, RedisKeys } from '../lib/redis';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Helper to determine file type enum
function getFileType(mimetype: string, filename: string) {
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
 * @swagger
 * /files/upload:
 *   post:
 *     summary: Upload a file
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               projectId:
 *                 type: string
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file or missing project ID
 *       500:
 *         description: Server error
 */
// Upload file endpoint
// Upload file endpoint
router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { projectId } = req.body;
        const forceLocal = req.query.forceLocal === 'true';

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        // Server-side validation
        const allowedExtensions = APP_CONFIG.UPLOAD.ALLOWED_EXTENSIONS;
        const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

        if (!fileExt || !allowedExtensions.includes(fileExt)) {
            // Clean up uploaded file immediately
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                error: 'Unsupported file format',
                details: `Allowed formats: ${allowedExtensions.join(', ').toUpperCase()}`
            });
        }

        const result = await fileService.handleFileUpload(req.file, projectId, forceLocal);

        // NOTE: File cleanup is now handled in the background upload process
        // Do NOT delete the file here - it's needed for the async APS upload

        // Invalidate caches
        await Promise.all([
            cacheService.del(RedisKeys.projectDetail(projectId)),
            cacheService.invalidatePattern('cache:dashboard:stats:*'),
            cacheService.invalidatePattern('cache:files:recent:*') // Invalidate recent files cache
        ]);

        res.json({
            success: true,
            file: result.dbFile,
            urn: result.apsUrn,
            warning: result.uploadWarning,
            mode: result.fileStatus === 'UPLOADING' ? 'UPLOADING (background upload in progress)' : 'APS',
            message: result.message
        });

    } catch (error: any) {
        // Clean up local file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        next(error);
    }
});

/**
 * @swagger
 * /files/batch-download:
 *   post:
 *     summary: Batch download files
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: ZIP file containing requested files
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: No file IDs provided
 *       404:
 *         description: No files found
 *       500:
 *         description: Server error
 */
// Batch Download (ZIP)
router.post('/batch-download', async (req, res) => {
    try {
        const { fileIds } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'No file IDs provided' });
        }

        const files = await prisma.file.findMany({
            where: {
                id: { in: fileIds }
            }
        });

        if (files.length === 0) {
            return res.status(404).json({ error: 'No files found' });
        }

        // Set headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="files_archive_${Date.now()}.zip"`);

        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        // Listen for all archive data to be written
        // 'close' event is fired only when a file descriptor is involved
        res.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
        });

        // This event is fired when the data source is drained no matter what was the data source.
        // It is not part of this library but rather from the NodeJS Stream API.
        // @see: https://nodejs.org/api/stream.html#stream_event_end
        res.on('end', function () {
            console.log('Data has been drained');
        });

        // good practice to catch warnings (ie stat failures and other non-blocking errors)
        archive.on('warning', function (err) {
            if (err.code === 'ENOENT') {
                // log warning
                console.warn('Archiver warning:', err);
            } else {
                // throw error
                throw err;
            }
        });

        // good practice to catch this error explicitly
        archive.on('error', function (err) {
            throw err;
        });

        // Pipe archive data to the response
        archive.pipe(res);

        // Process files sequentially to avoid overwhelming the server/network
        for (const file of files) {
            try {
                if (!file.apsUrn) {
                    console.warn(`Skipping file ${file.name}: No URN`);
                    archive.append(`File ${file.name} skipped: No URN available.\n`, { name: `${file.name}.txt` });
                    continue;
                }

                if (file.apsUrn.startsWith('local-')) {
                    // Handle local files (mock content for now as we don't store actual files locally in this demo)
                    archive.append(`This is a placeholder for local file: ${file.name}\nOriginal size: ${file.size} bytes.\n`, { name: `${file.name}.txt` });
                    continue;
                }

                // Decode URN to get object key
                const decodedUrn = Buffer.from(file.apsUrn, 'base64').toString('utf-8');
                const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
                let objectKey = file.s3Key || 'unknown_key';
                if (match) {
                    objectKey = match[1];
                }

                // Get signed URL
                const signedUrl = await apsOssService.getSignedUrl(objectKey);

                if (!signedUrl) {
                    console.warn(`Skipping file ${file.name}: Failed to get signed URL`);
                    archive.append(`File ${file.name} skipped: Failed to retrieve download URL.\n`, { name: `${file.name}.txt` });
                    continue;
                }

                // Get file stream
                const response = await axios.get(signedUrl, {
                    responseType: 'stream'
                });

                // Append stream to archive
                archive.append(response.data, { name: file.name });

            } catch (fileError: any) {
                console.error(`Error processing file ${file.name} for zip:`, fileError.message);
                archive.append(`Error downloading file: ${fileError.message}\n`, { name: `${file.name}_error.txt` });
            }
        }

        // Finalize the archive (ie we are done appending files but streams have to finish yet)
        // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
        await archive.finalize();

    } catch (error: any) {
        console.error('Batch download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Batch download failed', details: error.message });
        }
    }
});

/**
 * @swagger
 * /files/{id}/download:
 *   get:
 *     summary: Download a file
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File content
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Download file content
router.get('/:id/download', async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id }
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Handle Local Mode
        if (file.apsUrn?.startsWith('local-')) {
            return res.status(404).json({ error: 'Local file download not implemented' });
        }

        if (!file.apsUrn) {
            return res.status(400).json({ error: 'File has no URN' });
        }

        try {
            let signedUrl: string | null = null;

            // Check if file is from ACC/BIM360 (imported file)
            if (file.s3Key === 'IMPORTED_FROM_APS') {
                // For ACC/BIM360 files, we need to get download URL via Data Management API
                const userToken = (req.session as any)?.user?.apsAccessToken;

                // Method 1: Use Data Management API with apsProjectId and apsItemId
                if (file.apsProjectId && file.apsItemId && userToken) {
                    try {
                        signedUrl = await apsDataManagementService.getItemDownloadUrl(
                            file.apsProjectId,
                            file.apsItemId,
                            userToken
                        );
                    } catch (err) {
                        console.warn('Failed to get download URL via Data Management API:', err);
                    }
                }

                // Method 2: Try with apsStorageId if available
                if (!signedUrl && file.apsStorageId) {
                    const storageId = file.apsStorageId;

                    if (storageId.startsWith('https://')) {
                        // Direct HTTPS download URL
                        signedUrl = storageId;
                    } else if (storageId.startsWith('urn:adsk.objects:') || storageId.startsWith('urn:adsk.wipprod:')) {
                        // Try to extract object key and get signed URL
                        const storageMatch = storageId.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
                        if (storageMatch) {
                            try {
                                signedUrl = await apsOssService.getSignedUrl(storageMatch[1]);
                            } catch (err) {
                                console.warn('Failed to get signed URL from OSS:', err);
                            }
                        }
                    }
                }

                // If still no URL, return appropriate error
                if (!signedUrl) {
                    if (!userToken) {
                        return res.status(401).json({
                            error: 'Authentication required',
                            details: 'Please log in with your Autodesk account to view files from ACC/BIM360.'
                        });
                    }
                    return res.status(400).json({
                        error: 'Cannot download ACC file',
                        details: 'Unable to retrieve download URL. The file may no longer be accessible in ACC/BIM360.'
                    });
                }
            } else {
                // Regular OSS file - use existing logic
                const decodedUrn = Buffer.from(file.apsUrn, 'base64').toString('utf-8');
                console.log(`[Download Debug] File ID: ${file.id}, Decoded URN: ${decodedUrn}`);

                const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);

                let objectKey: string;

                if (match) {
                    objectKey = match[1];
                    console.log(`[Download Debug] Extracted objectKey from URN: ${objectKey}`);
                } else {
                    // If URN doesn't match pattern, the file might have been uploaded with a different format
                    // Try using the s3Key as the object key (remove the 'files/' prefix if present)
                    if (file.s3Key && file.s3Key !== 'unknown_key') {
                        // Extract just the filename portion which is what OSS uses
                        const s3KeyParts = file.s3Key.split('/');
                        objectKey = s3KeyParts[s3KeyParts.length - 1]; // Get last part (filename)
                        console.log(`[Download Debug] Using s3Key filename as objectKey: ${objectKey}`);
                    } else {
                        console.error(`[Download Debug] Cannot determine objectKey. URN: ${decodedUrn}, s3Key: ${file.s3Key}`);
                        return res.status(400).json({
                            error: 'Cannot download file',
                            details: 'Unable to determine file location in storage.'
                        });
                    }
                }

                signedUrl = await apsOssService.getSignedUrl(objectKey);
            }

            if (!signedUrl) {
                return res.status(500).json({ error: 'Failed to generate signed URL' });
            }

            // Proxy the file download to set correct headers for browser viewing
            const userToken = (req.session as any)?.user?.apsAccessToken;
            const headers: Record<string, string> = {};

            // Add authorization for ACC URLs that require it
            if (file.s3Key === 'IMPORTED_FROM_APS' && userToken) {
                headers['Authorization'] = `Bearer ${userToken}`;
            }

            const response = await axios.get(signedUrl, {
                responseType: 'stream',
                headers
            });

            // Set headers
            const contentType = file.type === 'PDF' || file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            // Sanitize filename for header
            const safeFilename = file.name.replace(/"/g, '');
            res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

            // Disable X-Frame-Options to allow iframe embedding
            res.removeHeader('X-Frame-Options');
            // Set CSP to allow embedding
            res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");

            // Pipe the stream
            response.data.pipe(res);

        } catch (e: any) {
            console.error('Download error:', e);

            // Check if the error is due to file not found in OSS (404)
            if (e.message?.includes('404') || e.response?.status === 404 || e.statusCode === 404) {
                return res.status(404).json({
                    error: 'El archivo ya no está disponible',
                    details: 'El archivo ha expirado en el almacenamiento de Autodesk (política transient de 24 horas). Por favor, vuelve a subir el archivo.',
                    code: 'FILE_EXPIRED'
                });
            }

            res.status(500).json({ error: 'Failed to process download', details: e.message });
        }

    } catch (error: any) {
        console.error('Download endpoint error:', error);
        res.status(500).json({ error: 'Download failed', details: error.message });
    }
});

/**
 * @swagger
 * /files/import-aps:
 *   post:
 *     summary: Import file from APS
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - name
 *               - urn
 *             properties:
 *               projectId:
 *                 type: string
 *               name:
 *                 type: string
 *               urn:
 *                 type: string
 *               apsProjectId:
 *                 type: string
 *               apsItemId:
 *                 type: string
 *               apsHubId:
 *                 type: string
 *               apsFolderId:
 *                 type: string
 *               apsStorageId:
 *                 type: string
 *               size:
 *                 type: integer
 *     responses:
 *       200:
 *         description: File imported successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
// Import file from APS (ACC/BIM 360)
router.post('/import-aps', async (req, res) => {
    try {
        const {
            projectId,
            name,
            urn,
            apsProjectId,
            apsItemId,
            apsHubId,
            apsFolderId,
            apsStorageId,
            size
        } = req.body;

        if (!projectId || !name || !urn) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get or create temporary user (same as upload)
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: 'temp@dom.com',
                    name: 'Temporary User',
                    apsUserId: 'temp-user-id'
                }
            });
        }

        // Check if file already exists in this project (by APS Item ID)
        if (apsItemId) {
            const existingFile = await prisma.file.findFirst({
                where: {
                    projectId: projectId,
                    apsItemId: apsItemId
                }
            });

            if (existingFile) {
                console.log(`File ${name} already imported (ID: ${existingFile.id}). Returning existing record.`);
                return res.json({
                    success: true,
                    file: existingFile,
                    message: 'File already imported'
                });
            }
        }

        // Create DB record with APS metadata
        const dbFile = await prisma.file.create({
            data: {
                name: name,
                originalName: name,
                type: getFileType('application/octet-stream', name), // Infer type from name
                size: size || 0,
                s3Key: 'IMPORTED_FROM_APS',
                apsUrn: urn,
                // APS Data Management fields
                apsProjectId: apsProjectId || null,
                apsItemId: apsItemId || null,
                apsHubId: apsHubId || null,
                apsFolderId: apsFolderId || null,
                apsStorageId: apsStorageId || null,
                projectId,
                status: 'READY' // Assumed ready since it's from APS
            } as any // Cast to any to avoid type errors until Prisma Client is regenerated
        });

        res.json({
            success: true,
            file: dbFile
        });

    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Import failed', details: error.message });
    }
});

/**
 * @swagger
 * /files/sync-status:
 *   post:
 *     summary: Sync status of specific files with APS
 *     tags: [Files]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated file statuses
 *       500:
 *         description: Server error
 */
// Sync file status
router.post('/sync-status', async (req, res) => {
    try {
        const { fileIds } = req.body;

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ error: 'No file IDs provided' });
        }

        const files = await prisma.file.findMany({
            where: { id: { in: fileIds } }
        });

        const updates: any[] = [];
        const allFiles: any[] = [];

        await Promise.all(files.map(async (file) => {
            let newStatus = file.status;
            let progress = 0;

            // Calculate progress for all files
            if (file.status === 'TRANSLATING' || file.status === 'PROCESSING' || file.status === 'PENDING') {
                const elapsed = Date.now() - new Date(file.updatedAt).getTime();
                const isLocal = file.apsUrn && file.apsUrn.startsWith('local-');
                const duration = isLocal ? 5000 : 120000; // 5s for local, 120s for real APS translation
                progress = Math.max(10, Math.min(99, Math.floor((elapsed / duration) * 100)));

                // Check APS manifest for actual status
                if (file.apsUrn && !file.apsUrn.startsWith('local-')) {
                    try {
                        const manifest = await modelDerivativeService.getManifest(file.apsUrn);

                        if (manifest.status === 'success') {
                            newStatus = 'READY';
                            progress = 100;
                        } else if (manifest.status === 'failed') {
                            newStatus = 'FAILED';
                            progress = 0;
                        } else if (manifest.progress) {
                            // Use actual progress from APS if available
                            const apsProgress = parseInt(manifest.progress.replace('%', ''));
                            if (!isNaN(apsProgress)) {
                                progress = apsProgress;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to check manifest for ${file.id}:`, e);
                    }
                }

                // Update DB if status changed
                if (newStatus !== file.status) {
                    await prisma.file.update({
                        where: { id: file.id },
                        data: { status: newStatus }
                    });
                    updates.push({ id: file.id, status: newStatus, progress });
                }
            } else if (file.status === 'READY') {
                progress = 100;
            }

            // Include all files with current status and progress
            allFiles.push({
                id: file.id,
                status: newStatus,
                progress
            });
        }));

        if (updates.length > 0) {
            // Invalidate caches if there were updates
            const projectIds = [...new Set(files.map(f => f.projectId))];
            await Promise.all(projectIds.map(pid => cacheService.del(RedisKeys.projectDetail(pid))));
            await cacheService.invalidatePattern('cache:dashboard:stats:*');
            await cacheService.invalidatePattern('cache:files:recent:*');
        }

        res.json({
            success: true,
            updatedCount: updates.length,
            updates,
            files: allFiles // Include all files with their current progress
        });

    } catch (error: any) {
        console.error('Sync status error:', error);
        res.status(500).json({ error: 'Failed to sync status', details: error.message });
    }
});

/**
 * @swagger
 * /files/project/{projectId}:
 *   get:
 *     summary: List files for a project
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: List of files
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                   progress:
 *                     type: integer
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /files/recent:
 *   get:
 *     summary: Get recent files for dashboard
 *     tags: [Files]
 *     responses:
 *       200:
 *         description: List of recent files
 *       500:
 *         description: Server error
 */
router.get('/recent', async (req, res) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const cacheKey = `cache:files:recent:${userId}`;

        // Cache for 5 minutes
        const files = await cacheService.getOrSet(
            cacheKey,
            async () => {
                return await prisma.file.findMany({
                    where: {
                        project: {
                            OR: [
                                { ownerId: userId },
                                { members: { some: { userId } } }
                            ]
                        },
                        status: 'READY',
                        type: { in: ['RVT', 'IFC', 'NWC', 'DWG'] }
                    },
                    take: 6,
                    orderBy: { updatedAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        status: true,
                        apsUrn: true,
                        updatedAt: true,
                        project: {
                            select: { name: true }
                        }
                    }
                });
            },
            300
        );

        res.json(files);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// List files for a project
router.get('/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const files = await prisma.file.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            include: {
                versions: true
            }
        });

        // Check status for active files
        for (const file of files) {
            if ((file.status === 'TRANSLATING' || file.status === 'PROCESSING') && file.apsUrn && !file.apsUrn.startsWith('local-')) {
                try {
                    const manifest = await modelDerivativeService.getManifest(file.apsUrn);
                    if (manifest.status === 'success') {
                        await prisma.file.update({
                            where: { id: file.id },
                            data: { status: 'READY' }
                        });
                        file.status = 'READY';
                    } else if (manifest.status === 'failed') {
                        await prisma.file.update({
                            where: { id: file.id },
                            data: { status: 'FAILED' }
                        });
                        file.status = 'FAILED';
                    }
                } catch (e) {
                    console.error(`Failed to check manifest for file ${file.id}:`, e);
                }
            }
        }

        // Add progress estimation
        const filesWithProgress = files.map(file => {
            let progress = 0;
            if (file.status === 'TRANSLATING' || file.status === 'PROCESSING') {
                const elapsed = Date.now() - new Date(file.updatedAt).getTime();
                const isLocal = file.apsUrn && file.apsUrn.startsWith('local-');
                const duration = isLocal ? 5000 : 60000; // 5s for local, 60s for real
                // Force minimum 10% to ensure visibility immediately
                progress = Math.max(10, Math.min(99, Math.floor((elapsed / duration) * 100)));
            } else if (file.status === 'READY') {
                progress = 100;
            }
            return { ...file, progress };
        });

        res.json(filesWithProgress);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     summary: Get file details
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File details
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Get file details
router.get('/:id', async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id },
            include: {
                versions: true,
                conversions: true
            }
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check translation status if currently translating
        if (file.status === 'TRANSLATING' || file.status === 'PROCESSING') {
            const elapsed = Date.now() - new Date(file.updatedAt).getTime();
            const isLocal = file.apsUrn && file.apsUrn.startsWith('local-');
            const duration = isLocal ? 5000 : 60000; // 5s for local, 60s for real
            // Force minimum 10% to ensure visibility immediately
            (file as any).progress = Math.max(10, Math.min(99, Math.floor((elapsed / duration) * 100)));
        } else if (file.status === 'READY') {
            (file as any).progress = 100;
        }

        if ((file.status === 'TRANSLATING' || file.status === 'PROCESSING') && file.apsUrn && !file.apsUrn.startsWith('local-')) {
            try {
                const manifest = await modelDerivativeService.getManifest(file.apsUrn);
                if (manifest.status === 'success') {
                    await prisma.file.update({
                        where: { id: file.id },
                        data: { status: 'READY' }
                    });
                    file.status = 'READY';
                } else if (manifest.status === 'failed') {
                    await prisma.file.update({
                        where: { id: file.id },
                        data: { status: 'FAILED' }
                    });
                    file.status = 'FAILED';
                }
            } catch (e) {
                console.error('Failed to check manifest:', e);
            }
        }

        res.json(file);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /files/{id}/bom:
 *   get:
 *     summary: Get BOM (Bill of Materials)
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: BOM data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       404:
 *         description: File not found or not processed
 *       500:
 *         description: Server error
 */
// Get BOM (Metadata + Properties)
router.get('/:id/bom', async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id }
        });

        if (!file || !file.apsUrn) {
            return res.status(404).json({ error: 'File not found or not processed' });
        }

        // Check if file is ready
        if (file.status !== 'READY') {
            return res.status(400).json({ error: 'File not ready for BOM extraction. Current status: ' + file.status });
        }

        // If Local Mode, return mock BOM
        if (file.apsUrn.startsWith('local-')) {
            return res.json([
                { id: 1, name: 'Mock Wall', category: 'Walls', family: 'Basic Wall', type: 'Generic 200mm', material: 'Concrete', volume: 10.5, area: 20, length: 5, count: 1 },
                { id: 2, name: 'Mock Door', category: 'Doors', family: 'Single-Flush', type: '0915 x 2134mm', material: 'Wood', volume: 2.1, area: 2, length: 0, count: 1 },
                { id: 3, name: 'Mock Window', category: 'Windows', family: 'Fixed', type: '0915 x 1220mm', material: 'Glass', volume: 1.2, area: 1.5, length: 0, count: 1 }
            ]);
        }

        // Helper function to find a property value by trying multiple keys
        const findProperty = (props: any, ...keys: string[]): any => {
            if (!props) return undefined;
            for (const key of keys) {
                // Try direct access
                if (props[key] !== undefined) return props[key];
                // Try nested in groups
                for (const group of Object.values(props)) {
                    if (typeof group === 'object' && group !== null) {
                        if ((group as any)[key] !== undefined) return (group as any)[key];
                    }
                }
            }
            return undefined;
        };

        // Helper to parse numeric values (Revit sometimes returns strings with units)
        const parseNumeric = (value: any): number => {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const cleaned = value.replace(/[^0-9.-]/g, '');
                return parseFloat(cleaned) || 0;
            }
            return 0;
        };

        // 1. Get Metadata (list of available views)
        const metadata = await modelDerivativeService.getMetadata(file.apsUrn);

        if (!metadata.data || !metadata.data.metadata || metadata.data.metadata.length === 0) {
            return res.status(404).json({ error: 'No metadata found for this file' });
        }

        // Find 3D view (preferred) or first available
        const viewGeometry = metadata.data.metadata.find((m: any) => m.role === '3d' && m.isMasterView)
            || metadata.data.metadata.find((m: any) => m.role === '3d')
            || metadata.data.metadata[0];

        const guid = viewGeometry.guid;
        console.log(`🔍 BOM: Using view guid: ${guid}, role: ${viewGeometry.role}`);

        // 2. Get Properties
        const properties = await modelDerivativeService.getProperties(file.apsUrn, guid);

        if (!properties || !properties.data || !properties.data.collection) {
            console.warn('BOM Extraction: No properties collection found for URN:', file.apsUrn);
            return res.json([]);
        }

        console.log(`📦 BOM: Found ${properties.data.collection.length} elements in properties`);

        // 3. Process into BOM with improved property extraction
        const bom = properties.data.collection.map((item: any) => {
            const props = item.properties || {};

            // Try multiple property paths for Revit elements
            const category = findProperty(props,
                'Category',
                'Categoría',  // Spanish
                'category'
            ) || findProperty(props['Identity Data'], 'Category')
                || findProperty(props['Datos de identidad'], 'Categoría')
                || 'Uncategorized';

            const family = findProperty(props,
                'Family',
                'Familia',
                'Family Name',
                'Nombre de familia',
                'family'
            ) || findProperty(props['Identity Data'], 'Family', 'Type', 'Family Name')
                || '';

            const typeName = findProperty(props,
                'Type',
                'Tipo',
                'Type Name',
                'Nombre de tipo',
                'type'
            ) || findProperty(props['Identity Data'], 'Type', 'Type Name')
                || item.name || '';

            const material = findProperty(props,
                'Material',
                'Structural Material',
                'Material estructural',
                'Material Name'
            ) || findProperty(props['Materials'], 'Material', 'Name')
                || findProperty(props['Materiales'], 'Material', 'Nombre')
                || '';

            // Try dimension properties
            const volume = parseNumeric(findProperty(props,
                'Volume',
                'Volumen',
                'Host Volume',
                'Gross Volume'
            ) || findProperty(props['Dimensions'], 'Volume', 'Gross Volume')
                || findProperty(props['Dimensiones'], 'Volumen')
                || 0);

            const area = parseNumeric(findProperty(props,
                'Area',
                'Área',
                'Surface Area',
                'Gross Area',
                'Host Area'
            ) || findProperty(props['Dimensions'], 'Area', 'Surface Area')
                || findProperty(props['Dimensiones'], 'Área')
                || 0);

            const length = parseNumeric(findProperty(props,
                'Length',
                'Longitud',
                'Curve Length'
            ) || findProperty(props['Dimensions'], 'Length')
                || findProperty(props['Dimensiones'], 'Longitud')
                || 0);

            return {
                id: item.objectid,
                externalId: item.externalId,
                name: item.name,
                category: category,
                family: family,
                type: typeName,
                material: material,
                volume: volume,
                area: area,
                length: length,
                count: 1,
                // Include raw properties for debugging (remove in production)
                // allProperties: props
            };
        }).filter((item: any) => item.name && !item.name.startsWith('Non-Revit'));

        console.log(`✅ BOM: Processed ${bom.length} elements`);

        // Log sample item for debugging
        if (bom.length > 0) {
            console.log('📋 BOM Sample item:', JSON.stringify(bom[0], null, 2));
        }

        res.json(bom);
    } catch (error: any) {
        console.error('BOM extraction failed:', error);
        res.status(500).json({ error: 'BOM extraction failed', details: error.message });
    }
});

/**
 * @swagger
 * /files/{id}/versions:
 *   get:
 *     summary: Get file versions
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: List of file versions
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Get file versions (from APS Data Management for ACC/BIM 360 files)
router.get('/:id/versions', async (req, res) => {
    try {
        const file = await prisma.file.findUnique({
            where: { id: req.params.id },
            include: {
                versions: {
                    orderBy: { version: 'desc' }
                }
            }
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // If file is from APS (has apsProjectId and apsItemId), fetch real versions
        const apsFile = file as any;
        if (apsFile.apsProjectId && apsFile.apsItemId) {
            // Get 3-legged token from session
            const accessToken = (req as any).session?.apsToken;

            if (!accessToken) {
                return res.status(401).json({
                    error: 'Not authenticated with Autodesk. Please sign in again.'
                });
            }

            try {
                const versionsData: any = await apsDataManagementService.getItemVersions(
                    apsFile.apsProjectId,
                    apsFile.apsItemId,
                    accessToken
                );

                // Transform to our format
                const formattedVersions = versionsData.data.map((v: any, index: number) => ({
                    id: v.id,
                    versionNumber: v.attributes.versionNumber,
                    displayName: v.attributes.displayName,
                    createTime: v.attributes.createTime,
                    createUserName: v.attributes.createUserName || 'Unknown',
                    storageId: v.relationships?.storage?.data?.id,
                    urn: v.relationships?.storage?.data?.id
                        ? apsOssService.getDerivativeUrn(v.relationships.storage.data.id)
                        : null,
                    size: v.attributes.storageSize || 0,
                    status: 'READY' // Assume ready since it's from APS
                }));

                return res.json({
                    file: {
                        id: file.id,
                        name: file.name,
                        projectId: file.projectId
                    },
                    versions: formattedVersions,
                    source: 'APS'
                });
            } catch (apsError: any) {
                console.error('Failed to fetch APS versions:', apsError);
                return res.status(500).json({
                    error: 'Failed to fetch versions from Autodesk',
                    details: apsError.message
                });
            }
        }

        // Fallback: Return local versions from database
        const localVersions = file.versions.map((v, index) => ({
            id: v.id,
            versionNumber: v.version,
            displayName: `Version ${v.version}`,
            createTime: v.createdAt.toISOString(),
            createUserName: 'Local User',
            urn: v.apsUrn,
            size: file.size,
            status: 'READY'
        }));

        res.json({
            file: {
                id: file.id,
                name: file.name,
                projectId: file.projectId
            },
            versions: localVersions.length > 0 ? localVersions : [{
                id: file.id,
                versionNumber: 1,
                displayName: 'Current Version',
                createTime: file.createdAt.toISOString(),
                createUserName: 'Local User',
                urn: file.apsUrn,
                size: file.size,
                status: file.status
            }],
            source: 'LOCAL'
        });
    } catch (error: any) {
        console.error('Get versions error:', error);
        res.status(500).json({ error: 'Failed to get versions', details: error.message });
    }
});

/**
 * @swagger
 * /files/{id}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Files]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Delete file
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if file exists
        const file = await prisma.file.findUnique({
            where: { id }
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete from DB
        await prisma.file.delete({
            where: { id }
        });

        // TODO: Delete from S3 and APS if needed (skipping for now as we are in dev/mock mode mostly)

        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Failed to delete file', details: error.message });
    }
});

export default router;

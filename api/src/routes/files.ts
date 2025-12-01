import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import prisma from '../lib/prisma';
import { apsDataManagementService } from '../services/aps/data-management.service';
import { apsOssService } from '../services/aps/oss.service';
import { modelDerivativeService } from '../services/aps/model-derivative.service';
import { apsAuthService } from '../services/aps/auth.service';
import axios from 'axios';
import archiver from 'archiver';

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
router.post('/upload', upload.single('file'), async (req, res) => {
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
        const allowedExtensions = ['rvt', 'dwg', 'pdf', 'ifc', 'nwc', 'dwf'];
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

        console.log(`Processing upload: ${req.file.originalname} for project ${projectId} (Force Local: ${forceLocal})`);

        // Get or create temporary user
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

        // 1. Upload to APS OSS (Try/Catch to allow partial success)
        let apsUrn = null;
        let uploadWarning = null;
        let fileStatus = 'UPLOADED';

        try {
            if (forceLocal) {
                throw new Error('Forced Local Mode by client');
            }
            const apsObject = await apsOssService.uploadFile(req.file);
            // Convert to URL-safe Base64 (replace + with -, / with _, remove =)
            apsUrn = Buffer.from((apsObject as any).objectId).toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            console.log('✅ APS Upload successful, URN:', apsUrn);
        } catch (apsError: any) {
            console.error('⚠️ APS Upload failed (using LOCAL_ONLY mode):', apsError.message);
            uploadWarning = 'APS Upload failed: ' + (apsError.response?.body?.reason || apsError.message || 'Unknown error');
            fileStatus = 'LOCAL_ONLY';
            // In LOCAL_ONLY mode, create a mock URN for testing
            apsUrn = `local-${Date.now()}-${Buffer.from(req.file.originalname).toString('base64').replace(/=/g, '')}`;
            console.log('🔧 Using LOCAL_ONLY mode with mock URN:', apsUrn);
        }

        // 2. Upload to S3 (Placeholder - skipping for now as we don't have AWS creds)
        const s3Key = `files/${projectId}/${Date.now()}-${req.file.originalname}`;

        // 3. Create DB record
        const dbFile = await prisma.file.create({
            data: {
                name: req.file.originalname,
                originalName: req.file.originalname,
                type: getFileType(req.file.mimetype, req.file.originalname),
                size: req.file.size,
                s3Key,
                apsUrn: apsUrn || 'PENDING_APS_UPLOAD',
                projectId,
                userId: user.id,
                status: fileStatus
            }
        });

        // 4. If LOCAL_ONLY mode, simulate translation after 1 second
        if (fileStatus === 'LOCAL_ONLY' && (dbFile.type === 'RVT' || dbFile.type === 'DWG' || dbFile.type === 'IFC')) {
            console.log(`🔄 Simulating translation for ${dbFile.name} in LOCAL_ONLY mode...`);
            setTimeout(async () => {
                try {
                    await prisma.file.update({
                        where: { id: dbFile.id },
                        data: { status: 'READY' }
                    });
                    console.log(`✅ Mock translation complete for ${dbFile.name} - status: READY`);
                } catch (e) {
                    console.error('Failed to update mock translation status:', e);
                }
            }, 1000); // 1 second delay to simulate translation
        }
        // 5. If APS upload succeeded, trigger translation
        else if (fileStatus === 'UPLOADED' && apsUrn && !apsUrn.startsWith('local-')) {
            try {
                await modelDerivativeService.translateToSVF2(apsUrn);
                await prisma.file.update({
                    where: { id: dbFile.id },
                    data: { status: 'TRANSLATING' }
                });
                console.log('🚀 Translation job started for:', dbFile.name);
            } catch (translateError: any) {
                console.error('Translation start failed:', translateError);
                uploadWarning = (uploadWarning ? uploadWarning + '; ' : '') + 'Translation failed to start';
            }
        }

        // Clean up local file
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json({
            success: true,
            file: dbFile,
            urn: apsUrn,
            warning: uploadWarning,
            mode: fileStatus === 'LOCAL_ONLY' ? 'LOCAL_ONLY (APS unavailable - using mock data)' : 'APS'
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        // Clean up local file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({
            error: 'Upload failed',
            details: error.message,
            apsError: error.response?.data || 'No APS response data'
        });
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
                let objectKey = file.s3Key;
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
            // Decode URN to get object key
            const decodedUrn = Buffer.from(file.apsUrn, 'base64').toString('utf-8');
            // Check if it matches the pattern urn:adsk.objects:os.object:bucketKey/objectName
            const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);

            let objectKey = file.s3Key;

            if (match) {
                objectKey = match[1];
            }

            // Get signed URL
            const signedUrl = await apsOssService.getSignedUrl(objectKey);

            if (!signedUrl) {
                return res.status(500).json({ error: 'Failed to generate signed URL' });
            }

            // Proxy the file download to set correct headers for browser viewing
            const response = await axios.get(signedUrl, {
                responseType: 'stream'
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

        } catch (e) {
            console.error('Download error:', e);
            res.status(500).json({ error: 'Failed to process download' });
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
                userId: user.id,
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

        // 1. Get Metadata (Hierarchy)
        const metadata = await modelDerivativeService.getMetadata(file.apsUrn);

        if (!metadata.data || !metadata.data.metadata || metadata.data.metadata.length === 0) {
            return res.status(404).json({ error: 'No metadata found for this file' });
        }

        const guid = metadata.data.metadata[0].guid; // Get first view (usually 3D)

        // 2. Get Properties
        const properties = await modelDerivativeService.getProperties(file.apsUrn, guid);

        if (!properties || !properties.data || !properties.data.collection) {
            console.warn('BOM Extraction: No properties collection found for URN:', file.apsUrn);
            return res.json([]); // Return empty BOM instead of crashing
        }

        // 3. Process into BOM (flat list of components with properties)
        const bom = properties.data.collection.map((item: any) => {
            return {
                id: item.objectid,
                name: item.name,
                category: item.properties?.Item?.Category || 'Uncategorized',
                family: item.properties?.Item?.Family || item.properties?.Item?.['Family Name'] || '',
                type: item.properties?.Item?.Type || item.properties?.Item?.['Type Name'] || '',
                material: item.properties?.Materials?.Material || item.properties?.Materials?.['Material Name'] || '',
                mass: item.properties?.Mechanical?.Mass,
                volume: item.properties?.Dimensions?.Volume || 0,
                area: item.properties?.Dimensions?.Area || 0,
                length: item.properties?.Dimensions?.Length || 0,
                count: 1,
                allProperties: item.properties
            };
        }).filter((item: any) => item.name && !item.name.startsWith('Non-Revit'));

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

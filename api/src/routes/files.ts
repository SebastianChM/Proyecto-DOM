import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import prisma from '../lib/prisma';
import { apsDataService } from '../services/aps/data-management.service';
import { modelDerivativeService } from '../services/aps/model-derivative.service';

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
            const apsObject = await apsDataService.uploadFile(req.file);
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

        // 4. If LOCAL_ONLY mode, simulate translation after 5 seconds
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
            }, 5000); // 5 second delay to simulate translation
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

// Import file from APS (ACC/BIM 360)
router.post('/import-aps', async (req, res) => {
    try {
        const { projectId, name, urn, apsProjectId, apsFileId } = req.body;

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

        // Create DB record
        const dbFile = await prisma.file.create({
            data: {
                name: name,
                originalName: name,
                type: getFileType('application/octet-stream', name), // Infer type from name
                size: 0, // Unknown size for imported files
                s3Key: 'IMPORTED_FROM_APS',
                apsUrn: urn,
                projectId,
                userId: user.id,
                status: 'READY' // Assumed ready since it's from APS
            }
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

        // Add progress estimation
        const filesWithProgress = files.map(file => {
            let progress = 0;
            if (file.status === 'TRANSLATING') {
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
        if (file.status === 'TRANSLATING') {
            const elapsed = Date.now() - new Date(file.updatedAt).getTime();
            const isLocal = file.apsUrn && file.apsUrn.startsWith('local-');
            const duration = isLocal ? 5000 : 60000; // 5s for local, 60s for real
            // Force minimum 10% to ensure visibility immediately
            (file as any).progress = Math.max(10, Math.min(99, Math.floor((elapsed / duration) * 100)));
        } else if (file.status === 'READY') {
            (file as any).progress = 100;
        }

        if (file.status === 'TRANSLATING' && file.apsUrn && !file.apsUrn.startsWith('local-')) {
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

/**
 * Conversion Module - Main Router
 * 
 * Central router that combines all conversion sub-routes
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

import { modelDerivativeService } from '../../services/aps/model-derivative.service';
import batchRoutes from './batch.routes';
import singleRoutes from './single.routes';
import statusRoutes from './status.routes';

const router = Router();

// ============================================
// UTILITY ENDPOINTS
// ============================================

/**
 * GET /formats
 * Get supported formats from APS
 */
router.get('/formats', async (req: Request, res: Response) => {
    try {
        const formats = await modelDerivativeService.getFormats();
        res.json(formats);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch formats', details: error.message });
    }
});

/**
 * GET /test/download-pdf
 * Test endpoint for direct PDF download (development only)
 */
router.get('/test/download-pdf', (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).send('Not Found');
    }

    console.log('🧪 TEST: Direct PDF download requested');

    const pdfPath = path.resolve(process.cwd(), 'downloads', 'mock-result.pdf');

    if (fs.existsSync(pdfPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="test-download.pdf"');
        fs.createReadStream(pdfPath).pipe(res);
    } else {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="test-download.pdf"');
        res.send('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
    }
});

// ============================================
// SUB-ROUTERS
// ============================================

// Batch routes: /batch, /batch/:batchId, /batch/:batchId/download
router.use('/batch', batchRoutes);

// Status and download routes: /:conversionId, /:conversionId/download, /:conversionId/save-to-project
// These must be before single routes to avoid collision
router.use('/', statusRoutes);

// Single file conversion: /:fileId (POST only)
router.use('/', singleRoutes);

export default router;

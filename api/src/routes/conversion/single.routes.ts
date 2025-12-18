/**
 * Conversion Module - Single File Routes
 * 
 * Endpoints for single file conversions
 */

import { Router, Request, Response } from 'express';
import { prisma, modelDerivativeService, BUCKET_KEY } from './helpers';

const router = Router();

/**
 * POST /:fileId
 * Trigger conversion for a single file
 */
router.post('/:fileId', async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const format = (req.body.format || 'pdf').toLowerCase();

        // Get file record
        const file = await prisma.file.findUnique({ where: { id: fileId } });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (!file.apsUrn) {
            return res.status(400).json({ error: 'File has no URN yet' });
        }

        // Supported formats
        const supportedFormats = ['pdf', 'ifc'];
        if (!supportedFormats.includes(format)) {
            return res.status(400).json({ error: `Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}` });
        }

        // Business rule: Only DWG/DXF can convert to PDF via Model Derivative
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (format === 'pdf' && fileExtension !== 'dwg' && fileExtension !== 'dxf' && fileExtension !== 'rvt') {
            return res.status(400).json({
                error: `Conversión a PDF no disponible para archivos ${fileExtension?.toUpperCase()}.`,
                hint: 'Solo DWG, DXF y RVT pueden convertirse a PDF.'
            });
        }

        // Check for recent completed conversion (avoid duplicates)
        const recentCompleted = await prisma.conversion.findFirst({
            where: {
                fileId,
                targetFormat: format,
                status: 'COMPLETED',
                completedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        if (recentCompleted) {
            return res.status(200).json({
                message: 'Conversion already completed recently',
                conversion: recentCompleted,
                downloadUrl: `/api/conversion/${recentCompleted.id}/download`
            });
        }

        // Check for existing PENDING/PROCESSING job (Deduplication for Predictive Mode)
        const existingActive = await prisma.conversion.findFirst({
            where: {
                fileId,
                targetFormat: format,
                status: { in: ['PENDING', 'PROCESSING'] }
            }
        });

        if (existingActive) {
            return res.status(200).json({
                message: 'Conversion already in progress (Predictive)',
                conversion: existingActive
            });
        }

        // Check concurrent conversions limit
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const activeConversions = await prisma.conversion.count({
            where: {
                file: { uploadedBy: file.uploadedBy },
                status: { in: ['PENDING', 'PROCESSING'] },
                createdAt: { gt: oneHourAgo }
            }
        });

        if (activeConversions >= 50) {
            return res.status(429).json({
                error: 'Too many active conversions',
                message: 'You have reached the limit of 50 concurrent conversions.'
            });
        }

        // Create conversion record
        const conversion = await prisma.conversion.create({
            data: {
                fileId,
                targetFormat: format,
                status: 'PENDING'
            }
        });

        // Handle Local Mode
        if (file.apsUrn.startsWith('local-')) {
            console.log(`🔧 Local mode conversion to ${format} for ${file.name}`);

            await prisma.conversion.update({
                where: { id: conversion.id },
                data: { status: 'PROCESSING' }
            });

            setTimeout(async () => {
                try {
                    await prisma.conversion.update({
                        where: { id: conversion.id },
                        data: {
                            status: 'COMPLETED',
                            completedAt: new Date(),
                            resultUrn: `local-mock-${format}`,
                            resultUrl: `/api/conversion/${conversion.id}/download`
                        }
                    });
                    console.log(`✅ Mock conversion to ${format} completed`);
                } catch (e) {
                    console.error('Failed to update mock conversion:', e);
                }
            }, 1000);

            return res.json({
                success: true,
                conversion: { ...conversion, status: 'PROCESSING' },
                message: 'Mock conversion started'
            });
        }

        // Queue for processing
        console.log(`✅ Job ${conversion.id} enqueued for ${format} conversion.`);

        return res.status(202).json({
            success: true,
            conversion,
            message: 'Conversion queued successfully.'
        });

    } catch (error: any) {
        console.error('Conversion error:', error);
        res.status(500).json({
            error: error.message || 'Internal Server Error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export default router;

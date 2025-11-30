import { Router } from 'express';
import prisma from '../lib/prisma';
import { modelDerivativeService } from '../services/aps/model-derivative.service';
import { designAutomationService } from '../services/aps/design-automation.service';
import { apsAuthService } from '../services/aps/auth.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const router = Router();
const BUCKET_KEY = process.env.APS_BUCKET || 'dom-bim-platform-us-test-001';

// TEST ENDPOINT - Direct PDF download (for testing)
router.get('/test/download-pdf', (req, res) => {
    console.log('🧪 TEST: Direct PDF download requested');

    const pdfPath = path.resolve(process.cwd(), 'downloads', 'mock-result.pdf');
    console.log(`📁 Looking for PDF at: ${pdfPath}`);

    if (fs.existsSync(pdfPath)) {
        console.log('✅ PDF found, sending...');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="test-download.pdf"');
        const stream = fs.createReadStream(pdfPath);
        stream.pipe(res);
    } else {
        console.log('❌ PDF not found, creating a simple one...');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="test-download.pdf"');
        res.send('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
    }
});

// Trigger conversion using Design Automation for DWG->PDF
router.post('/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { format, sheets } = req.body;

        const file = await prisma.file.findUnique({
            where: { id: fileId }
        });

        if (!file || !file.apsUrn) {
            return res.status(404).json({ error: 'File not found or not uploaded to APS' });
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
                            resultUrl: `http://localhost:8080/downloads/mock-result.${format}`
                        }
                    });
                    console.log(`✅ Mock conversion to ${format} completed`);
                } catch (e) {
                    console.error('Failed to update mock conversion:', e);
                }
            }, 5000);

            return res.json({
                success: true,
                conversion: { ...conversion, status: 'PROCESSING' },
                message: 'Mock conversion started'
            });
        }

        console.log(`🔄 Starting ${format} conversion for file: ${file.name}`);

        // For PDF conversion of DWG files, use Design Automation API
        if (format === 'pdf' && (file.name.toLowerCase().endsWith('.dwg') || file.name.toLowerCase().endsWith('.dxf'))) {
            try {
                console.log(`📐 Using Design Automation for DWG/DXF to PDF conversion`);

                // Get the object key from the file (stored when uploaded)
                // The apsUrn is base64 encoded, we need the original object ID
                const decodedUrn = Buffer.from(file.apsUrn, 'base64').toString('utf-8');
                console.log(`📋 Decoded URN: ${decodedUrn}`);

                // Extract object key from URN like "urn:adsk.objects:os.object:bucket/objectkey"
                const objectKeyMatch = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
                const objectKey = objectKeyMatch ? objectKeyMatch[1] : file.name;
                console.log(`📦 Object key: ${objectKey}`);

                // Output PDF object key
                const outputObjectKey = `${objectKey.replace(/\.(dwg|dxf)$/i, '')}-output.pdf`;
                console.log(`📤 Output object key: ${outputObjectKey}`);

                // Start Design Automation work item
                const workItemId = await designAutomationService.convertDwgToPdf(
                    objectKey,
                    outputObjectKey,
                    BUCKET_KEY
                );

                // Store the work item ID for status tracking
                await prisma.conversion.update({
                    where: { id: conversion.id },
                    data: {
                        status: 'PROCESSING',
                        resultUrn: `da-workitem:${workItemId}:${outputObjectKey}`
                    }
                });

            } catch (daError: any) {
                console.error(`❌ Design Automation failed:`, daError.response?.data || daError.message);
                console.log(`⚠️ Design Automation API is likely not enabled (AUTH-001). Falling back to Model Derivative API.`);
                // Fallback to Model Derivative
            }
        }

        // Fallback: Use Model Derivative API (for RVT->PDF, IFC->PDF, or any->IFC, and fallback for DWG)
        try {
            let jobResult;

            // Check manifest for existing derivatives
            try {
                const manifest = await modelDerivativeService.getManifest(file.apsUrn);
                console.log(`📋 Current manifest status: ${manifest.status}`);

                // Look for PDF derivative in SVF2 children (when using 2dviews: pdf)
                if (format === 'pdf' && manifest.derivatives) {
                    for (const derivative of manifest.derivatives) {
                        // Check SVF2 derivatives for PDF children
                        if (derivative.outputType === 'svf2' && derivative.children) {
                            const pdfChild = derivative.children.find((c: any) =>
                                c.mime === 'application/pdf' || c.role === 'pdf-page'
                            );
                            if (pdfChild) {
                                await prisma.conversion.update({
                                    where: { id: conversion.id },
                                    data: {
                                        status: 'COMPLETED',
                                        completedAt: new Date(),
                                        resultUrn: pdfChild.urn,
                                        resultUrl: `/api/conversion/${conversion.id}/download`
                                    }
                                });
                                return res.json({
                                    success: true,
                                    conversion: { ...conversion, status: 'COMPLETED', resultUrn: pdfChild.urn },
                                    message: 'Found existing PDF derivative'
                                });
                            }
                        }
                    }
                }
            } catch (manifestError: any) {
                console.log(`⚠️ Could not get manifest (might be first time):`, manifestError.message);
            }

            if (format === 'pdf') {
                // RVT/IFC to PDF via Model Derivative
                console.log(`📄 Using Model Derivative for ${file.name} to PDF`);
                jobResult = await modelDerivativeService.translateToPDF(file.apsUrn, sheets);
            } else if (format === 'ifc') {
                // Any to IFC via Model Derivative
                console.log(`🏗️ Using Model Derivative for ${file.name} to IFC`);
                jobResult = await modelDerivativeService.translateToIFC(file.apsUrn);
            } else {
                return res.status(400).json({ error: 'Unsupported format' });
            }

            console.log(`✅ Conversion job started:`, jobResult);

            await prisma.conversion.update({
                where: { id: conversion.id },
                data: { status: 'PROCESSING' }
            });

            res.json({ success: true, conversion, job: jobResult });

        } catch (jobError: any) {
            console.error(`❌ APS Conversion failed:`, jobError.response?.data || jobError.message);

            // Log full details for debugging
            if (jobError.response?.data) {
                console.error('Full Error Details:', JSON.stringify(jobError.response.data, null, 2));
            }

            // Mark as failed
            await prisma.conversion.update({
                where: { id: conversion.id },
                data: {
                    status: 'FAILED'
                }
            });

            let errorMessage = 'Conversion failed via Model Derivative API.';
            const diagnostic = jobError.response?.data?.diagnostic;

            if (diagnostic === 'Failed to trigger translation for this file.') {
                errorMessage = 'Conversion blocked by Autodesk. This usually means your App is missing the "Design Automation API" entitlement required for DWG conversion.';
            }

            return res.status(500).json({
                error: 'Conversion failed',
                details: diagnostic || jobError.message,
                reason: jobError.response?.data?.reason || 'Unknown reason',
                message: errorMessage
            });
        }

    } catch (error: any) {
        console.error('Conversion error:', error);
        const status = error.response?.status || 500;
        const message = error.response?.data?.reason || error.message || 'Internal Server Error';
        res.status(status).json({ error: message, details: error.response?.data });
    }
});

// Get conversion status
router.get('/:conversionId', async (req, res) => {
    try {
        const { conversionId } = req.params;
        const conversion = await prisma.conversion.findUnique({
            where: { id: conversionId },
            include: { file: true }
        });

        if (!conversion) {
            return res.status(404).json({ error: 'Conversion not found' });
        }

        // Check Design Automation work item status
        if (conversion.status === 'PROCESSING' && conversion.resultUrn?.startsWith('da-workitem:')) {
            const [, workItemId, outputObjectKey] = conversion.resultUrn.split(':');

            try {
                const status = await designAutomationService.getWorkItemStatusRest(workItemId);
                console.log(`📋 Work item ${workItemId} status: ${status.status}`);

                if (status.status === 'success') {
                    // Work item completed, update conversion
                    await prisma.conversion.update({
                        where: { id: conversionId },
                        data: {
                            status: 'COMPLETED',
                            completedAt: new Date(),
                            resultUrn: `oss:${BUCKET_KEY}/${outputObjectKey}`,
                            resultUrl: `/api/conversion/${conversionId}/download`
                        }
                    });
                    conversion.status = 'COMPLETED';
                    conversion.resultUrl = `/api/conversion/${conversionId}/download`;
                } else if (status.status === 'failed' || status.status === 'cancelled') {
                    await prisma.conversion.update({
                        where: { id: conversionId },
                        data: { status: 'FAILED' }
                    });
                    conversion.status = 'FAILED';
                }
            } catch (e: any) {
                console.error('Failed to check DA status:', e.message);
            }
        }

        // Check Model Derivative manifest for non-DA conversions
        if (conversion.status === 'PROCESSING' && conversion.file.apsUrn && !conversion.resultUrn?.startsWith('da-workitem:')) {
            try {
                const manifest = await modelDerivativeService.getManifest(conversion.file.apsUrn);

                if (manifest.status === 'success') {
                    let foundResource = null;

                    // For PDF conversions, look in SVF2 derivatives (when using 2dviews: pdf)
                    if (conversion.targetFormat === 'pdf') {
                        for (const derivative of manifest.derivatives || []) {
                            if (derivative.outputType === 'svf2' && derivative.children) {
                                // Look for PDF in SVF2 children (can be nested)
                                for (const child of derivative.children) {
                                    // Check direct children
                                    if (child.mime === 'application/pdf' || child.role === 'pdf-page') {
                                        foundResource = child;
                                        break;
                                    }
                                    // Check nested children (PDFs are often nested in 2D views)
                                    if (child.children) {
                                        foundResource = child.children.find((c: any) =>
                                            c.mime === 'application/pdf' || c.role === 'pdf-page'
                                        );
                                        if (foundResource) break;
                                    }
                                }
                                if (foundResource) break;
                            }
                        }
                    } else {
                        // For other formats (IFC, etc.), use original logic
                        const derivative = manifest.derivatives?.find((d: any) =>
                            d.outputType === conversion.targetFormat
                        );

                        if (derivative?.children) {
                            foundResource = derivative.children.find((c: any) =>
                                c.role === '3d' || c.role === '2d' ||
                                c.mime === 'application/pdf' ||
                                c.mime === 'application/x-ifc'
                            );
                        }
                    }

                    if (foundResource) {
                        await prisma.conversion.update({
                            where: { id: conversionId },
                            data: {
                                status: 'COMPLETED',
                                completedAt: new Date(),
                                resultUrn: foundResource.urn,
                                resultUrl: `/api/conversion/${conversionId}/download`
                            }
                        });
                        conversion.status = 'COMPLETED';
                        conversion.resultUrl = `/api/conversion/${conversionId}/download`;
                    }
                } else if (manifest.status === 'failed') {
                    await prisma.conversion.update({
                        where: { id: conversionId },
                        data: { status: 'FAILED' }
                    });
                    conversion.status = 'FAILED';
                }
            } catch (e) {
                console.error('Check manifest failed:', e);
            }
        }

        res.json(conversion);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Download conversion result
router.get('/:conversionId/download', async (req, res) => {
    try {
        const { conversionId } = req.params;
        console.log(`📥 Download request for conversion: ${conversionId}`);

        const conversion = await prisma.conversion.findUnique({
            where: { id: conversionId },
            include: { file: true }
        });

        if (!conversion) {
            return res.status(404).json({ error: 'Conversion not found' });
        }

        const baseFilename = conversion.file.name.replace(/\.[^/.]+$/, '');

        // Handle Local Mode
        if (conversion.file.apsUrn?.startsWith('local-') || conversion.resultUrn?.startsWith('local-mock-')) {
            console.log(`🏠 Local mode detected, serving mock file...`);

            const filename = `${baseFilename}.${conversion.targetFormat}`;
            const localPath = path.resolve(process.cwd(), 'downloads', `mock-result.${conversion.targetFormat}`);

            if (fs.existsSync(localPath)) {
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Type', conversion.targetFormat === 'pdf' ? 'application/pdf' : 'application/octet-stream');
                fs.createReadStream(localPath).pipe(res);
                return;
            }
        }

        // Handle Design Automation result (OSS object)
        if (conversion.resultUrn?.startsWith('oss:')) {
            console.log(`📐 Downloading Design Automation result from OSS`);

            const [, bucketAndKey] = conversion.resultUrn.split('oss:');
            const [bucket, ...keyParts] = bucketAndKey.split('/');
            const objectKey = keyParts.join('/');

            console.log(`📦 Bucket: ${bucket}, Object: ${objectKey}`);

            try {
                const token = await apsAuthService.getInternalToken();
                const url = `https://developer.api.autodesk.com/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}`;

                const response = await axios.get(url, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    responseType: 'arraybuffer'
                });

                console.log(`✅ Downloaded ${response.data.length} bytes from OSS`);

                res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}.pdf"`);
                res.setHeader('Content-Type', 'application/pdf');
                res.send(Buffer.from(response.data));
                return;
            } catch (ossError: any) {
                console.error('OSS download error:', ossError.response?.data || ossError.message);
                return res.status(500).json({ error: 'Failed to download PDF from storage' });
            }
        }

        // Handle Model Derivative result
        if (!conversion.resultUrn) {
            return res.status(404).json({ error: 'Conversion result not ready yet' });
        }

        console.log(`🌐 Downloading Model Derivative: ${conversion.resultUrn}`);

        try {
            const fileBuffer = await modelDerivativeService.getDerivative(conversion.file.apsUrn!, conversion.resultUrn);

            let filename: string;
            let contentType: string;

            if (conversion.targetFormat === 'pdf') {
                filename = `${baseFilename}.pdf`;
                contentType = 'application/pdf';
            } else if (conversion.targetFormat === 'ifc') {
                filename = `${baseFilename}.ifc`;
                contentType = 'application/octet-stream';
            } else {
                filename = `${baseFilename}.${conversion.targetFormat}`;
                contentType = 'application/octet-stream';
            }

            console.log(`✅ Serving file: ${filename} (${fileBuffer.length} bytes)`);

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', contentType);
            res.send(fileBuffer);
        } catch (downloadError: any) {
            console.error('Download error:', downloadError.message);
            return res.status(500).json({ error: 'Failed to download file', details: downloadError.message });
        }

    } catch (error: any) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

export default router;

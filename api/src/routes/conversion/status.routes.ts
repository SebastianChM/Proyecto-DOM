/**
 * Conversion Module - Status and Download Routes
 * 
 * Endpoints for checking status and downloading results
 */

import { Router, Request, Response } from 'express';
import {
    prisma,
    modelDerivativeService,
    designAutomationService,
    apsOssService,
    axios,
    fs,
    path,
    BUCKET_KEY
} from './helpers';

const router = Router();

/**
 * GET /:conversionId
 * Get conversion status
 */
router.get('/:conversionId', async (req: Request, res: Response) => {
    try {
        const { conversionId } = req.params;
        const conversion = await prisma.conversion.findUnique({
            where: { id: conversionId },
            include: { file: true }
        });

        if (!conversion) {
            return res.status(404).json({ error: 'Conversion not found' });
        }

        // Check Design Automation work item status when processing
        if (conversion.status === 'PROCESSING' && conversion.resultUrn?.startsWith('da-workitem:')) {
            const [, workItemId, outputObjectKey] = conversion.resultUrn.split(':');

            try {
                const status = await designAutomationService.getWorkItemStatusRest(workItemId);
                console.log(`📋 Work item ${workItemId} status: ${status.status}`);

                if (status.status === 'success') {
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

                    if (conversion.targetFormat === 'pdf') {
                        // First check for direct PDF derivative
                        let derivative = manifest.derivatives?.find((d: any) => d.outputType === 'pdf');

                        // If not found, check SVF2 derivatives (when using 2dviews: pdf option)
                        if (!derivative) {
                            derivative = manifest.derivatives?.find((d: any) =>
                                d.outputType === 'svf2' &&
                                d.children?.some((c: any) => c.mime === 'application/pdf' || c.role === 'pdf')
                            );
                        }

                        if (derivative?.children) {
                            foundResource = derivative.children.find((c: any) =>
                                c.mime === 'application/pdf' || c.role === 'pdf'
                            );
                        }

                        // Debug logging
                        if (!foundResource) {
                            console.log('📋 Manifest derivatives:', JSON.stringify(manifest.derivatives?.map((d: any) => ({
                                outputType: d.outputType,
                                status: d.status,
                                childrenTypes: d.children?.map((c: any) => ({ role: c.role, mime: c.mime }))
                            })), null, 2));
                        }
                    } else if (conversion.targetFormat === 'ifc') {
                        const derivative = manifest.derivatives?.find((d: any) => d.outputType === 'ifc');
                        if (derivative?.status === 'success' && derivative?.children) {
                            foundResource = derivative.children.find((c: any) => c.role === 'ifc');
                        }
                    } else {
                        const derivative = manifest.derivatives?.find((d: any) => d.outputType === conversion.targetFormat);
                        if (derivative?.children) {
                            foundResource = derivative.children.find((c: any) =>
                                c.role === '3d' || c.role === '2d' ||
                                c.mime === 'application/pdf' ||
                                c.role === conversion.targetFormat
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

/**
 * GET /:conversionId/download
 * Download conversion result
 */
router.get('/:conversionId/download', async (req: Request, res: Response) => {
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
            console.log(`🔐 Downloading Design Automation result from OSS`);

            const [, bucketAndKey] = conversion.resultUrn.split('oss:');
            const [bucket, ...keyParts] = bucketAndKey.split('/');
            const objectKey = keyParts.join('/');

            try {
                const signedUrl = await apsOssService.getSignedUrl(objectKey);
                if (!signedUrl) throw new Error('Failed to get signed URL');

                const response = await axios.get(signedUrl, { responseType: 'arraybuffer' });

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

/**
 * POST /:conversionId/save-to-project
 * Save conversion result to project as new file
 */
router.post('/:conversionId/save-to-project', async (req: Request, res: Response) => {
    try {
        const { conversionId } = req.params;
        console.log(`💾 Save to project request for conversion: ${conversionId}`);

        const conversion = await prisma.conversion.findUnique({
            where: { id: conversionId },
            include: { file: true }
        });

        if (!conversion) {
            return res.status(404).json({ error: 'Conversion not found' });
        }

        const baseFilename = conversion.file.name.replace(/\.[^/.]+$/, '');
        let newFilename = `${baseFilename}.${conversion.targetFormat}`;
        let fileBuffer: Buffer | null = null;
        let uploadedObject: any = null;
        let fileSize = 0;

        // OPTIMIZATION: Check if we can use server-side copy (Design Automation)
        if (conversion.resultUrn?.startsWith('oss:')) {
            console.log(`⚡ FAST PATH: Using server-side copy for Design Automation result`);
            const [, bucketAndKey] = conversion.resultUrn.split('oss:');
            const [bucket, ...keyParts] = bucketAndKey.split('/');
            const sourceObjectKey = keyParts.join('/');

            if (bucket === BUCKET_KEY) {
                try {
                    const safeFilename = newFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const newObjectKey = `${Date.now()}-${safeFilename}`;

                    uploadedObject = await apsOssService.copyObject(sourceObjectKey, newObjectKey);
                    fileSize = uploadedObject.size;
                    console.log(`✅ Server-side copy complete. Size: ${fileSize}`);
                } catch (copyError) {
                    console.warn('⚠️ Server-side copy failed, falling back to download/upload:', copyError);
                }
            }
        }

        if (!uploadedObject) {
            // Handle Local Mode
            if (conversion.file.apsUrn?.startsWith('local-') || conversion.resultUrn?.startsWith('local-mock-')) {
                const localPath = path.resolve(process.cwd(), 'downloads', `mock-result.${conversion.targetFormat}`);
                if (fs.existsSync(localPath)) {
                    fileBuffer = fs.readFileSync(localPath);
                    fileSize = fileBuffer.length;
                    uploadedObject = await apsOssService.uploadBuffer(fileBuffer, newFilename);
                } else {
                    return res.status(404).json({ error: 'Local mock file not found' });
                }
            }
            // Handle OSS result - Fallback
            else if (conversion.resultUrn?.startsWith('oss:')) {
                const [, bucketAndKey] = conversion.resultUrn.split('oss:');
                const [bucket, ...keyParts] = bucketAndKey.split('/');
                const objectKey = keyParts.join('/');

                const signedUrl = await apsOssService.getSignedUrl(objectKey);
                if (!signedUrl) throw new Error('Failed to generate signed URL');

                const response = await axios.get(signedUrl, { responseType: 'arraybuffer' });
                fileBuffer = Buffer.from(response.data);
                fileSize = fileBuffer.length;
                uploadedObject = await apsOssService.uploadBuffer(fileBuffer, newFilename);
            }
            // Handle Model Derivative result
            else if (conversion.resultUrn) {
                if (!conversion.file.apsUrn) throw new Error('Parent file URN is missing');

                const { url: downloadUrl, headers: downloadHeaders } = await modelDerivativeService.getDerivativeDownloadInfo(conversion.file.apsUrn, conversion.resultUrn);

                const response = await axios.get(downloadUrl, {
                    headers: downloadHeaders,
                    responseType: 'arraybuffer',
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });

                fileBuffer = Buffer.from(response.data);
                fileSize = fileBuffer.length;
                uploadedObject = await apsOssService.uploadBuffer(fileBuffer, newFilename);
            }

            if (!uploadedObject) {
                return res.status(400).json({ error: 'Could not retrieve or upload file content' });
            }
        }

        // Create File record in Prisma
        const urn = uploadedObject.objectId ? apsOssService.getDerivativeUrn(uploadedObject.objectId) : `local-${Date.now()}`;

        const newFile = await prisma.file.create({
            data: {
                name: newFilename,
                originalName: newFilename,
                size: fileSize,
                type: conversion.targetFormat === 'pdf' ? 'PDF' : (conversion.targetFormat === 'ifc' ? 'IFC' : 'OTHER'),
                apsUrn: urn,
                s3Key: uploadedObject.objectKey || newFilename,
                projectId: conversion.file.projectId,
                uploadedBy: conversion.file.uploadedBy,
                status: 'UPLOADED'
            }
        });

        // Trigger translation for viewing
        if (newFile.apsUrn && !newFile.apsUrn.startsWith('local-')) {
            try {
                await modelDerivativeService.translateToSVF2(newFile.apsUrn);
                await prisma.file.update({
                    where: { id: newFile.id },
                    data: { status: 'TRANSLATING' }
                });
            } catch (translationError) {
                console.error('Failed to trigger translation:', translationError);
            }
        }

        console.log(`✅ File saved successfully: ${newFile.id}`);
        res.json({ success: true, file: newFile });

    } catch (error: any) {
        console.error('Save to project error:', error);
        res.status(500).json({
            error: 'Failed to save file to project',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export default router;

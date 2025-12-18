import { Router } from 'express';
import prisma from '../lib/prisma';
import { designAutomationService } from '../services/aps/design-automation.service';
import { modelDerivativeService } from '../services/aps/model-derivative.service';
import { apsAuthService } from '../services/aps/auth.service';
import { apsDataManagementService } from '../services/aps/data-management.service';

const router = Router();

/**
 * Handle Design Automation Callbacks
 * POST /api/webhooks/aps/callback
 */
router.post('/aps/callback', async (req, res) => {
    try {
        console.log('📨 Received APS Webhook Callback');

        // Detailed logging of the payload for debugging
        const payload = req.body;
        console.log('📦 Webhook Payload:', JSON.stringify(payload, null, 2));

        // Validate payload structure
        if (!payload || !payload.id || !payload.status) {
            console.warn('⚠️ Invalid webhook payload received');
            return res.status(400).json({ error: 'Invalid payload' });
        }

        const workItemId = payload.id;
        const status = payload.status;

        console.log(`🔄 Processing callback for WorkItem: ${workItemId}, Status: ${status}`);

        // Find the conversion associated with this work item
        // We look for conversions where the resultUrn contains the workItemId
        // Pattern: "da-workitem:{workItemId}:{outputObjectKey}"
        const conversion = await prisma.conversion.findFirst({
            where: {
                resultUrn: {
                    contains: `da-workitem:${workItemId}`
                }
            }
        });

        if (!conversion) {
            console.warn(`⚠️ No conversion found for WorkItem ID: ${workItemId}`);
            // Acknowledge anyway to stop Autodesk from retrying
            return res.status(200).json({ message: 'Conversion not tracked or already deleted' });
        }

        console.log(`✅ Found conversion ${conversion.id} for WorkItem ${workItemId}`);

        if (status === 'success') {
            console.log(`🎉 Design Automation job completed successfully`);

            // Extract output object key from the stored URN
            // stored URN format: "da-workitem:{workItemId}:{outputObjectKey}"
            const parts = conversion.resultUrn?.split(':');
            const outputObjectKey = parts && parts.length >= 3 ? parts[2] : null;

            if (outputObjectKey) {
                // Update conversion to COMPLETED
                const bucketKey = process.env.APS_BUCKET || 'aps-assembly-configurator-dom-demo';

                await prisma.conversion.update({
                    where: { id: conversion.id },
                    data: {
                        status: 'COMPLETED',
                        completedAt: new Date(),
                        resultUrn: `oss:${bucketKey}/${outputObjectKey}`,
                        resultUrl: `/api/conversion/${conversion.id}/download`
                    }
                });
                console.log(`✅ Conversion ${conversion.id} updated to COMPLETED`);
            } else {
                console.error(`❌ Could not parse output key from stored URN: ${conversion.resultUrn}`);
                // Mark as failed if we can't find the result
                await prisma.conversion.update({
                    where: { id: conversion.id },
                    data: { status: 'FAILED' }
                });
            }

        } else if (status === 'failed' || status.status === 'cancelled') {
            console.error(`❌ Design Automation job failed or cancelled`);
            await prisma.conversion.update({
                where: { id: conversion.id },
                data: { status: 'FAILED' }
            });
        } else {
            console.log(`ℹ️ Received update for status: ${status} (No action taken)`);
        }

        // Always return 200 OK to acknowledge receipt
        res.status(200).json({ success: true });

    } catch (error: any) {
        console.error('❌ Error processing webhook:', error);
        // Return 500 to indicate internal error (Autodesk might retry)
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


/**
 * Handle Data Management Webhooks (dm.version.added)
 * POST /api/webhooks/aps/data/callback
 */
router.post('/aps/data/callback', async (req, res) => {
    try {
        const payload = req.body;
        console.log('📨 Received APS Data Management Webhook');
        // console.log('📦 Data Payload:', JSON.stringify(payload, null, 2));

        // 1. Initial Validation
        if (!payload || !payload.hook || !payload.payload) {
            // Autodesk verification challenge uses an empty-ish payload sometimes or specific format
            return res.status(200).end();
        }

        const eventType = payload.hook.event;
        const eventPayload = payload.payload;

        if (eventType === 'dm.version.added') {
            console.log(`🆕 New Version Detected! Project: ${eventPayload.project}, Resource: ${eventPayload.resourceUrn}`);

            // 2. Extract Key Info
            const projectId = eventPayload.project; // APS Project ID (b.xxxx)
            const versionId = eventPayload.version;
            const urn = eventPayload.resourceUrn;

            const localProjectId = payload.hook.scope?.workflowAttribute?.projectId;
            const uploaderId = payload.hook.scope?.workflowAttribute?.userId;

            if (!localProjectId) {
                console.warn('⚠️ Received webhook without local projectId map. Ignoring.');
                return res.status(200).end();
            }

            // 4. Fetch Version Details (to get name, size)
            let fileName = `Autodesk File ${versionId.substring(0, 8)}`;
            let fileType = 'RVT'; // Default guess
            let fileSize = 0;

            try {
                // Get internal 2-legged token
                const internalToken = await apsAuthService.getInternalToken();
                if (internalToken) {
                    const versionDetails = await apsDataManagementService.getVersion(projectId, versionId, internalToken);
                    if (versionDetails) {
                        fileName = versionDetails.name || versionDetails.fileName || fileName;
                        // Derive type from name if fileType is generic or missing, but APS usually gives accurate type
                        if (fileName.includes('.')) {
                            const ext = fileName.split('.').pop();
                            if (ext) fileType = ext.toUpperCase();
                        }

                        fileSize = versionDetails.storageSize || 0;
                        console.log(`📄 Fetched metadata: ${fileName} (${fileSize} bytes)`);
                    }
                }
            } catch (err) {
                console.error('⚠️ Failed to fetch detailed version info, using placeholders:', err);
            }

            // 5. Create/Update File Record
            const existingFile = await prisma.file.findFirst({
                where: { apsUrn: urn }
            });

            if (existingFile) {
                console.log(`ℹ️ File version already exists: ${existingFile.name}`);
            } else {
                console.log(`📝 Registering new file version in Project ${localProjectId}`);

                await prisma.file.create({
                    data: {
                        name: fileName,
                        originalName: fileName,
                        type: fileType,
                        size: fileSize,
                        apsUrn: urn,
                        status: 'UPLOADED',
                        projectId: localProjectId,
                        origin: 'ACC',
                        uploadedBy: uploaderId
                    }
                });

                // 6. Trigger Translation
                console.log(`🔄 Triggering translation for new version...`);
                try {
                    await modelDerivativeService.translateToSVF2(urn);

                    // Update to TRANSLATING
                    await prisma.file.updateMany({
                        where: { apsUrn: urn },
                        data: { status: 'TRANSLATING' }
                    });
                } catch (e: any) {
                    console.error('❌ Failed to auto-trigger translation:', e.message);
                }
            }
        }

        res.status(200).end();
    } catch (error: any) {
        console.error('❌ Error processing Data webhook:', error);
        res.status(500).end();
    }
});

export default router;

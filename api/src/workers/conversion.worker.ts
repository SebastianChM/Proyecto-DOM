
import prisma from '../lib/prisma';
import { modelDerivativeService } from '../services/aps/model-derivative.service';
import { designAutomationService } from '../services/aps/design-automation.service';
import { APP_CONFIG } from '../config/constants';
import * as fs from 'fs';
import { apsOssService } from '../services/aps/oss.service';

const CONCURRENCY_LIMIT = 50;
const POLL_INTERVAL_MS = 2000;

export class ConversionWorker {
    private isRunning: boolean = false;

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🚀 Conversion Worker started. Polling for jobs...');
        this.poll();
    }

    private async poll() {
        if (!this.isRunning) return;

        try {
            await this.processNextBatch();
        } catch (error) {
            console.error('⚠️ Worker polling error:', error);
        }

        setTimeout(() => this.poll(), POLL_INTERVAL_MS);
    }

    private async processNextBatch() {
        const activeCount = await prisma.conversion.count({
            where: { status: 'PROCESSING' }
        });

        if (activeCount >= CONCURRENCY_LIMIT) return;

        const slotsAvailable = CONCURRENCY_LIMIT - activeCount;

        const pendingJobs = await prisma.conversion.findMany({
            where: {
                status: 'PENDING',
                file: {
                    status: { not: 'UPLOADING' }
                }
            },
            orderBy: { createdAt: 'asc' },
            take: slotsAvailable,
            include: { file: true }
        });

        if (pendingJobs.length === 0) return;

        console.log(`👷 Picking up ${pendingJobs.length} pending jobs...`);
        await Promise.all(pendingJobs.map(job => this.executeJob(job)));
    }

    private findPdfInDerivatives(derivatives: any[]): any {
        if (!derivatives) return null;

        // 1. Shallow search (optimization)
        const shallow = derivatives.find((d: any) => d.outputType === 'pdf');
        if (shallow) return shallow; // Optimization: Found at top level

        // 2. Deep recursive search
        const scan = (nodes: any[]): any => {
            for (const node of nodes) {
                // Check for valid PDF resource
                if ((node.mime === 'application/pdf' || node.role === 'pdf-page') && node.urn) {
                    return node;
                }
                if (node.children) {
                    const found = scan(node.children);
                    if (found) return found;
                }
            }
            return null;
        };

        return scan(derivatives);
    }

    private async ensureFileIsOnline(file: any): Promise<string> {
        if (!file.apsUrn) throw new Error('File has no URN');

        // 1. Check if Manifest/URN is accessible
        try {
            await modelDerivativeService.getManifest(file.apsUrn);
            return file.apsUrn; // Accessible
        } catch (e: any) {
            if (e.response?.status !== 404) {
                // Other error, maybe transient, assume URN is correct or let it fail downstream
                return file.apsUrn;
            }
        }

        console.warn(`⚠️ File ${file.name} expired in Cloud (404). Attempting resurrection from local storage...`);

        // 2. Resurrect
        if (!file.localPath || !fs.existsSync(file.localPath)) {
            // Specific error for the User
            console.error(`❌ Resurrection failed: Local backup missing at ${file.localPath}`);
            throw new Error('El archivo ha expirado en la nube y no existe respaldo local. Por favor súbalo nuevamente.');
        }

        console.log(`♻️ Resurrecting ${file.name} from ${file.localPath}...`);

        // Upload again
        const buffer = fs.readFileSync(file.localPath);
        const apsObject = await apsOssService.uploadObject(buffer, file.originalName || file.name);

        // Generate new URN
        const newUrn = apsOssService.getDerivativeUrn((apsObject as any).objectId);

        // Update DB
        await prisma.file.update({
            where: { id: file.id },
            data: { apsUrn: newUrn, status: 'READY' }
        });

        console.log(`✅ Resurrection successful. New URN: ${newUrn}`);
        return newUrn;
    }

    private async executeJob(conversion: any) {
        // Double-check status
        const currentJob = await prisma.conversion.findUnique({ where: { id: conversion.id } });
        if (currentJob?.status !== 'PENDING') return;

        // Mark as PROCESSING
        await prisma.conversion.update({
            where: { id: conversion.id },
            data: { status: 'PROCESSING' }
        });

        const { file, targetFormat, id } = conversion;
        const format = targetFormat;

        try {
            console.log(`🔄 Processing job ${id} (${format})...`);

            // --- SELF-HEALING: Ensure file exists in OSS ---
            // If expired, restore from local backup
            const activeUrn = await this.ensureFileIsOnline(file);
            file.apsUrn = activeUrn; // Update used URN

            if (format === 'pdf' && file.name.toLowerCase().endsWith('.rvt')) {
                await prisma.conversion.update({
                    where: { id: conversion.id },
                    data: { status: 'FAILED', error: 'RVT to PDF requires Design Automation.' }
                });
                return;
            }

            // --- OPTIMIZATION 1: PRE-CHECK EXISTING MANIFEST ---
            // If the user is retrying, the PDF might already exist.
            try {
                const existingManifest = await modelDerivativeService.getManifest(file.apsUrn);
                if (existingManifest.status === 'success') {
                    const existingPdf = this.findPdfInDerivatives(existingManifest.derivatives);
                    if (existingPdf) {
                        console.log(`⚡ INSTANT SUCCESS: Found existing PDF for ${file.name}`);

                        await prisma.conversion.update({
                            where: { id: conversion.id },
                            data: {
                                status: 'COMPLETED',
                                completedAt: new Date(),
                                resultUrn: existingPdf.urn,
                                resultUrl: `/api/conversion/${conversion.id}/download`
                            }
                        });
                        return; // Done!
                    }
                }

                // If failed, delete it to retry cleanly
                if (existingManifest.status === 'failed') {
                    console.log(`⚠️ Deleting failed manifest for ${file.name} to force retry...`);
                    await modelDerivativeService.deleteManifest(file.apsUrn);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (err: any) {
                if (err.response?.status !== 404) {
                    console.warn('⚠️ Pre-check manifest warning:', err.message);
                }
            }


            // --- TRIGGER TRANSLATION ---
            let jobResult;
            if (format === 'pdf') {
                console.log(`📄 Requesting PDF generation for ${file.name}...`);
                jobResult = await modelDerivativeService.translateToPDF(file.apsUrn);
            } else if (format === 'ifc') {
                jobResult = await modelDerivativeService.translateToIFC(file.apsUrn);
            } else {
                throw new Error(`Unsupported format: ${format}`);
            }

            // --- POLL MANIFEST UNTIL COMPLETE ---
            const maxAttempts = 120; // Increased attempts, but checks are faster
            let attempts = 0;
            let foundPdf = false;
            let manifestFailed = false;
            let failReason = '';

            while (attempts < maxAttempts && !foundPdf && !manifestFailed) {
                attempts++;

                // --- OPTIMIZATION 2: ADAPTIVE POLLING ---
                // Wait LESS time for the first checks
                let delay = 5000;
                if (attempts <= 5) delay = 1000;      // First 5s: check every 1s
                else if (attempts <= 15) delay = 2000; // Next 20s: check every 2s

                await new Promise(resolve => setTimeout(resolve, delay));

                try {
                    const manifest = await modelDerivativeService.getManifest(file.apsUrn);

                    // Logic to avoid spamming logs
                    if (attempts % 5 === 0 || manifest.status === 'success' || manifest.status === 'failed') {
                        console.log(`🔍 [Job ${id}] Status: ${manifest.status} (${manifest.progress || '0%'})`);
                    }

                    if (manifest.status === 'failed') {
                        manifestFailed = true;
                        const errorDetails = manifest.derivatives?.find((d: any) => d.status === 'failed')?.messages || [];
                        const errorMessages = errorDetails.map((m: any) => m.message || m.code).join('; ');
                        failReason = `Conversion Failed: ${errorMessages}`;
                        break;
                    }

                    if (manifest.status === 'success') {
                        const pdfDerivative = this.findPdfInDerivatives(manifest.derivatives);

                        if (pdfDerivative) {
                            console.log(`✅ PDF Generated! URN: ${pdfDerivative.urn}`);
                            await prisma.conversion.update({
                                where: { id: conversion.id },
                                data: {
                                    status: 'COMPLETED',
                                    completedAt: new Date(),
                                    resultUrn: pdfDerivative.urn,
                                    resultUrl: `/api/conversion/${conversion.id}/download`
                                }
                            });
                            foundPdf = true;
                            break;
                        } else {
                            // Success but no PDF?
                            if (attempts > 20) { // Wait deeper
                                manifestFailed = true;
                                failReason = 'Conversion success but PDF not found in output.';
                                break;
                            }
                        }
                    }
                } catch (manifestError: any) {
                    // Retry on network errors
                    if (attempts > 20 && manifestError.message.includes('failed')) {
                        manifestFailed = true;
                        failReason = manifestError.message;
                        break;
                    }
                }
            }

            if (manifestFailed) throw new Error(failReason);
            if (!foundPdf) throw new Error('Timeout waiting for conversion.');

        } catch (error: any) {
            let errorMsg = error.message;
            if (error.response?.data?.diagnostic) {
                errorMsg = `Autodesk Rejected: ${error.response.data.diagnostic}`;
            }
            console.error(`❌ Job ${id} Failed:`, errorMsg);

            await prisma.conversion.update({
                where: { id: conversion.id },
                data: { status: 'FAILED', error: errorMsg }
            });
        }
    }
}

export const conversionWorker = new ConversionWorker();

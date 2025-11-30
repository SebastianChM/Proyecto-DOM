import { Router } from 'express';
import prisma from '../lib/prisma';
import { apsComparisonService } from '../services/aps/comparison.service';

const router = Router();

// Trigger comparison between two file versions
router.post('/compare', async (req, res) => {
    try {
        const { projectId, baseFileId, targetFileId, baseVersion, targetVersion } = req.body;

        if (!projectId || !baseFileId || !targetFileId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Fetch files to get URNs
        let baseUrn, targetUrn;

        // Logic to handle Versions if provided
        if (baseVersion && targetVersion && baseFileId === targetFileId) {
            // Comparing versions of the SAME file
            const versions = await prisma.fileVersion.findMany({
                where: {
                    fileId: baseFileId,
                    version: { in: [baseVersion, targetVersion] }
                }
            });

            const v1 = versions.find(v => v.version === baseVersion);
            const v2 = versions.find(v => v.version === targetVersion);

            if (!v1 || !v2) return res.status(404).json({ error: 'Versions not found' });
            
            baseUrn = v1.apsUrn;
            targetUrn = v2.apsUrn;

        } else {
            // Comparing two different files (current versions)
            const baseFile = await prisma.file.findUnique({ where: { id: baseFileId } });
            const targetFile = await prisma.file.findUnique({ where: { id: targetFileId } });

            if (!baseFile || !targetFile) return res.status(404).json({ error: 'Files not found' });
            
            baseUrn = baseFile.apsUrn;
            targetUrn = targetFile.apsUrn;
        }

        if (!baseUrn || !targetUrn) {
            return res.status(400).json({ error: 'Files are not processed yet (missing URN)' });
        }

        // Create Comparison Record
        const comparison = await prisma.comparison.create({
            data: {
                projectId,
                baseFileId,
                targetFileId,
                type: 'RVT_VS_RVT',
                status: 'PROCESSING'
            }
        });

        // Run comparison in background (async)
        apsComparisonService.compareMetadata(baseUrn, targetUrn)
            .then(async (result) => {
                await prisma.comparison.update({
                    where: { id: comparison.id },
                    data: {
                        status: 'COMPLETED',
                        result: JSON.stringify(result),
                        completedAt: new Date()
                    }
                });
            })
            .catch(async (err) => {
                console.error('Comparison failed:', err);
                await prisma.comparison.update({
                    where: { id: comparison.id },
                    data: {
                        status: 'FAILED'
                    }
                });
            });

        res.json(comparison);

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get comparison result
router.get('/:id', async (req, res) => {
    try {
        const comparison = await prisma.comparison.findUnique({
            where: { id: req.params.id },
            include: {
                baseFile: true,
                targetFile: true
            }
        });

        if (!comparison) {
            return res.status(404).json({ error: 'Comparison not found' });
        }

        // Parse result if it exists
        const result = comparison.result ? JSON.parse(comparison.result) : null;

        res.json({ ...comparison, result });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

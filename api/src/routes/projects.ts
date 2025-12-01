import { Router } from 'express';
import prisma from '../lib/prisma';
import { modelDerivativeService } from '../services/aps/model-derivative.service';

const router = Router();

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *               clientName:
 *                 type: string
 *               location:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               discipline:
 *                 type: string
 *     responses:
 *       200:
 *         description: The created project
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
// Create project
router.post('/', async (req, res) => {
    try {
        const { name, description, status, clientName, location, startDate, endDate, discipline } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Get or create temporary user (replace with actual auth later)
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: 'temp@example.com',
                    name: 'Temporary User',
                    apsUserId: 'temp-user-id'
                }
            });
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                status,
                clientName,
                location,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                discipline,
                userId: user.id
            },
            include: {
                _count: {
                    select: { files: true }
                }
            }
        });

        res.json(project);
    } catch (error: any) {
        console.error('Failed to create project:', error);
        res.status(500).json({ error: 'Failed to create project', details: error.message });
    }
});

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: List all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of projects
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
 *       500:
 *         description: Server error
 */
// List projects
router.get('/', async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                files: true,
                _count: {
                    select: { files: true }
                }
            }
        });
        res.json(projects);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project details
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
// Get project by ID
router.get('/:id', async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                files: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        versions: true,
                        conversions: true
                    }
                },
                comparisons: true
            }
        });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check status for translating files
        const updatedFiles = await Promise.all(project.files.map(async (file) => {
            // If file is translating and is NOT a local mock, check APS status
            if (file.status === 'TRANSLATING' && file.apsUrn && !file.apsUrn.startsWith('local-')) {
                try {
                    const manifest = await modelDerivativeService.getManifest(file.apsUrn);

                    if (manifest.status === 'success') {
                        console.log(`✅ Translation completed for ${file.name}`);
                        await prisma.file.update({
                            where: { id: file.id },
                            data: { status: 'READY' }
                        });
                        return { ...file, status: 'READY' };
                    } else if (manifest.status === 'failed') {
                        console.log(`❌ Translation failed for ${file.name}`);
                        await prisma.file.update({
                            where: { id: file.id },
                            data: { status: 'FAILED' }
                        });
                        return { ...file, status: 'FAILED' };
                    }
                } catch (e) {
                    console.error(`Failed to check manifest for ${file.name}:`, e);
                }
            }
            return file;
        }));

        // Add progress estimation to files
        const filesWithProgress = updatedFiles.map(file => {
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

        res.json({ ...project, files: filesWithProgress });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: The updated project
 *       500:
 *         description: Server error
 */
// Update project
router.put('/:id', async (req, res) => {
    try {
        const { name, description, status, clientName, location, startDate, endDate, discipline } = req.body;
        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: {
                name,
                description,
                status,
                clientName,
                location,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                discipline
            }
        });
        res.json(project);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted
 *       500:
 *         description: Server error
 */
// Delete project
router.delete('/:id', async (req, res) => {
    try {
        await prisma.project.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

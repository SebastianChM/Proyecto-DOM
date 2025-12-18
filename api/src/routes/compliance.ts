
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { MopParserService } from '../services/mop-parser.service';
import { SpecParserService } from '../services/spec-parser.service';
import { documentParserService } from '../services/document-parser.service';
import { BimQueryService } from '../services/bim-query.service';
import { ComplianceKernelService } from '../services/compliance-kernel.service';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Instantiate Services
const mopParser = new MopParserService();
const specParser = new SpecParserService();
const bimQuery = new BimQueryService();
const kernel = new ComplianceKernelService();

// Helper: Ensure URN is URL-Safe Base64
function toSafeUrn(urn: string): string {
    if (!urn) return '';
    let safeUrn = urn;
    // 1. If raw 'urn:', encode it
    if (urn.startsWith('urn:')) {
        console.log(`[URN Fix] Encoding raw URN: ${urn}`);
        safeUrn = Buffer.from(urn).toString('base64');
    }
    // 2. Make URL-Safe (Standard Base64 -> URL-Safe)
    // Replace + with -, / with _, remove padding =
    return safeUrn.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * GET /api/compliance/model-status
 * Checks if the Model URN is fully processed and ready for extraction.
 */
router.get('/model-status', async (req, res) => {
    try {
        const urn = req.query.urn as string;
        if (!urn) return res.status(400).json({ error: 'URN required' });

        // Dynamic import to avoid startup circular dependencies
        const { modelDerivativeService } = await import('../services/aps/model-derivative.service');

        // AUTO-FIX: specific logging for debug
        const safeUrn = toSafeUrn(urn);
        console.log(`[ModelStatus] Input: ${urn} -> Safe: ${safeUrn}`);

        const manifest = await modelDerivativeService.getManifest(safeUrn);

        res.json({
            status: manifest.status,
            progress: manifest.progress,
            region: manifest.region,
            messages: manifest.messages
        });
    } catch (error: any) {
        console.error('Manifest Check Error:', error.message);

        // Handle APS Errors gently
        if (error.response?.status === 404) {
            return res.json({ status: 'failed', messages: [{ type: 'error', message: 'Model Not Found in Autodesk (404)' }] });
        }
        if (error.response?.status === 400) {
            return res.json({ status: 'failed', messages: [{ type: 'error', message: 'Invalid URN Format (400)' }] });
        }

        res.status(500).json({ error: 'Failed to check status' });
    }
});

/**
 * POST /api/compliance/analyze/mop
 * Uploads a regulatory PDF (MOP) and returns structured requirements.
 */
router.post('/analyze/mop', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;

        // 1. Extract Text
        const docResult = await documentParserService.parseDocument(filePath, req.file.mimetype);

        // 2. Parse MOP Structure
        const sections = mopParser.parse(docResult.text);

        // 3. Filter Structural (Default behavior for now)
        const structuralSections = mopParser.filterByDiscipline(sections, 'STRUCTURAL');

        // Cleanup
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            metadata: docResult.metadata,
            stats: {
                totalSections: sections.length,
                structuralSections: structuralSections.length
            },
            data: structuralSections
        });

    } catch (error: any) {
        console.error('MOP Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/compliance/analyze/spec
 * Uploads a Project ET (PDF/Doc/Text) and returns Universal Requirements.
 */
router.post('/analyze/spec', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'normativeFile', maxCount: 1 }]), async (req: any, res: any) => {
    try {
        // Files are in req.files['file'] and req.files['normativeFile']
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        let specFile = files['file'] ? files['file'][0] : null;
        const normFile = files['normativeFile'] ? files['normativeFile'][0] : null;

        // Check if a projectFileId was provided (selecting from project files)
        const projectFileId = req.body.projectFileId;
        let tempFilePath: string | null = null;

        if (projectFileId && !specFile) {
            // Fetch the file from project
            const prisma = (await import('../lib/prisma')).default;
            const { apsOssService } = await import('../services/aps/oss.service');
            const axios = (await import('axios')).default;
            const path = await import('path');
            const os = await import('os');

            const dbFile = await prisma.file.findUnique({ where: { id: projectFileId } });

            if (!dbFile) {
                return res.status(404).json({ error: 'Project file not found' });
            }

            if (!dbFile.apsUrn || dbFile.apsUrn.startsWith('local-')) {
                return res.status(400).json({ error: 'Project file not available for analysis (no URN)' });
            }

            // Decode URN to get object key
            const decodedUrn = Buffer.from(dbFile.apsUrn, 'base64').toString('utf-8');
            const match = decodedUrn.match(/urn:adsk\.objects:os\.object:[^/]+\/(.+)/);
            const objectKey = match ? match[1] : dbFile.s3Key;

            if (!objectKey) {
                return res.status(400).json({ error: 'Invalid file record (missing object key)' });
            }

            // Get signed URL and download file
            const signedUrl = await apsOssService.getSignedUrl(objectKey);
            if (!signedUrl) {
                return res.status(500).json({ error: 'Failed to get download URL for project file' });
            }

            // Download to temp file
            const response = await axios.get(signedUrl, { responseType: 'arraybuffer' });
            tempFilePath = path.join(os.tmpdir(), `spec_${Date.now()}_${dbFile.name}`);
            const fs = await import('fs');
            fs.writeFileSync(tempFilePath, Buffer.from(response.data));

            // Create a mock file object for processing
            specFile = {
                path: tempFilePath,
                originalname: dbFile.name,
                mimetype: 'application/pdf',
                size: dbFile.size
            } as Express.Multer.File;

            console.log(`[Analyze] Fetched project file: ${dbFile.name} (${dbFile.size} bytes)`);
        }

        if (!specFile && !normFile) {
            return res.status(400).json({ error: 'No specification or normative file uploaded' });
        }

        // Lazy load services
        const { HierarchicalParserService } = await import('../services/hierarchical-parser.service');
        const { HierarchicalSpecProcessor } = await import('../services/hierarchical-spec-processor');
        const { NormativeParserService } = await import('../services/normative-parser.service');
        const { SupremacyEngineService } = await import('../services/supremacy-engine.service');

        const hierarchyParser = new HierarchicalParserService();
        const hierarchyProcessor = new HierarchicalSpecProcessor();
        const normativeParser = new NormativeParserService();
        const supremacyEngine = new SupremacyEngineService();

        // 1. Parse Project Spec (ET)
        let specRequirements: any[] = [];
        let stats: any = {};

        if (specFile) {
            if (process.env.NODE_ENV !== 'production') {
                const logMsg = `\n[${new Date().toISOString()}] Analyze Request. File: ${specFile.originalname}, Size: ${specFile.size}, MIME: ${specFile.mimetype}`;
                fs.appendFileSync('debug_log.txt', logMsg);
            }

            if (specFile.mimetype === 'application/pdf') {
                console.log(`[Analyze] Parsing Spec PDF: ${specFile.originalname} (${specFile.size} bytes)`);
                const tree = await hierarchyParser.parse(specFile.path);
                console.log(`[Analyze] Tree built with ${tree.length} top-level nodes.`);

                specRequirements = hierarchyProcessor.processTree(tree, '', 'Spec'); // Tag source='Spec'

                if (process.env.NODE_ENV !== 'production') {
                    const resMsg = `\n[${new Date().toISOString()}] Extracted ${specRequirements.length} requirements. Sample: ${JSON.stringify(specRequirements[0] || {})}`;
                    fs.appendFileSync('debug_log.txt', resMsg);
                }

                console.log(`[Analyze] Extracted ${specRequirements.length} requirements from PDF.`);
                if (specRequirements.length > 0) {
                    console.log(`[Analyze] Sample Req:`, JSON.stringify(specRequirements[0], null, 2));
                } else {
                    console.warn(`[Analyze] WARNING: No requirements extracted from PDF!`);
                }

                stats.specNodes = tree.length;
            } else {
                // Fallback for Text/Doc
                // For Phase 2, we strongly encourage PDF for structure, but keep fallback
                const { documentParserService } = await import('../services/document-parser.service');
                const { SpecParserService } = await import('../services/spec-parser.service');
                const specParser = new SpecParserService();
                const docResult = await documentParserService.parseDocument(specFile.path, specFile.mimetype);
                const result = specParser.parse(docResult.text);
                specRequirements = result.requirements.map(r => ({ ...r, source: 'Spec' }));
            }
            // Cleanup Spec file
            if (fs.existsSync(specFile.path)) fs.unlinkSync(specFile.path);
        }

        // 2. Parse Normative (if present)
        let normRequirements: any[] = [];
        if (normFile) {
            console.log(`[Analyze] Parsing Normative PDF: ${normFile.originalname}`);
            // Normative Parser wraps Hierarchical but tags as 'Normative'
            normRequirements = await normativeParser.parse(normFile.path);

            // Clean up Norm file
            if (fs.existsSync(normFile.path)) fs.unlinkSync(normFile.path);
        }

        // 3. Resolve Supremacy (Conflict Logic)
        let finalRequirements = specRequirements;

        if (normRequirements.length > 0) {
            console.log(`[Supremacy] Resolving ${specRequirements.length} Spec Rules vs ${normRequirements.length} Norm Rules...`);
            finalRequirements = supremacyEngine.resolveActiveRules(specRequirements, normRequirements);
            stats.supremacyResolved = true;
            stats.conflictsResolved = finalRequirements.filter((r: any) => r.source === 'Merged').length;
        } else {
            stats.supremacyResolved = false;
        }

        stats.totalRules = finalRequirements.length;

        res.json({
            success: true,
            stats: stats,
            data: finalRequirements
        });

    } catch (error: any) {
        console.error('Spec Analysis Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/compliance/verify
 * Main Entrypoint: Uploads Spec, Queries Model URN, returns Incidents.
 */
router.post('/verify', upload.single('file'), async (req, res) => {
    try {
        if (!req.file && !req.body.checklist) {
            return res.status(400).json({ error: 'No specification file OR checklist provided' });
        }

        const urn = req.body.urn;
        if (!urn) {
            return res.status(400).json({ error: 'No Model URN provided' });
        }

        // AUTO-FIX: Sanitize URN for Verification too
        const safeUrn = toSafeUrn(urn);
        console.log(`🚀 Starting Verification. Mode: ${req.body.checklist ? 'Interactive (Checklist)' : 'Automatic (File)'}`);
        console.log(`[Verify] URN: ${urn} -> Safe: ${safeUrn}`);

        // 1. Parsing Phase (Spec -> Requirements)
        // If 'checklist' is provided (Step 2 of Interactive Audit), use it.
        // Otherwise, parse the uploaded file (Classic Mode).
        let requirements = [];
        let durationMs = 0;

        if (req.body.checklist) {
            try {
                requirements = typeof req.body.checklist === 'string'
                    ? JSON.parse(req.body.checklist)
                    : req.body.checklist;
                console.log(`[Verify] Using cached checklist with ${requirements.length} rules.`);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid checklist format' });
            }
        } else if (req.file) {
            let text = '';
            if (req.file.mimetype === 'text/plain') {
                text = fs.readFileSync(req.file.path, 'utf-8');
            } else {
                const docResult = await documentParserService.parseDocument(req.file.path, req.file.mimetype);
                text = docResult.text;
            }
            const parseResult = specParser.parse(text);
            requirements = parseResult.requirements;
            durationMs = parseResult.parseDurationMs;
        }

        // Filter by Discipline if requested
        const discipline = req.body.discipline || 'ALL';
        if (discipline !== 'ALL') {
            console.log(`[Verify] Filtering requirements for discipline: ${discipline}`);
            requirements = requirements.filter((req: any) => {
                const cat = (req.derivedCategory || '').toUpperCase();

                if (discipline === 'STRUCTURAL') {
                    return cat.includes('CONCRETE') || cat.includes('STEEL') || cat.includes('STRUCT') || cat.includes('HORMIG') || cat.includes('ACERO');
                }
                if (discipline === 'MEP') {
                    return cat.includes('MEP') || cat.includes('ELEC') || cat.includes('MECH') || cat.includes('PIPE') || cat.includes('DUCT');
                }
                if (discipline === 'ARCHITECTURAL') {
                    return cat.includes('ARCH') || cat.includes('WALL') || cat.includes('ROOM') || cat.includes('FINISH');
                }
                return true;
            });
        }

        // 2. Extraction Phase (Model -> Properties)
        const modelProps = await bimQuery.queryModel(safeUrn);

        // 3. Evaluation Phase (Judge)
        const incidents = kernel.evaluate(requirements, modelProps);

        console.log(`✅ Verification Complete. Incidents: ${incidents.length}`);

        res.json({
            success: true,
            stats: {
                requirementsChecked: requirements.length,
                elementsScanned: modelProps.length,
                incidentsFound: incidents.length,
                durationMs: durationMs
            },
            incidents: incidents,
            checklist: requirements.map((req: any) => ({
                id: req.id,
                description: req.originalText,
                category: req.derivedCategory || 'General',
                page: req.page, // Forward page number to frontend
                originalText: req.originalText // also useful for exact matching
            })),
            scannedElements: modelProps.map(p => ({
                id: p.elementId,
                name: p.name,
                category: p.category
            }))
        });

    } catch (error: any) {
        console.error('Verify Error:', error);

        if (error.message && error.message.includes('APS_MODEL_NOT_READY')) {
            return res.status(409).json({
                error: 'Model Processing',
                message: error.message,
                details: 'The BIM model is still being processed by Autodesk. Please try again in a few minutes.'
            });
        }

        // Handle APS Errors in Verification
        if (error.response?.status === 400) {
            return res.status(400).json({ error: 'Invalid URN Format (Autodesk Rejected)', details: error.response.data });
        }

        res.status(500).json({ error: error.message, details: error.response?.data });
    }
});

export default router;

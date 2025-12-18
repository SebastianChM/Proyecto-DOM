/**
 * Compliance Rules API
 * 
 * CRUD operations for validation rules and rulesets
 * Part of Compliance Engine V2 - Professional Rule-Based Validation
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// ============================================================
// RULESETS
// ============================================================

/**
 * GET /api/compliance/rulesets
 * List all rulesets, optionally filtered by discipline or project
 */
router.get('/rulesets', async (req: Request, res: Response) => {
    try {
        const { discipline, projectId, includeDefault } = req.query;

        const where: any = {};

        if (discipline) {
            where.discipline = discipline;
        }

        if (projectId) {
            // Include project-specific and default rulesets
            where.OR = [
                { projectId: projectId },
                { isDefault: true }
            ];
        } else if (includeDefault === 'true') {
            where.isDefault = true;
        }

        const rulesets = await prisma.ruleset.findMany({
            where,
            include: {
                rules: {
                    select: {
                        id: true,
                        name: true,
                        targetCategory: true,
                        severity: true,
                        isActive: true
                    }
                },
                _count: {
                    select: { rules: true, runs: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(rulesets);
    } catch (error: any) {
        console.error('Error fetching rulesets:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/compliance/rulesets/:id
 * Get a single ruleset with all its rules
 */
router.get('/rulesets/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const ruleset = await prisma.ruleset.findUnique({
            where: { id },
            include: {
                rules: {
                    orderBy: { targetCategory: 'asc' }
                }
            }
        });

        if (!ruleset) {
            return res.status(404).json({ error: 'Ruleset not found' });
        }

        res.json(ruleset);
    } catch (error: any) {
        console.error('Error fetching ruleset:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/compliance/rulesets
 * Create a new ruleset
 */
router.post('/rulesets', async (req: Request, res: Response) => {
    try {
        const { name, description, discipline, projectId, isDefault } = req.body;

        if (!name || !discipline) {
            return res.status(400).json({ error: 'Name and discipline are required' });
        }

        const ruleset = await prisma.ruleset.create({
            data: {
                name,
                description,
                discipline,
                projectId,
                isDefault: isDefault || false
            }
        });

        res.status(201).json(ruleset);
    } catch (error: any) {
        console.error('Error creating ruleset:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/compliance/rulesets/:id
 * Update a ruleset
 */
router.put('/rulesets/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, discipline, isDefault } = req.body;

        const ruleset = await prisma.ruleset.update({
            where: { id },
            data: {
                name,
                description,
                discipline,
                isDefault
            }
        });

        res.json(ruleset);
    } catch (error: any) {
        console.error('Error updating ruleset:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/compliance/rulesets/:id
 * Delete a ruleset and all its rules
 */
router.delete('/rulesets/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.ruleset.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting ruleset:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// RULES
// ============================================================

/**
 * GET /api/compliance/rules
 * List all rules, optionally filtered
 */
router.get('/rules', async (req: Request, res: Response) => {
    try {
        const { rulesetId, targetCategory, severity, isActive } = req.query;

        const where: any = {};

        if (rulesetId) where.rulesetId = rulesetId;
        if (targetCategory) where.targetCategory = targetCategory;
        if (severity) where.severity = severity;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const rules = await prisma.rule.findMany({
            where,
            include: {
                ruleset: {
                    select: { id: true, name: true, discipline: true }
                }
            },
            orderBy: [
                { targetCategory: 'asc' },
                { name: 'asc' }
            ]
        });

        res.json(rules);
    } catch (error: any) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/compliance/rules/:id
 * Get a single rule
 */
router.get('/rules/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const rule = await prisma.rule.findUnique({
            where: { id },
            include: {
                ruleset: true
            }
        });

        if (!rule) {
            return res.status(404).json({ error: 'Rule not found' });
        }

        res.json(rule);
    } catch (error: any) {
        console.error('Error fetching rule:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/compliance/rules
 * Create a new rule
 */
router.post('/rules', async (req: Request, res: Response) => {
    try {
        const {
            name,
            description,
            targetCategory,
            targetNamePattern,
            propertyName,
            operator,
            expectedValue,
            unit,
            tolerance,
            severity,
            sourceDocument,
            sourcePage,
            rulesetId,
            isActive
        } = req.body;

        // Validation
        if (!name || !targetCategory || !propertyName || !operator || !expectedValue || !rulesetId) {
            return res.status(400).json({
                error: 'Required fields: name, targetCategory, propertyName, operator, expectedValue, rulesetId'
            });
        }

        // Verify ruleset exists
        const ruleset = await prisma.ruleset.findUnique({ where: { id: rulesetId } });
        if (!ruleset) {
            return res.status(404).json({ error: 'Ruleset not found' });
        }

        const rule = await prisma.rule.create({
            data: {
                name,
                description,
                targetCategory,
                targetNamePattern,
                propertyName,
                operator,
                expectedValue,
                unit,
                tolerance: tolerance ? parseFloat(tolerance) : null,
                severity: severity || 'WARNING',
                sourceDocument,
                sourcePage: sourcePage ? parseInt(sourcePage) : null,
                rulesetId,
                isActive: isActive !== false
            }
        });

        res.status(201).json(rule);
    } catch (error: any) {
        console.error('Error creating rule:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/compliance/rules/:id
 * Update a rule
 */
router.put('/rules/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            targetCategory,
            targetNamePattern,
            propertyName,
            operator,
            expectedValue,
            unit,
            tolerance,
            severity,
            sourceDocument,
            sourcePage,
            isActive
        } = req.body;

        const rule = await prisma.rule.update({
            where: { id },
            data: {
                name,
                description,
                targetCategory,
                targetNamePattern,
                propertyName,
                operator,
                expectedValue,
                unit,
                tolerance: tolerance !== undefined ? parseFloat(tolerance) : undefined,
                severity,
                sourceDocument,
                sourcePage: sourcePage !== undefined ? parseInt(sourcePage) : undefined,
                isActive
            }
        });

        res.json(rule);
    } catch (error: any) {
        console.error('Error updating rule:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/compliance/rules/:id
 * Delete a rule
 */
router.delete('/rules/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.rule.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting rule:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/compliance/rules/bulk
 * Create multiple rules at once
 */
router.post('/rules/bulk', async (req: Request, res: Response) => {
    try {
        const { rules, rulesetId } = req.body;

        if (!Array.isArray(rules) || !rulesetId) {
            return res.status(400).json({ error: 'rules array and rulesetId are required' });
        }

        // Verify ruleset exists
        const ruleset = await prisma.ruleset.findUnique({ where: { id: rulesetId } });
        if (!ruleset) {
            return res.status(404).json({ error: 'Ruleset not found' });
        }

        const createdRules = await prisma.rule.createMany({
            data: rules.map((rule: any) => ({
                ...rule,
                rulesetId,
                tolerance: rule.tolerance ? parseFloat(rule.tolerance) : null,
                sourcePage: rule.sourcePage ? parseInt(rule.sourcePage) : null
            }))
        });

        res.status(201).json({ count: createdRules.count });
    } catch (error: any) {
        console.error('Error creating rules in bulk:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// CATEGORIES (Helper endpoint)
// ============================================================

/**
 * GET /api/compliance/categories
 * Get list of common Revit categories for UI dropdowns
 */
router.get('/categories', async (_req: Request, res: Response) => {
    const categories = {
        ELECTRICAL: [
            'Cable Trays',
            'Cable Tray Fittings',
            'Conduits',
            'Conduit Fittings',
            'Electrical Equipment',
            'Electrical Fixtures',
            'Lighting Fixtures',
            'Lighting Devices',
            'Communication Devices',
            'Data Devices',
            'Fire Alarm Devices',
            'Nurse Call Devices',
            'Security Devices',
            'Telephone Devices'
        ],
        STRUCTURAL: [
            'Structural Columns',
            'Structural Framing',
            'Structural Foundations',
            'Structural Connections',
            'Structural Rebar',
            'Structural Fabric Areas',
            'Structural Fabric Reinforcement'
        ],
        MEP: [
            'Ducts',
            'Duct Fittings',
            'Duct Accessories',
            'Air Terminals',
            'Flex Ducts',
            'Pipes',
            'Pipe Fittings',
            'Pipe Accessories',
            'Plumbing Fixtures',
            'Sprinklers',
            'Mechanical Equipment'
        ],
        ARCHITECTURAL: [
            'Walls',
            'Floors',
            'Roofs',
            'Ceilings',
            'Doors',
            'Windows',
            'Curtain Panels',
            'Curtain Wall Mullions',
            'Stairs',
            'Railings',
            'Ramps',
            'Casework',
            'Furniture',
            'Specialty Equipment'
        ]
    };

    res.json(categories);
});

/**
 * GET /api/compliance/operators
 * Get list of comparison operators for UI dropdowns
 */
router.get('/operators', async (_req: Request, res: Response) => {
    const operators = [
        { value: '==', label: 'Equal to (==)', description: 'Value must be exactly equal' },
        { value: '>=', label: 'Greater or equal (>=)', description: 'Value must be at least' },
        { value: '<=', label: 'Less or equal (<=)', description: 'Value must be at most' },
        { value: '>', label: 'Greater than (>)', description: 'Value must be more than' },
        { value: '<', label: 'Less than (<)', description: 'Value must be less than' },
        { value: 'range', label: 'In range', description: 'Value must be between min-max (e.g., "100-500")' },
        { value: 'exists', label: 'Exists', description: 'Property must exist and have a value' },
        { value: 'contains', label: 'Contains', description: 'Value must contain the specified text' }
    ];

    res.json(operators);
});

export default router;

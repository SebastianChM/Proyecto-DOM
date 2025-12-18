/**
 * Project Members Routes
 * 
 * Rutas para gestionar miembros de proyectos:
 * - Compartir proyectos (invitar usuarios)
 * - Cambiar roles de miembros
 * - Revocar acceso
 * - Listar miembros
 */

import { Router } from 'express';
import prisma from '../lib/prisma';
import { requirePermission } from '../middleware/authorization';
import { authorizationService } from '../services/authorization.service';
import { cacheService } from '../lib/redis';
import { emailService } from '../services/email.service';

const router = Router();

/**
 * GET /api/projects/:id/members
 * Listar miembros de un proyecto
 * Requiere: project:read
 */
import { z } from 'zod';

// Validation Schemas
const inviteMemberSchema = z.object({
    email: z.string().email('Invalid email format'),
    role: z.enum(['EDITOR', 'VIEWER_DOWNLOAD', 'VIEWER'])
});

const updateMemberSchema = z.object({
    role: z.enum(['EDITOR', 'VIEWER_DOWNLOAD', 'VIEWER'])
});

// Helper to extract id as projectId
const getProjectIdFromId = (req: any) => req.params.id;

/**
 * GET /api/projects/:id/permissions
 * Get current user's permissions in a project
 * Returns: { role, permissions[], isOwner }
 */
router.get('/:id/permissions', async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get user permissions
        const permissions = await authorizationService.getUserPermissions(userId, projectId);

        // Check if owner
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        // Get member role (if not owner)
        let role = 'NONE';
        const isOwner = project?.ownerId === userId;

        if (isOwner) {
            role = 'OWNER';
        } else {
            const member = await prisma.projectMember.findUnique({
                where: {
                    projectId_userId: { projectId, userId }
                },
                select: { role: true }
            });
            if (member) {
                role = member.role;
            }
        }

        // Check if admin
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (user?.role === 'ADMIN') {
            role = 'ADMIN';
        }

        res.json({
            role,
            permissions: [...permissions],
            isOwner,
            isAdmin: user?.role === 'ADMIN'
        });
    } catch (error: any) {
        console.error('Error getting permissions:', error);
        res.status(500).json({
            error: 'Failed to get permissions',
            message: error.message
        });
    }
});

/**
 * GET /api/projects/:id/members
 * Listar miembros de un proyecto
 * Requiere: project:read
 */
router.get('/:id/members', requirePermission('project:read', getProjectIdFromId), async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const data = await authorizationService.getProjectMembers(projectId, userId);

        const result = [];

        // Add owner
        if (data.owner) {
            result.push({
                userId: data.owner.id,
                role: 'OWNER',
                user: {
                    name: data.owner.name,
                    email: data.owner.email,
                    picture: undefined // TODO: Add picture support
                }
            });
        }

        // Add members
        data.members.forEach(m => {
            // Avoid adding owner twice if they are also in members list (unlikely but safe)
            if (m.id !== data.owner?.id) {
                result.push({
                    userId: m.id,
                    role: m.role,
                    user: {
                        name: m.name,
                        email: m.email,
                        picture: undefined
                    }
                });
            }
        });

        res.json(result);
    } catch (error: any) {
        console.error('Error listing project members:', error);
        res.status(500).json({
            error: 'Failed to list members',
            message: error.message
        });
    }
});

/**
 * POST /api/projects/:id/members
 * Compartir proyecto con un usuario (invitar)
 * Requiere: member:invite
 */
router.post('/:id/members', requirePermission('member:invite', getProjectIdFromId), async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Validate input
        const validation = inviteMemberSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: (validation.error as any).errors.map((e: any) => ({ path: e.path.join('.'), message: e.message }))
            });
        }

        const { email, role } = validation.data;

        // Buscar usuario por email
        let targetUser = await prisma.user.findUnique({
            where: { email }
        });

        if (!targetUser) {
            // Auto-provision user if they don't exist
            // This allows inviting users who haven't logged in yet
            try {
                targetUser = await prisma.user.create({
                    data: {
                        email,
                        name: email.split('@')[0], // Use email prefix as temporary name
                        apsUserId: `invited-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Temporary unique ID
                        role: 'USER'
                    }
                });
            } catch (createError) {
                console.error('Error auto-provisioning user:', createError);
                return res.status(500).json({
                    error: 'Failed to create user',
                    message: 'No se pudo registrar al usuario invitado'
                });
            }
        }

        // Verificar que no sea el owner
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true }
        });

        if (project?.ownerId === targetUser.id) {
            return res.status(400).json({
                error: 'Cannot share with owner',
                message: 'No puedes compartir un proyecto con su dueño'
            });
        }

        // Send Email Notification
        // Construct link: Dashboard URL / Project ID
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const projectLink = `${baseUrl}/dashboard/projects/${projectId}`;

        // Get inviter name for the email
        const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const inviterName = inviter?.name || 'A user';

        // Get project name
        const projectInfo = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
        const projectName = projectInfo?.name || 'Project';

        // Send email
        await emailService.sendInvitationEmail(
            email,
            inviterName,
            projectName,
            role,
            projectLink
        );

        // Obtener miembro creado con información del invitador
        const member = await prisma.projectMember.findFirst({
            where: {
                projectId,
                userId: targetUser.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Obtener info del invitador por separado
        let invitedBy = null;
        if (member?.invitedBy) {
            invitedBy = await prisma.user.findUnique({
                where: { id: member.invitedBy },
                select: { id: true, name: true, email: true }
            });
        }

        res.status(201).json({
            success: true,
            member: {
                ...member,
                invitedByUser: invitedBy
            }
        });
    } catch (error: any) {
        console.error('Error sharing project:', error);
        res.status(500).json({
            error: 'Failed to share project',
            message: error.message
        });
    }
});

/**
 * PUT /api/projects/:id/members/:userId
 * Cambiar rol de un miembro
 * Requiere: member:update
 */
router.put('/:id/members/:userId', requirePermission('member:update', getProjectIdFromId), async (req, res) => {
    try {
        const projectId = req.params.id;
        const targetUserId = req.params.userId;

        // Validate input
        const validation = updateMemberSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: (validation.error as any).errors.map((e: any) => ({ path: e.path.join('.'), message: e.message }))
            });
        }

        const { role } = validation.data;

        // Verificar que el miembro existe
        const member = await prisma.projectMember.findFirst({
            where: {
                projectId,
                userId: targetUserId
            }
        });

        if (!member) {
            return res.status(404).json({
                error: 'Member not found',
                message: 'El usuario no es miembro de este proyecto'
            });
        }

        // No se puede cambiar rol de OWNER
        if (member.role === 'OWNER') {
            return res.status(400).json({
                error: 'Cannot change owner role',
                message: 'No se puede cambiar el rol del dueño'
            });
        }

        // Actualizar rol
        const updated = await prisma.projectMember.update({
            where: { id: member.id },
            data: { role: role as any },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        // Invalidar cache de permisos
        await cacheService.invalidatePattern(`cache:permissions:${targetUserId}:*`).catch(() => { });

        res.json({
            success: true,
            member: updated
        });
    } catch (error: any) {
        console.error('Error updating member role:', error);
        res.status(500).json({
            error: 'Failed to update role',
            message: error.message
        });
    }
});

/**
 * DELETE /api/projects/:id/members/:userId
 * Revocar acceso a un usuario
 * Requiere: member:remove
 */
router.delete('/:id/members/:userId', requirePermission('member:remove', getProjectIdFromId), async (req, res) => {
    try {
        const projectId = req.params.id;
        const targetUserId = req.params.userId;
        const requesterId = req.session?.user?.id;

        if (!requesterId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Verificar que el miembro existe
        const member = await prisma.projectMember.findFirst({
            where: {
                projectId,
                userId: targetUserId
            }
        });

        if (!member) {
            return res.status(404).json({
                error: 'Member not found',
                message: 'El usuario no es miembro de este proyecto'
            });
        }

        // No se puede revocar al OWNER
        if (member.role === 'OWNER') {
            return res.status(400).json({
                error: 'Cannot remove owner',
                message: 'No se puede remover al dueño del proyecto'
            });
        }

        // Revocar acceso
        const success = await authorizationService.revokeAccess(
            projectId,
            targetUserId,
            requesterId
        );

        if (!success) {
            return res.status(500).json({
                error: 'Failed to revoke access',
                message: 'No se pudo revocar el acceso'
            });
        }

        res.json({
            success: true,
            message: 'Acceso revocado correctamente'
        });
    } catch (error: any) {
        console.error('Error revoking access:', error);
        res.status(500).json({
            error: 'Failed to revoke access',
            message: error.message
        });
    }
});

export default router;

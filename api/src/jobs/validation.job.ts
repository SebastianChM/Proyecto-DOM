/**
 * Validation Job Processor
 * Ejecuta validaciones BIM comparando datos de ETs vs modelo 3D
 */

import { Job } from 'bull';
import prisma from '../lib/prisma';
import { createValidationNotifications } from '../services/validation/notification.service';
import { detectAndNotifyChanges } from '../services/validation/change-detection.service';

interface ValidationElement {
    tag: string;
    type?: string;
    [key: string]: unknown;
}

export interface ValidationJobPayload {
    validationRunId: string;
    fileId: string;
    projectId?: string;
    userId: string;
    etData: ValidationElement[];
    modelData: ValidationElement[];
}

interface IssueData {
    type: 'MISSING' | 'MISMATCH' | 'UNDOCUMENTED';
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    elementTag: string;
    elementType: string;
    message: string;
    description: string;
    expectedValue?: string;
    actualValue?: string;
}

export const validationJob = async (job: Job<ValidationJobPayload>) => {
    const { validationRunId, fileId, projectId, userId, etData, modelData } = job.data;

    console.log(`[Worker] Starting validation job ${job.id} for run ${validationRunId}`);

    try {
        // 1. Actualizar estado a PROCESSING
        const validationRun = await prisma.validationRun.update({
            where: { id: validationRunId },
            data: { status: 'PROCESSING' },
            select: { fileName: true, id: true }
        });

        console.log(`[Worker] Processing validation for ${validationRun.fileName}`);

        // 2. Ejecutar lógica de validación
        const issuesData: IssueData[] = [];
        const isDemoMode = process.env.DEMO_MODE === 'true';

        if (etData?.length > 0 && modelData?.length > 0) {
            const etTags = new Set(etData.map(item => item.tag));
            const modelTags = new Set(modelData.map(item => item.tag));

            // Elementos faltantes en modelo
            for (const item of etData) {
                if (!modelTags.has(item.tag)) {
                    issuesData.push({
                        type: 'MISSING',
                        severity: 'HIGH',
                        elementTag: item.tag,
                        elementType: item.type || 'Unknown',
                        message: `Element ${item.tag} is in the engineering table but missing in the 3D model`,
                        description: `Expected element with tag "${item.tag}" was not found in the model`
                    });
                }
            }

            // Elementos no documentados (en modelo pero no en ET)
            for (const item of modelData) {
                if (!etTags.has(item.tag)) {
                    issuesData.push({
                        type: 'UNDOCUMENTED',
                        severity: 'MEDIUM',
                        elementTag: item.tag,
                        elementType: item.type || 'Unknown',
                        message: `Element ${item.tag} exists in the model but is not documented in the engineering table`,
                        description: `Found undocumented element "${item.tag}" in the model`
                    });
                }
            }

            // Verificar discrepancias de propiedades
            for (const etItem of etData) {
                const modelItem = modelData.find(m => m.tag === etItem.tag);
                if (modelItem && etItem.type && modelItem.type && etItem.type !== modelItem.type) {
                    issuesData.push({
                        type: 'MISMATCH',
                        severity: 'MEDIUM',
                        elementTag: etItem.tag,
                        elementType: etItem.type,
                        message: `Type mismatch for ${etItem.tag}: ET shows "${etItem.type}", model shows "${modelItem.type}"`,
                        description: `Property mismatch detected`,
                        expectedValue: etItem.type,
                        actualValue: modelItem.type
                    });
                }
            }
        } else if (isDemoMode) {
            // Modo demo: generar issues de ejemplo solo si DEMO_MODE está activo
            console.log('[Worker] Demo mode active - generating sample validation issues');
            issuesData.push({
                type: 'MISSING',
                severity: 'HIGH',
                elementTag: 'DEMO-101',
                elementType: 'Wall',
                message: 'Demo Issue: Wall missing in model',
                description: 'This is a simulated issue for demo purposes.'
            });
            issuesData.push({
                type: 'MISMATCH',
                severity: 'MEDIUM',
                elementTag: 'DEMO-102',
                elementType: 'Door',
                message: 'Demo Issue: Type mismatch for Door',
                description: 'Property mismatch detected in demo mode.',
                expectedValue: 'Wood',
                actualValue: 'Steel'
            });
        }

        // 3. Guardar issues en base de datos
        if (issuesData.length > 0) {
            await prisma.validationIssue.createMany({
                data: issuesData.map(issue => ({
                    validationRunId: validationRun.id,
                    type: issue.type,
                    severity: issue.severity,
                    status: 'OPEN',
                    elementTag: issue.elementTag,
                    elementType: issue.elementType,
                    message: issue.message,
                    description: issue.description,
                    expectedValue: issue.expectedValue || null,
                    actualValue: issue.actualValue || null
                }))
            });
        }

        // 4. Calcular estadísticas
        const missingCount = issuesData.filter(i => i.type === 'MISSING').length;
        const mismatchCount = issuesData.filter(i => i.type === 'MISMATCH').length;
        const undocumentedCount = issuesData.filter(i => i.type === 'UNDOCUMENTED').length;
        const totalElements = (etData?.length || 0) + (modelData?.length || 0);

        // 5. Actualizar resultado de validación
        await prisma.validationRun.update({
            where: { id: validationRun.id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                totalElements,
                missingCount,
                mismatchCount,
                undocumentedCount
            }
        });

        // 6. Crear notificaciones
        await createValidationNotifications(
            validationRun.id,
            userId,
            fileId,
            projectId || null
        );

        // 7. Detección automática de cambios
        await detectAndNotifyChanges(fileId, validationRun.id, userId, projectId || null);

        console.log(`[Worker] Validation job ${job.id} completed successfully`);
        return { success: true };

    } catch (error: unknown) {
        console.error(`[Worker] Validation job failed:`, error);

        await prisma.validationRun.update({
            where: { id: validationRunId },
            data: { status: 'FAILED' }
        });

        throw error;
    }
};

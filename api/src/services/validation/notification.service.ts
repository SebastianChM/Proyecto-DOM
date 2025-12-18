
import prisma from '../../lib/prisma';
import { redis } from '../../lib/redis';

/**
 * Create notifications for validation completion
 */
export async function createValidationNotifications(
    validationRunId: string,
    userId: string,
    fileId: string,
    projectId: string | null
) {
    try {
        const validationRun = await prisma.validationRun.findUnique({
            where: { id: validationRunId },
            include: {
                issues: {
                    where: { status: 'OPEN' },
                    orderBy: { severity: 'desc' },
                    take: 5 // Top 5 critical issues
                }
            }
        })

        if (!validationRun) return

        const notifications = []

        // Main validation completion notification
        const totalIssues = validationRun.missingCount + validationRun.mismatchCount + validationRun.undocumentedCount

        const priority = totalIssues > 10 ? 'HIGH' : totalIssues > 5 ? 'NORMAL' : 'LOW'

        notifications.push({
            userId,
            type: 'VALIDATION_COMPLETE',
            title: 'Validation Complete',
            message: `Validation of "${validationRun.fileName}" found ${totalIssues} issues: ${validationRun.missingCount} missing, ${validationRun.mismatchCount} mismatches, ${validationRun.undocumentedCount} undocumented`,
            validationRunId,
            fileId,
            projectId,
            priority,
            metadata: JSON.stringify({
                totalIssues,
                missingCount: validationRun.missingCount,
                mismatchCount: validationRun.mismatchCount,
                undocumentedCount: validationRun.undocumentedCount
            })
        })

        // Individual notifications for critical issues
        for (const issue of validationRun.issues) {
            if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
                notifications.push({
                    userId,
                    type: 'ISSUE_CREATED',
                    title: `${issue.severity} Issue Found`,
                    message: `${issue.type}: ${issue.message}`,
                    validationRunId,
                    issueId: issue.id,
                    fileId,
                    projectId,
                    priority: issue.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
                    metadata: JSON.stringify({
                        issueType: issue.type,
                        elementTag: issue.elementTag,
                        elementType: issue.elementType
                    })
                })
            }
        }


        // Create all notifications in DB
        await prisma.notification.createMany({
            data: notifications
        })

        // Publish real-time events via Redis to API nodes
        for (const n of notifications) {
            try {
                const payload = {
                    userId: n.userId,
                    event: 'notification', // Standard event name for frontend to listen
                    data: n
                };
                await redis.publish('worker:notifications', JSON.stringify(payload));
            } catch (err) {
                console.error('Failed to publish notification to Redis:', err);
            }
        }

        return notifications.length
    } catch (error) {
        console.error('Error creating validation notifications:', error)
        throw error
    }
}


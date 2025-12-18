import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { Queues } from '../lib/queue'

const router = Router()
const prisma = new PrismaClient()

/**
 * Perform a full validation (Async via Worker)
 * POST /api/validation/run
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      fileId,
      fileName,
      fileUrn,
      projectId,
      userId,
      etData,        // Engineering Table data
      modelData,     // 3D model data
      validationRules
    } = req.body

    // 1. Create validation run record (PENDING)
    const validationRun = await prisma.validationRun.create({
      data: {
        fileId,
        fileName,
        fileUrn,
        projectId,
        userId,
        validationType: 'STRUCTURE',
        validationRules: validationRules ? JSON.stringify(validationRules) : null,
        status: 'PENDING'
      }
    })

    // 2. Add job to queue
    await Queues.validation.add({
      validationRunId: validationRun.id,
      fileId,
      projectId,
      userId,
      etData,
      modelData
    });

    // 3. Return accepted response
    res.status(202).json({
      success: true,
      message: 'Validation job queued successfully',
      data: {
        validationRunId: validationRun.id,
        status: 'PENDING'
      }
    })
  } catch (error) {
    console.error('Error queuing validation:', error)
    res.status(500).json({ success: false, error: 'Failed to queue validation' })
  }
})

/**
 * Get validation history for a file
 * GET /api/validation/history/:fileId
 */
router.get('/history/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params

    const validations = await prisma.validationRun.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { issues: true }
        }
      }
    })

    res.json({ success: true, data: validations })
  } catch (error) {
    console.error('Error fetching validation history:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch validation history' })
  }
})

export default router


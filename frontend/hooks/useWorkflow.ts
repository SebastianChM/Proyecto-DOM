"use client"

/**
 * useWorkflow Hook
 * 
 * React hook for managing workflow state and operations.
 * Provides easy access to workflow instance, transitions, and actions.
 */

import { useState, useEffect, useCallback } from "react"
import apiClient from "@/lib/axios-config"
import { toast } from "sonner"

// ============================================
// TYPES
// ============================================

export type EntityType = 'PROJECT' | 'FILE' | 'VALIDATION'

export interface WorkflowState {
    name: string
    displayName: string
    color: string
    icon?: string
}

export interface AvailableTransition {
    id: string
    name: string
    displayName: string
    description?: string
    icon?: string
    buttonVariant: string
    requireComment: boolean
    requireConfirmation: boolean
    confirmationMessage?: string
    toState: WorkflowState
}

export interface WorkflowTemplate {
    id: string
    name: string
    code: string
    description?: string
    entityType: string
}

export interface WorkflowInstance {
    id: string
    templateId: string
    entityType: string
    entityId: string
    currentStateId: string
    currentStateName: string
    currentStateDisplay: string
    currentStateColor: string
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'SUSPENDED'
    startedAt: string
    completedAt?: string
    template?: WorkflowTemplate
    availableTransitions: AvailableTransition[]
    userRole: string
}

export interface WorkflowHistoryEntry {
    id: string
    fromStateName: string
    fromStateDisplay: string
    toStateName: string
    toStateDisplay: string
    transitionName?: string
    transitionDisplay?: string
    performedById: string
    performedByName: string
    performedByEmail?: string
    performedAt: string
    comment?: string
    durationInPreviousState?: number
}

export interface TransitionInput {
    transitionName: string
    comment?: string
    metadata?: Record<string, unknown>
}

export interface UseWorkflowReturn {
    // State
    workflow: WorkflowInstance | null
    history: WorkflowHistoryEntry[]
    loading: boolean
    historyLoading: boolean
    error: string | null

    // Derived state
    currentState: string
    currentStateDisplay: string
    currentStateColor: string
    isActive: boolean
    isCompleted: boolean
    availableTransitions: AvailableTransition[]
    userRole: string

    // Actions
    refresh: () => Promise<void>
    refreshHistory: () => Promise<void>
    performTransition: (input: TransitionInput) => Promise<boolean>
    canTransition: (transitionName: string) => boolean
    getTransition: (transitionName: string) => AvailableTransition | undefined
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useWorkflow(
    entityType: EntityType,
    entityId: string | null | undefined,
    options: {
        autoFetch?: boolean
        fetchHistory?: boolean
        onTransition?: (workflow: WorkflowInstance) => void
        onError?: (error: string) => void
    } = {}
): UseWorkflowReturn {
    const {
        autoFetch = true,
        fetchHistory: shouldFetchHistory = false,
        onTransition,
        onError
    } = options

    // State
    const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null)
    const [history, setHistory] = useState<WorkflowHistoryEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Fetch workflow
    const fetchWorkflow = useCallback(async () => {
        if (!entityId) {
            setWorkflow(null)
            return
        }

        try {
            setLoading(true)
            setError(null)

            const response = await apiClient.get(`/api/workflows/${entityType}/${entityId}`)
            setWorkflow(response.data)

        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { message?: string; code?: string } } }
            const message = axiosError.response?.data?.message || 'Error al cargar workflow'
            const code = axiosError.response?.data?.code

            // Don't show error for template not found (just means no workflow configured)
            if (code !== 'WORKFLOW_TEMPLATE_NOT_FOUND') {
                setError(message)
                onError?.(message)
            }

            setWorkflow(null)
        } finally {
            setLoading(false)
        }
    }, [entityType, entityId, onError])

    // Fetch history
    const fetchHistory = useCallback(async () => {
        if (!entityId) {
            setHistory([])
            return
        }

        try {
            setHistoryLoading(true)
            const response = await apiClient.get(
                `/api/workflows/${entityType}/${entityId}/history`,
                { params: { limit: 50 } }
            )
            setHistory(response.data)
        } catch (err) {
            console.error('Error fetching workflow history:', err)
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }, [entityType, entityId])

    // Perform transition
    const performTransition = useCallback(async (input: TransitionInput): Promise<boolean> => {
        if (!entityId || !workflow) {
            toast.error('Error', { description: 'No hay workflow activo' })
            return false
        }

        try {
            setLoading(true)

            const response = await apiClient.post(
                `/api/workflows/${entityType}/${entityId}/transition`,
                input
            )

            const updatedWorkflow = response.data.workflow
            setWorkflow(updatedWorkflow)
            onTransition?.(updatedWorkflow)

            toast.success('Estado actualizado', {
                description: `Cambió a "${updatedWorkflow.currentStateDisplay}"`
            })

            // Refresh history if we were tracking it
            if (shouldFetchHistory) {
                fetchHistory()
            }

            return true

        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { message?: string } } }
            const message = axiosError.response?.data?.message || 'Error al cambiar estado'

            toast.error('Error en transición', { description: message })
            onError?.(message)

            return false
        } finally {
            setLoading(false)
        }
    }, [entityType, entityId, workflow, onTransition, onError, shouldFetchHistory, fetchHistory])

    // Check if transition is available
    const canTransition = useCallback((transitionName: string): boolean => {
        if (!workflow || workflow.status !== 'ACTIVE') return false
        return workflow.availableTransitions.some(t => t.name === transitionName)
    }, [workflow])

    // Get transition by name
    const getTransition = useCallback((transitionName: string): AvailableTransition | undefined => {
        return workflow?.availableTransitions.find(t => t.name === transitionName)
    }, [workflow])

    // Auto-fetch on mount and when entity changes
    useEffect(() => {
        if (autoFetch && entityId) {
            fetchWorkflow()
            if (shouldFetchHistory) {
                fetchHistory()
            }
        }
    }, [autoFetch, entityId, fetchWorkflow, shouldFetchHistory, fetchHistory])

    // Derived state
    const currentState = workflow?.currentStateName || ''
    const currentStateDisplay = workflow?.currentStateDisplay || ''
    const currentStateColor = workflow?.currentStateColor || '#6B7280'
    const isActive = workflow?.status === 'ACTIVE'
    const isCompleted = workflow?.status === 'COMPLETED'
    const availableTransitions = workflow?.availableTransitions || []
    const userRole = workflow?.userRole || 'NONE'

    return {
        // State
        workflow,
        history,
        loading,
        historyLoading,
        error,

        // Derived state
        currentState,
        currentStateDisplay,
        currentStateColor,
        isActive,
        isCompleted,
        availableTransitions,
        userRole,

        // Actions
        refresh: fetchWorkflow,
        refreshHistory: fetchHistory,
        performTransition,
        canTransition,
        getTransition
    }
}

export default useWorkflow

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import apiClient from "@/lib/axios-config"
import {
    Upload, FileText, Box, Layers, MoreVertical, RefreshCw,
    Clock, HardDrive, CheckCircle, Trash2, GitCompare,
    CheckSquare, X, Search, Users, UserPlus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ViewerModal } from "@/components/ViewerModal"
import { ApsBrowser } from "@/components/ApsBrowser"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

// New Components
import { ProjectHeader } from "@/components/ProjectHeader"
import { ProjectDetailsPanel } from "@/components/ProjectDetailsPanel"
import { EmptyState } from "@/components/EmptyState"
import { FileRow } from "@/components/FileRow"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs-simple"
import { ProjectSettingsModal, ProjectMember } from "@/components/ProjectSettingsModal"
import { ConversionTracker, ActiveConversion } from "@/components/ConversionTracker"
import { ShareProjectDialog } from "@/components/ShareProjectDialog"
import { ProjectMembersList } from "@/components/ProjectMembersList"
import { useProjectPermissions } from "@/hooks/useProjectPermissions"

interface ProjectFile {
    id: string
    name: string
    size: number
    type: string
    status: string
    apsUrn: string | null
    createdAt: string
    progress?: number
    apsProjectId?: string
}

interface Project {
    id: string
    name: string
    description: string | null
    files: ProjectFile[]
    // Mock fields for now
    clientName?: string
    location?: string
    startDate?: string
    endDate?: string
    status?: "Active" | "Archived" | "Draft"
    discipline?: string
}

export default function ProjectDetailPage() {
    const params = useParams()
    const { user } = useUser()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isApsBrowserOpen, setIsApsBrowserOpen] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [convertingFiles, setConvertingFiles] = useState<Set<string>>(new Set()) // Used in handleBulkConvert
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [translatingFiles, setTranslatingFiles] = useState<Set<string>>(new Set())
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [viewerModal, setViewerModal] = useState<{ isOpen: boolean, file: ProjectFile, token?: string } | null>(null)
    const [supportedFormats, setSupportedFormats] = useState<Record<string, string[]> | null>(null)

    // Delete state
    const [fileToDelete, setFileToDelete] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletingFile, setDeletingFile] = useState(false)

    // Download state
    const [downloadModal, setDownloadModal] = useState<{ isOpen: boolean, url: string, format: string, conversionId?: string } | null>(null)

    // Active conversions state (for visual tracker)
    const [activeConversions, setActiveConversions] = useState<ActiveConversion[]>([])

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [members, setMembers] = useState<ProjectMember[]>([])

    // Share dialog state
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)

    const projectId = params.id as string
    const router = useRouter()

    // RBAC Permissions
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { can, role, isOwner, refresh: refreshPermissions } = useProjectPermissions(projectId)

    // UI State
    const [searchTerm, setSearchTerm] = useState("")
    const [activeFilter, setActiveFilter] = useState("ALL") // ALL, RVT, DWG, PDF, IFC, OTHER

    // Filtered Files Logic
    const filteredFiles = project?.files.filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter = activeFilter === "ALL" || file.type === activeFilter
        return matchesSearch && matchesFilter
    }) || []

    // Group files by type for "ALL" view
    const groupedFiles = activeFilter === "ALL"
        ? {
            RVT: filteredFiles.filter(f => f.type === 'RVT'),
            DWG: filteredFiles.filter(f => f.type === 'DWG'),
            PDF: filteredFiles.filter(f => f.type === 'PDF'),
            IFC: filteredFiles.filter(f => f.type === 'IFC'),
            OTHER: filteredFiles.filter(f => !['RVT', 'DWG', 'PDF', 'IFC'].includes(f.type))
        }
        : null

    useEffect(() => {
        const fetchFormats = async () => {
            try {
                const response = await apiClient.get('/api/conversion/formats')
                if (response.data && response.data.formats) {
                    setSupportedFormats(response.data.formats)
                }
            } catch (error) {
                console.warn("Failed to fetch supported formats", error)
            }
        }
        fetchFormats()
    }, [])

    const isConversionSupported = (fileType: string, targetFormat: string) => {
        const ext = fileType.toLowerCase()
        const format = targetFormat.toLowerCase()

        // ===== BUSINESS RULE: PDF CONVERSION =====
        // ONLY DWG (and DXF) files can be converted to PDF
        // This is because Revit, IFC and other formats require Design Automation 
        // with compiled AppBundles which is not yet configured
        if (format === 'pdf') {
            // Only allow DWG -> PDF conversion
            return ext === 'dwg' || ext === 'dxf';
        }

        // ===== BUSINESS RULE: IFC CONVERSION =====
        // RVT, DWG can be converted to IFC
        if (format === 'ifc') {
            // Prevent IFC -> IFC
            if (ext === 'ifc') return false;
            // Allow RVT, DWG to IFC
            return ['rvt', 'dwg'].includes(ext);
        }

        // For other formats, use the fetched supported formats
        if (!supportedFormats) return false

        if (supportedFormats[format] && supportedFormats[format].includes(ext)) {
            return true
        }

        return false
    }


    const fetchProject = useCallback(async () => {
        try {
            const response = await apiClient.get(`/api/projects/${projectId}`)
            setProject(response.data)
        } catch (error) {
            showError(error, user?.role, "Failed to load project details")
        } finally {
            setLoading(false)
        }
    }, [projectId, user?.role])

    useEffect(() => {
        if (projectId) {
            fetchProject()
        }
    }, [projectId, fetchProject])

    const checkFileStatuses = useCallback(async () => {
        if (!project) return;

        const processingFiles = project.files.filter(f =>
            f.status === 'TRANSLATING' || f.status === 'PROCESSING' || f.status === 'PENDING'
        );

        if (processingFiles.length === 0) return;

        try {
            const response = await apiClient.post('/api/files/sync-status', {
                fileIds: processingFiles.map(f => f.id)
            });

            // Always update progress for all files returned
            if (response.data.files && response.data.files.length > 0) {
                setProject(prev => {
                    if (!prev) return null;
                    const newFiles = prev.files.map(f => {
                        const fileUpdate = response.data.files.find((u: { id: string; status: string; progress: number }) => u.id === f.id);
                        if (fileUpdate) {
                            return {
                                ...f,
                                status: fileUpdate.status,
                                progress: fileUpdate.progress
                            };
                        }
                        return f;
                    });
                    return { ...prev, files: newFiles };
                });
            }

            // Show toasts for status changes
            if (response.data.updates && response.data.updates.length > 0) {
                response.data.updates.forEach((u: { id: string; status: string }) => {
                    if (u.status === 'READY') {
                        toast.success("File processing completed!");
                    } else if (u.status === 'FAILED') {
                        toast.error("File processing failed.");
                    }
                });
            }
        } catch (error) {
            console.warn("Failed to sync file statuses", error);
        }
    }, [project]);

    useEffect(() => {
        if (!project) return;

        const hasProcessingFiles = project.files.some(f =>
            f.status === 'TRANSLATING' || f.status === 'PROCESSING' || f.status === 'PENDING'
        );

        if (hasProcessingFiles) {
            const interval = setInterval(() => {
                checkFileStatuses();
            }, 5000); // Poll every 5 seconds

            return () => clearInterval(interval);
        }
    }, [project, checkFileStatuses]);

    const toggleFileSelection = (fileId: string) => {
        setSelectedFiles(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId)
            } else {
                return [...prev, fileId]
            }
        })
    }

    const toggleSelectAll = () => {
        if (!project) return

        // If all files are already selected, deselect all
        if (selectedFiles.length === project.files.length && project.files.length > 0) {
            setSelectedFiles([])
        } else {
            // Otherwise, select all files
            setSelectedFiles(project.files.map(f => f.id))
        }
    }

    const handleUpdateProject = async (data: Record<string, string | undefined>) => {
        try {
            await apiClient.put(`/api/projects/${projectId}`, {
                status: data.projectType,
                discipline: data.discipline,
                clientName: data.ownerName,
                location: data.location,
                startDate: data.startDate,
                endDate: data.endDate,
                description: data.notes
            });
            toast.success("Project details updated successfully");
            fetchProject();
        } catch (error) {
            showError(error, user?.role, "Failed to update project details");
        }
    }

    const handleBatchDownload = async () => {
        if (selectedFiles.length === 0) return

        if (selectedFiles.length > 2) {
            try {
                toast.info("Preparing ZIP archive...")
                const response = await apiClient.post('/api/files/batch-download', {
                    fileIds: selectedFiles
                }, {
                    responseType: 'blob'
                })

                const url = window.URL.createObjectURL(new Blob([response.data]))
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', `project_files_${Date.now()}.zip`)
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(url)

                toast.success("ZIP download started")
            } catch (error) {
                console.error("Batch download failed:", {
                    error: error instanceof Error ? error.message : String(error),
                    selectedCount: selectedFiles.length
                })
                showError(error, user?.role, "Batch download failed")
                toast.error("Failed to create ZIP archive")
            }
        } else {
            selectedFiles.forEach((fileId, index) => {
                setTimeout(() => {
                    window.open(`/api/files/${fileId}/download`, '_blank')
                }, index * 1000)
            })
            toast.success(`Started download for ${selectedFiles.length} files`)
        }
    }

    const handleBulkConvert = async (format: 'pdf' | 'ifc') => {
        if (selectedFiles.length === 0) return

        const validFiles = selectedFiles.filter(fileId => {
            const file = project?.files.find(f => f.id === fileId)
            if (!file) return false
            return isConversionSupported(file.type, format)
        })

        if (validFiles.length === 0) {
            toast.error(`None of the selected files support conversion to ${format.toUpperCase()}`)
            return
        }

        if (validFiles.length < selectedFiles.length) {
            toast.warning(`Skipping ${selectedFiles.length - validFiles.length} files that do not support ${format.toUpperCase()} conversion.`)
        }

        // Use new batch API for parallel processing
        try {
            toast.info(`Starting parallel batch conversion to ${format.toUpperCase()} for ${validFiles.length} files...`, {
                description: 'All conversions will run simultaneously'
            })

            // Mark all files as converting
            setConvertingFiles(prev => {
                const newSet = new Set(prev)
                validFiles.forEach(id => newSet.add(id))
                return newSet
            })

            // Create batch conversion
            const response = await apiClient.post('/api/conversion/batch', {
                fileIds: validFiles,
                format
            })

            const { batchId, started, failed, errors } = response.data

            if (failed > 0) {
                toast.warning(`${failed} file(s) could not be converted`, {
                    description: errors.map((e: { error: string }) => e.error).join(', ')
                })
            }

            if (started === 0) {
                setConvertingFiles(prev => {
                    const newSet = new Set(prev)
                    validFiles.forEach(id => newSet.delete(id))
                    return newSet
                })
                return
            }

            toast.success(`Batch started: ${started} conversions running in parallel`)

            // Poll for batch completion
            const pollInterval = setInterval(async () => {
                try {
                    const statusResponse = await apiClient.get(`/api/conversion/batch/${batchId}`)
                    const { status, summary } = statusResponse.data

                    // Ensure summary exists before accessing properties
                    if (!summary) {
                        console.warn('Batch status response missing summary')
                        return
                    }

                    const total = (summary.completed || 0) + (summary.failed || 0) + (summary.processing || 0) + (summary.pending || 0)
                    const downloadReady = summary.completed > 0 && summary.processing === 0 && summary.pending === 0

                    // Update toast with progress
                    if (status === 'processing') {
                        toast.info(`Batch progress: ${summary.completed || 0}/${total} completed`, {
                            id: `batch-${batchId}`,
                            description: (summary.processing || 0) > 0 ? `${summary.processing} still processing...` : 'Finishing up...'
                        })
                    }

                    if (status === 'completed' || status === 'failed') {
                        clearInterval(pollInterval)

                        // Clear converting status
                        setConvertingFiles(prev => {
                            const newSet = new Set(prev)
                            validFiles.forEach(id => newSet.delete(id))
                            return newSet
                        })

                        if (downloadReady && (summary.completed || 0) > 0) {
                            toast.success(`Batch conversion complete!`, {
                                id: `batch-${batchId}`,
                                description: `${summary.completed} files ready. Click to download ZIP.`,
                                action: {
                                    label: 'Download ZIP',
                                    onClick: () => {
                                        window.open(`/api/conversion/batch/${batchId}/download`, '_blank')
                                    }
                                },
                                duration: 30000
                            })
                        } else if ((summary.failed || 0) === total) {
                            toast.error(`All conversions failed`, {
                                id: `batch-${batchId}`
                            })
                        }
                    }
                } catch (pollError) {
                    console.warn('Failed to check batch status:', pollError)
                }
            }, 3000) // Poll every 3 seconds

            // Timeout after 15 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                setConvertingFiles(prev => {
                    const newSet = new Set(prev)
                    validFiles.forEach(id => newSet.delete(id))
                    return newSet
                })
            }, 15 * 60 * 1000)

        } catch (error: unknown) {
            setConvertingFiles(prev => {
                const newSet = new Set(prev)
                validFiles.forEach(id => newSet.delete(id))
                return newSet
            })
            showError(error, user?.role, "Failed to start batch conversion")
        }

        setSelectedFiles([])
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleBulkValidate = () => {
        if (selectedFiles.length === 0) return

        let passed = 0
        let failed = 0

        selectedFiles.forEach(fileId => {
            const file = project?.files.find(f => f.id === fileId)
            if (file) {
                const namingRegex = /^[A-Z0-9]+-[A-Z]+-[0-9]+/i
                const isNamingValid = namingRegex.test(file.name)
                const isSizeValid = file.size <= 200 * 1024 * 1024

                if (isNamingValid && isSizeValid) passed++
                else failed++
            }
        })

        toast.info(`Bulk Validation Complete`, {
            description: `${passed} passed, ${failed} failed. Check individual files for details.`
        })

        setSelectedFiles([])
    }

    const handleCompareFiles = () => {
        if (selectedFiles.length !== 2 || !project) return

        const file1 = project.files.find(f => f.id === selectedFiles[0])
        const file2 = project.files.find(f => f.id === selectedFiles[1])

        if (file1?.apsUrn && file2?.apsUrn) {
            const isPdf = file1.name.toLowerCase().endsWith('.pdf');
            const isDwg = file1.name.toLowerCase().endsWith('.dwg');
            const type = (isPdf || isDwg) ? '2d' : '3d';

            router.push(`/dashboard/viewer/compare?primary=${file1.apsUrn}&diff=${file2.apsUrn}&type=${type}`)
        } else {
            toast.error("Selected files must be processed (have URN) to compare.")
        }
    }

    const areFilesCompatibleForCompare = (fileIds: string[]) => {
        if (!project) return false
        const files = project.files.filter(f => fileIds.includes(f.id))
        if (files.length !== 2) return false
        const is3D = (f: ProjectFile) => ['rvt', 'ifc', 'nwc', 'dwg'].includes(f.type.toLowerCase())
        const is2D = (f: ProjectFile) => ['pdf', 'dwf'].includes(f.type.toLowerCase())
        return (is3D(files[0]) && is3D(files[1])) || (is2D(files[0]) && is2D(files[1]))
    }

    const areFilesCompatible = (fileIds: string[], format: string) => {
        if (!project) return false
        const files = project.files.filter(f => fileIds.includes(f.id))
        return files.every(f => isConversionSupported(f.type, format))
    }

    const handleViewFile = async (file: ProjectFile) => {
        if (file.status !== 'READY' || !file.apsUrn) {
            toast.error("File is not ready for viewing")
            return
        }

        let token = undefined

        if (file.apsProjectId) {
            try {
                const res = await apiClient.get('/api/auth/user-token')
                token = res.data.access_token
            } catch {
                console.log("No user token available for ACC file")
            }
        }

        setViewerModal({
            isOpen: true,
            file,
            token
        })
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        const MAX_SIZE = 200 * 1024 * 1024; // 200MB

        // 1. Validate Size
        if (file.size > MAX_SIZE) {
            toast.error("File too large", {
                description: `File size (${formatSize(file.size)}) exceeds the 100MB limit.`
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // 2. Validate Extension
        const allowedExtensions = ['rvt', 'dwg', 'pdf', 'ifc', 'nwc', 'dwf'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        if (!fileExt || !allowedExtensions.includes(fileExt)) {
            toast.error("Unsupported file format", {
                description: `Allowed formats: ${allowedExtensions.join(', ').toUpperCase()}`
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', projectId)

        setUploading(true)
        setUploadProgress(0)
        const toastId = toast.loading(`Uploading ${file.name}... 0%`);

        try {
            const response = await apiClient.post('/api/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        setUploadProgress(percent)
                        toast.loading(`Uploading ${file.name}... ${percent}%`, { id: toastId })
                    }
                }
            })

            if (response.data.warning) {
                toast.warning("File uploaded locally only", { description: "APS Error: " + response.data.warning, id: toastId })
            } else {
                toast.success("File uploaded successfully", { id: toastId })
            }

            fetchProject()
        } catch (error: unknown) {
            showError(error, user?.role, "File upload failed")
            toast.dismiss(toastId);
        } finally {
            setUploading(false)
            setUploadProgress(0)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleApsImport = async (fileData: Record<string, unknown>) => {
        try {
            await apiClient.post('/api/files/import-aps', {
                ...fileData,
                projectId: projectId
            })
            toast.success("File imported successfully")
            fetchProject()
        } catch (error) {
            showError(error, user?.role, "Failed to import file")
        }
    }

    const handleSaveToProject = async () => {
        if (!downloadModal?.conversionId) return

        try {
            toast.info("Saving file to project...")
            await apiClient.post(`/api/conversion/${downloadModal.conversionId}/save-to-project`)
            toast.success("File saved to project successfully!")
            setDownloadModal(null)
            fetchProject()
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { details?: unknown }; }; message?: string };
            const errorMessage = axiosError.response?.data?.details
                ? (typeof axiosError.response.data.details === 'object' ? JSON.stringify(axiosError.response.data.details) : String(axiosError.response.data.details))
                : axiosError.message || 'Unknown error';

            showError(error, user?.role, "Failed to save file to project");
            toast.error("Save Failed", { description: errorMessage, duration: 10000 });
        }
    }

    const handleConvert = async (fileId: string, format: 'pdf' | 'ifc') => {
        const file = project?.files.find(f => f.id === fileId);
        if (!file) return;

        if (!isConversionSupported(file.type, format)) {
            toast.error(`Cannot convert ${file.type} to ${format.toUpperCase()}`, {
                description: "This conversion is not supported."
            });
            return;
        }

        // Create a unique tracking ID
        const trackingId = `${fileId}-${format}-${Date.now()}`

        try {
            setConvertingFiles(prev => new Set(prev).add(fileId))

            // Add to active conversions tracker immediately for visual feedback
            setActiveConversions(prev => [...prev, {
                id: trackingId,
                fileId,
                fileName: file.name,
                format,
                status: 'pending',
                startTime: Date.now()
            }])

            const response = await apiClient.post(`/api/conversion/${fileId}`, { format })

            // Handle case where conversion was already completed recently
            if (response.data.downloadUrl && response.data.message === 'Conversion already completed recently') {
                setActiveConversions(prev => prev.map(c =>
                    c.id === trackingId
                        ? { ...c, status: 'completed' as const, downloadUrl: response.data.downloadUrl, conversionId: response.data.conversion?.id }
                        : c
                ))
                setConvertingFiles(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(fileId)
                    return newSet
                })
                return
            }

            if (!response.data.conversion) {
                throw new Error('No conversion ID returned')
            }

            const conversionId = response.data.conversion.id

            // Update tracker to processing status
            setActiveConversions(prev => prev.map(c =>
                c.id === trackingId
                    ? { ...c, status: 'processing' as const, conversionId }
                    : c
            ))

            const pollInterval = setInterval(async () => {
                try {
                    const statusResponse = await apiClient.get(`/api/conversion/${conversionId}`)
                    const status = statusResponse.data.status

                    if (status === 'COMPLETED') {
                        clearInterval(pollInterval)
                        setConvertingFiles(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(fileId)
                            return newSet
                        })

                        const downloadUrl = `/api/conversion/${conversionId}/download`

                        // Update tracker to completed
                        setActiveConversions(prev => prev.map(c =>
                            c.id === trackingId
                                ? { ...c, status: 'completed' as const, downloadUrl, conversionId }
                                : c
                        ))

                    } else if (status === 'FAILED') {
                        clearInterval(pollInterval)
                        setConvertingFiles(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(fileId)
                            return newSet
                        })

                        // Update tracker to failed
                        setActiveConversions(prev => prev.map(c =>
                            c.id === trackingId
                                ? { ...c, status: 'failed' as const, error: statusResponse.data.error || 'Unknown error' }
                                : c
                        ))
                    }
                } catch (pollError) {
                    console.warn('Failed to check conversion status:', {
                        error: pollError instanceof Error ? pollError.message : String(pollError),
                        conversionId: conversionId
                    })
                }
            }, 2000) // Poll every 2 seconds instead of 1 to reduce load

            // Timeout after 10 minutes
            setTimeout(() => {
                clearInterval(pollInterval)
                setConvertingFiles(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(fileId)
                    return newSet
                })
                // Mark as failed if still processing after timeout
                setActiveConversions(prev => prev.map(c =>
                    c.id === trackingId && (c.status === 'pending' || c.status === 'processing')
                        ? { ...c, status: 'failed' as const, error: 'Conversion timed out' }
                        : c
                ))
            }, 600000) // 10 minute timeout

        } catch (error: unknown) {
            setConvertingFiles(prev => {
                const newSet = new Set(prev)
                newSet.delete(fileId)
                return newSet
            })
            // Update tracker to failed
            setActiveConversions(prev => prev.map(c =>
                c.id === trackingId
                    ? { ...c, status: 'failed' as const, error: error instanceof Error ? error.message : 'Failed to start conversion' }
                    : c
            ))
            showError(error, user?.role, "Failed to start conversion")
        }
    }


    const handleValidate = (file: ProjectFile) => {
        const namingRegex = /^[A-Z0-9]+-[A-Z]+-[0-9]+/i
        const issues: string[] = []

        if (!namingRegex.test(file.name)) {
            issues.push('❌ Naming does NOT match standard (PROJECT-DISCIPLINE-NUMBER)')
        } else {
            issues.push('✅ Naming follows standard format')
        }

        if (file.size > 200 * 1024 * 1024) {
            issues.push('⚠️ File size exceeds recommended 100MB')
        } else {
            issues.push('✅ File size is acceptable')
        }

        const validTypes = ['RVT', 'DWG', 'IFC', 'PDF']
        if (validTypes.includes(file.type)) {
            issues.push('✅ File type is supported')
        } else {
            issues.push('❌ File type may not be supported')
        }

        if (file.status === 'READY') {
            issues.push('✅ File is ready for use')
        } else if (file.status === 'FAILED') {
            issues.push('❌ File translation failed')
        } else {
            issues.push('⏳ File is still processing')
        }

        const hasErrors = issues.some(i => i.includes('❌'))
        const message = `Validation Results for "${file.name}":\n\n${issues.join('\n')}`

        if (hasErrors) {
            toast.warning(message, { duration: 8000 })
        } else {
            toast.success(message, { duration: 8000 })
        }
    }

    const handleStartTranslation = async (fileId: string) => {
        try {
            setTranslatingFiles(prev => new Set(prev).add(fileId))
            toast.info('Starting translation...')

            const response = await apiClient.post(`/api/translation/${fileId}/translate`, {})

            if (response.data.status === 'READY') {
                toast.success('File is already translated and ready!')
            } else if (response.data.status === 'TRANSLATING' && response.data.message.includes('already')) {
                toast.info('Translation is already in progress.')
            } else {
                toast.success('Translation started!')
            }

            fetchProject()
        } catch (error: unknown) {
            showError(error, user?.role, "Failed to start translation")
        } finally {
            setTimeout(() => {
                setTranslatingFiles(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(fileId)
                    return newSet
                })
            }, 1000)
        }
    }

    const handleDeleteFile = async () => {
        if (!fileToDelete) return

        setDeletingFile(true)
        try {
            await apiClient.delete(`/api/files/${fileToDelete}`)
            if (project) {
                setProject({
                    ...project,
                    files: project.files.filter(f => f.id !== fileToDelete)
                })
            }
            setIsDeleteDialogOpen(false)
            setFileToDelete(null)
            toast.success("File deleted successfully")
        } catch (error) {
            showError(error, user?.role, "Failed to delete file")
        } finally {
            setDeletingFile(false)
        }
    }

    const confirmDeleteFile = (fileId: string) => {
        setFileToDelete(fileId)
        setIsDeleteDialogOpen(true)
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const fetchMembers = useCallback(async () => {
        try {
            const response = await apiClient.get(`/api/project-members/${projectId}/members`)
            if (Array.isArray(response.data)) {
                setMembers(response.data)
            } else {
                console.error('Expected members to be an array, got:', response.data);
                setMembers([]);
            }
        } catch (error) {
            console.warn("Failed to fetch members", error)
        }
    }, [projectId])

    useEffect(() => {
        if (isSettingsOpen) {
            fetchMembers()
        }
    }, [isSettingsOpen, fetchMembers])

    const handleInviteMember = async (email: string, role: string) => {
        await apiClient.post(`/api/project-members/${projectId}/members`, { email, role })
        fetchMembers()
    }

    const handleUpdateMemberRole = async (userId: string, role: string) => {
        await apiClient.put(`/api/project-members/${projectId}/members/${userId}`, { role })
        fetchMembers()
    }

    const handleRemoveMember = async (userId: string) => {
        await apiClient.delete(`/api/project-members/${projectId}/members/${userId}`)
        fetchMembers()
    }

    const handleDeleteProject = async () => {
        await apiClient.delete(`/api/projects/${projectId}`)
        router.push('/dashboard')
        toast.success("Project deleted successfully")
    }

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen text-foreground">Loading...</div>
    }

    if (!project) {
        return <div className="flex items-center justify-center min-h-screen text-foreground">Project not found</div>
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <ProjectHeader
                projectName={project.name}
                clientName={project.clientName || "DOM Client"}
                discipline={project.discipline || "Architecture"}
                status={project.status || "Active"}
                lastUpdated="Today"
                projectId={projectId}
                onNewFile={() => fileInputRef.current?.click()}
                onImportAps={() => setIsApsBrowserOpen(true)}
                onSettings={() => setIsSettingsOpen(true)}
            />

            {/* Hidden File Input */}
            <Input
                id="file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={uploading}
                accept=".rvt,.dwg,.pdf,.ifc,.nwc,.dwf"
                className="hidden"
            />

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                projectName={project.name}
                members={members}
                currentUserRole={user?.role} // Assuming user object has role, or we need to fetch current user's project role
                onInviteMember={handleInviteMember}
                onUpdateMemberRole={handleUpdateMemberRole}
                onRemoveMember={handleRemoveMember}
                onDeleteProject={handleDeleteProject}
            />

            {/* Main Content Tabs */}
            <Tabs defaultValue="files" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="files">Files ({project.files.length})</TabsTrigger>
                    <TabsTrigger value="details">Project Details</TabsTrigger>
                    <TabsTrigger value="members" className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Team
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                    <ProjectDetailsPanel
                        projectType={project.status || "Standard"}
                        discipline={project.discipline || "Architecture"}
                        ownerName={project.clientName || "DOM Client"}
                        location={project.location || "Madrid, Spain"}
                        startDate={project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "2024-01-01"}
                        endDate={project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "2024-12-31"}
                        notes={project.description || "No description provided."}
                        onSave={handleUpdateProject}
                    />
                </TabsContent>

                <TabsContent value="members">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Team Members</h3>
                                <p className="text-sm text-muted-foreground">
                                    {role === 'OWNER' ? 'Manage who has access to this project' : 'People with access to this project'}
                                </p>
                            </div>
                            {can.share && (
                                <Button onClick={() => setIsShareDialogOpen(true)} className="gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    Share Project
                                </Button>
                            )}
                        </div>
                        <ProjectMembersList
                            projectId={projectId}
                            canManageMembers={can.manageMembers}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="files">
                    {project.files.length === 0 ? (
                        <EmptyState
                            title="No files uploaded"
                            description="Upload your first file to get started with this project."
                            primaryActionLabel="Upload File"
                            onPrimaryAction={() => fileInputRef.current?.click()}
                        />
                    ) : (
                        <div className="space-y-6">
                            {/* Toolbar */}
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                                {/* Left: Search & Filter */}
                                <div className="flex items-center gap-4 w-full md:w-auto">
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <Input
                                            placeholder="Search files..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 bg-black/20 border-white/10 text-white placeholder:text-gray-500 focus:border-dom-blue/50 transition-all"
                                        />
                                    </div>

                                    <div className="flex items-center bg-black/20 rounded-lg p-1 border border-white/10">
                                        {['ALL', 'RVT', 'DWG', 'PDF'].map((filter) => (
                                            <button
                                                key={filter}
                                                onClick={() => setActiveFilter(filter)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeFilter === filter
                                                    ? 'bg-dom-blue text-white shadow-lg'
                                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                    }`}
                                            >
                                                {filter === 'ALL' ? 'All Files' : filter}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Right: Batch Actions */}
                                {selectedFiles.length > 0 && (
                                    <div className="flex items-center gap-2 animate-fade-in">
                                        <span className="text-xs text-gray-400 mr-2">{selectedFiles.length} selected</span>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={handleBatchDownload} className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-dom-blue/20 hover:text-dom-blue">
                                                        <HardDrive className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Download Selected</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={() => handleBulkConvert('pdf')} className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-dom-blue/20 hover:text-dom-blue">
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Convert to PDF</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="sm" onClick={handleCompareFiles} disabled={selectedFiles.length !== 2} className="h-8 w-8 p-0 border-white/10 bg-white/5 hover:bg-dom-blue/20 hover:text-dom-blue disabled:opacity-30">
                                                        <GitCompare className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>Compare (Select 2)</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])} className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* File List Header */}
                            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-white/10">
                                <div className="w-6">
                                    <Checkbox
                                        checked={selectedFiles.length === project.files.length && project.files.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                        className="border-white/20 data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue"
                                    />
                                </div>
                                <div>Name</div>
                                <div className="w-24 text-center">Type</div>
                                <div className="w-24 text-center">Size</div>
                                <div className="w-32 text-center">Status</div>
                                <div className="w-40"></div>
                            </div>

                            {/* Grouped Files List */}
                            <div className="space-y-8">
                                {activeFilter === 'ALL' && groupedFiles ? (
                                    Object.entries(groupedFiles).map(([type, files]) => {
                                        if (files.length === 0) return null;
                                        return (
                                            <div key={type} className="space-y-2 animate-fade-in">
                                                <div className="flex items-center gap-2 px-2">
                                                    <span className="text-xs font-bold text-dom-blue bg-dom-blue/10 px-2 py-1 rounded-md">{type}</span>
                                                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                                                </div>
                                                <div className="space-y-1">
                                                    {files.map(file => (
                                                        <FileRow
                                                            key={file.id}
                                                            fileName={file.name}
                                                            fileType={file.type}
                                                            fileSize={formatSize(file.size)}
                                                            updatedAt={new Date(file.createdAt).toLocaleDateString()}
                                                            status={file.status}
                                                            progress={file.progress}
                                                            isSelected={selectedFiles.includes(file.id)}
                                                            onSelect={() => toggleFileSelection(file.id)}
                                                            onView={() => handleViewFile(file)}
                                                            onRetry={() => handleStartTranslation(file.id)}
                                                            actions={
                                                                <div className="flex items-center gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={(e) => { e.stopPropagation(); handleViewFile(file); }}
                                                                        className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                                                                    >
                                                                        <Box className="h-3 w-3 mr-2" />
                                                                        View
                                                                    </Button>

                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 rounded-full">
                                                                                <MoreVertical className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-56 glass-panel border-white/10">
                                                                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">File Actions</DropdownMenuLabel>
                                                                            <DropdownMenuSeparator className="bg-white/10" />

                                                                            {file.status === 'READY' && (
                                                                                <>
                                                                                    <DropdownMenuGroup>
                                                                                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                                                                            <RefreshCw className="h-3 w-3" /> CONVERT
                                                                                        </DropdownMenuLabel>
                                                                                        {isConversionSupported(file.type, 'pdf') && (
                                                                                            <DropdownMenuItem onClick={() => handleConvert(file.id, 'pdf')} className="focus:bg-white/10 cursor-pointer">
                                                                                                <FileText className="mr-2 h-4 w-4 text-red-400" />
                                                                                                <span>To PDF</span>
                                                                                            </DropdownMenuItem>
                                                                                        )}
                                                                                        {isConversionSupported(file.type, 'ifc') && (
                                                                                            <DropdownMenuItem onClick={() => handleConvert(file.id, 'ifc')} className="focus:bg-white/10 cursor-pointer">
                                                                                                <Box className="mr-2 h-4 w-4 text-blue-400" />
                                                                                                <span>To IFC</span>
                                                                                            </DropdownMenuItem>
                                                                                        )}
                                                                                    </DropdownMenuGroup>
                                                                                    <DropdownMenuSeparator className="bg-white/10" />
                                                                                </>
                                                                            )}

                                                                            <DropdownMenuGroup>
                                                                                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                                                                    <Layers className="h-3 w-3" /> MANAGE
                                                                                </DropdownMenuLabel>
                                                                                <Link href={`/dashboard/files/${file.id}`}>
                                                                                    <DropdownMenuItem className="focus:bg-white/10 cursor-pointer">
                                                                                        <Clock className="mr-2 h-4 w-4 text-orange-400" />
                                                                                        <span>History & Versions</span>
                                                                                    </DropdownMenuItem>
                                                                                </Link>
                                                                                <DropdownMenuItem onClick={() => handleValidate(file)} className="focus:bg-white/10 cursor-pointer">
                                                                                    <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
                                                                                    <span>Validate Standards</span>
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuGroup>
                                                                            <DropdownMenuSeparator className="bg-white/10" />

                                                                            <DropdownMenuItem
                                                                                onClick={() => confirmDeleteFile(file.id)}
                                                                                className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                <span>Delete File</span>
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="space-y-1 animate-fade-in">
                                        {filteredFiles.length > 0 ? (
                                            filteredFiles.map(file => (
                                                <FileRow
                                                    key={file.id}
                                                    fileName={file.name}
                                                    fileType={file.type}
                                                    fileSize={formatSize(file.size)}
                                                    updatedAt={new Date(file.createdAt).toLocaleDateString()}
                                                    status={file.status}
                                                    progress={file.progress}
                                                    isSelected={selectedFiles.includes(file.id)}
                                                    onSelect={() => toggleFileSelection(file.id)}
                                                    onView={() => handleViewFile(file)}
                                                    onRetry={() => handleStartTranslation(file.id)}
                                                    actions={
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={(e) => { e.stopPropagation(); handleViewFile(file); }}
                                                                className="h-8 px-3 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
                                                            >
                                                                <Box className="h-3 w-3 mr-2" />
                                                                View
                                                            </Button>

                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 rounded-full">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-56 glass-panel border-white/10">
                                                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">File Actions</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator className="bg-white/10" />

                                                                    {file.status === 'READY' && (
                                                                        <>
                                                                            <DropdownMenuGroup>
                                                                                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                                                                    <RefreshCw className="h-3 w-3" /> CONVERT
                                                                                </DropdownMenuLabel>
                                                                                {isConversionSupported(file.type, 'pdf') && (
                                                                                    <DropdownMenuItem onClick={() => handleConvert(file.id, 'pdf')} className="focus:bg-white/10 cursor-pointer">
                                                                                        <FileText className="mr-2 h-4 w-4 text-red-400" />
                                                                                        <span>To PDF</span>
                                                                                    </DropdownMenuItem>
                                                                                )}
                                                                                {isConversionSupported(file.type, 'ifc') && (
                                                                                    <DropdownMenuItem onClick={() => handleConvert(file.id, 'ifc')} className="focus:bg-white/10 cursor-pointer">
                                                                                        <Box className="mr-2 h-4 w-4 text-blue-400" />
                                                                                        <span>To IFC</span>
                                                                                    </DropdownMenuItem>
                                                                                )}
                                                                            </DropdownMenuGroup>
                                                                            <DropdownMenuSeparator className="bg-white/10" />
                                                                        </>
                                                                    )}

                                                                    <DropdownMenuGroup>
                                                                        <DropdownMenuLabel className="text-xs font-bold text-muted-foreground px-2 py-1 flex items-center gap-1">
                                                                            <Layers className="h-3 w-3" /> MANAGE
                                                                        </DropdownMenuLabel>
                                                                        <Link href={`/dashboard/files/${file.id}`}>
                                                                            <DropdownMenuItem className="focus:bg-white/10 cursor-pointer">
                                                                                <Clock className="mr-2 h-4 w-4 text-orange-400" />
                                                                                <span>History & Versions</span>
                                                                            </DropdownMenuItem>
                                                                        </Link>
                                                                        <DropdownMenuItem onClick={() => handleValidate(file)} className="focus:bg-white/10 cursor-pointer">
                                                                            <CheckCircle className="mr-2 h-4 w-4 text-green-400" />
                                                                            <span>Validate Standards</span>
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuGroup>
                                                                    <DropdownMenuSeparator className="bg-white/10" />

                                                                    <DropdownMenuItem
                                                                        onClick={() => confirmDeleteFile(file.id)}
                                                                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                                                                    >
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        <span>Delete File</span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    }
                                                />
                                            ))
                                        ) : (
                                            <div className="text-center py-12 text-gray-500">
                                                No files found matching your filters.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Upload Zone (Moved to bottom) */}
                            <div
                                className={`glass-panel border-dashed border-2 border-white/10 rounded-2xl p-8 text-center transition-all duration-300 group ${uploading ? 'bg-primary/5 border-primary/30' : 'hover:bg-white/5 hover:border-primary/30'}`}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleFileUpload({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
                                    }
                                }}
                            >
                                <div className="flex flex-col items-center justify-center gap-4">
                                    <div className="p-4 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-300">
                                        <Upload className={`h-8 w-8 ${uploading ? 'text-primary animate-bounce' : 'text-gray-400 group-hover:text-primary'}`} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-1">
                                            {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            Support for RVT, DWG, PDF, IFC, NWC
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="mt-2 border-white/10 hover:bg-white/10"
                                    >
                                        Select Files
                                    </Button>
                                </div>
                            </div>
                        </div>







                    )}
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete File</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this file? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteFile} disabled={deletingFile}>
                            {deletingFile ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ApsBrowser
                isOpen={isApsBrowserOpen}
                onClose={() => setIsApsBrowserOpen(false)}
                onImport={handleApsImport}
                projectId={params.id as string}
            />

            <ViewerModal
                isOpen={!!viewerModal}
                onClose={() => setViewerModal(null)}
                file={viewerModal?.file ?? null}
                token={viewerModal?.token}
            />

            {/* Download Modal */}
            <Dialog open={!!downloadModal} onOpenChange={(open) => !open && setDownloadModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Conversion Complete</DialogTitle>
                        <DialogDescription>
                            Your {downloadModal?.format} file is ready.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <a
                            href={downloadModal?.url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-10 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                            Download {downloadModal?.format}
                        </a>
                        <Button onClick={handleSaveToProject}>
                            Save to Project
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bulk Actions Bar - Premium Slide-in */}
            {
                selectedFiles.length > 0 && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-background/90 backdrop-blur-xl border border-primary/20 text-foreground px-6 py-4 rounded-2xl shadow-2xl shadow-primary/20 flex items-center gap-6 z-50 animate-slide-up ring-1 ring-white/10">
                        <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                            <div className="bg-primary/20 p-2 rounded-lg">
                                <CheckSquare className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-bold text-lg">{selectedFiles.length} <span className="text-sm font-normal text-muted-foreground">selected</span></span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Compare Action */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCompareFiles}
                                                disabled={selectedFiles.length !== 2 || !areFilesCompatibleForCompare(selectedFiles)}
                                                className="hover:bg-primary/10 hover:text-primary transition-colors"
                                            >
                                                <GitCompare className="mr-2 h-4 w-4" /> Compare
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {selectedFiles.length !== 2
                                            ? "Select exactly 2 files to compare"
                                            : !areFilesCompatibleForCompare(selectedFiles)
                                                ? "Selected files must be of the same type (2D or 3D)"
                                                : "Compare selected versions"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {/* Convert Actions */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleBulkConvert('pdf')}
                                                disabled={!areFilesCompatible(selectedFiles, 'pdf')}
                                                className="hover:bg-primary/10 hover:text-primary transition-colors"
                                            >
                                                <FileText className="mr-2 h-4 w-4" /> Convert to PDF
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {!areFilesCompatible(selectedFiles, 'pdf')
                                            ? "Selection contains files that cannot be converted to PDF"
                                            : "Convert selected files to PDF"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleBulkConvert('ifc')}
                                                disabled={!areFilesCompatible(selectedFiles, 'ifc')}
                                                className="hover:bg-primary/10 hover:text-primary transition-colors"
                                            >
                                                <Box className="mr-2 h-4 w-4" /> Convert to IFC
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {!areFilesCompatible(selectedFiles, 'ifc')
                                            ? "Selection contains files that cannot be converted to IFC"
                                            : "Convert selected files to IFC"}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <div className="h-6 w-px bg-white/10 mx-2"></div>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedFiles([])}
                                className="hover:bg-red-500/10 hover:text-red-500 rounded-full"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                )
            }

            {/* Conversion Tracker - shows active/completed conversions */}
            <ConversionTracker
                conversions={activeConversions}
                onDismiss={(id) => {
                    setActiveConversions(prev => prev.filter(c => c.id !== id))
                }}
                onDownload={(conversion) => {
                    if (conversion.downloadUrl) {
                        window.open(conversion.downloadUrl, '_blank')
                    }
                }}
                onSaveToProject={async (conversion) => {
                    if (!conversion.conversionId) return
                    try {
                        toast.info("Saving file to project...")
                        await apiClient.post(`/api/conversion/${conversion.conversionId}/save-to-project`)
                        toast.success("File saved to project successfully!")
                        setActiveConversions(prev => prev.filter(c => c.id !== conversion.id))
                        fetchProject()
                    } catch (error: unknown) {
                        showError(error, user?.role, "Failed to save file to project")
                    }
                }}
            />

            {/* Share Project Dialog */}
            <ShareProjectDialog
                open={isShareDialogOpen}
                onOpenChange={setIsShareDialogOpen}
                projectId={projectId}
                projectName={project?.name || 'Project'}
                onMemberAdded={refreshPermissions}
            />
        </div>
    )
}

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { 
    ArrowLeft, Upload, FileText, Box, Layers, MoreVertical, RefreshCw, 
    Clock, HardDrive, Cloud, CheckCircle, Trash2, List, GitCompare, 
    Square, CheckSquare, File as FileIcon 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
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
    const [isApsBrowserOpen, setIsApsBrowserOpen] = useState(false)
    const [convertingFiles, setConvertingFiles] = useState<Set<string>>(new Set())
    const [translatingFiles, setTranslatingFiles] = useState<Set<string>>(new Set())
    const [selectedFiles, setSelectedFiles] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [viewerModal, setViewerModal] = useState<{ isOpen: boolean, file: any, token?: string } | null>(null)
    const [supportedFormats, setSupportedFormats] = useState<Record<string, string[]> | null>(null)
    
    // Delete state
    const [fileToDelete, setFileToDelete] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletingFile, setDeletingFile] = useState(false)

    // Download state
    const [downloadModal, setDownloadModal] = useState<{ isOpen: boolean, url: string, format: string, conversionId?: string } | null>(null)

    const projectId = params.id as string
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    const router = useRouter()

    useEffect(() => {
        const fetchFormats = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/conversion/formats`)
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
        if (!supportedFormats) return true
        
        const ext = fileType.toLowerCase()
        const format = targetFormat.toLowerCase()
        
        if (supportedFormats[format] && supportedFormats[format].includes(ext)) {
            return true
        }
        
        if (format === 'pdf') {
             if (supportedFormats['svf2'] && supportedFormats['svf2'].includes(ext)) {
                 return true
             }
        }
        
        return false
    }

    const fetchProject = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/projects/${projectId}`)
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

    useEffect(() => {
        if (!project) return

        const hasProcessingFiles = project.files.some(f =>
            f.status === 'TRANSLATING' || f.status === 'PROCESSING' || f.status === 'PENDING'
        )

        if (hasProcessingFiles) {
            const interval = setInterval(() => {
                fetchProject()
            }, 2000)

            return () => clearInterval(interval)
        }
    }, [project, fetchProject])

    const toggleFileSelection = (fileId: string) => {
        setSelectedFiles(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId)
            } else {
                return [...prev, fileId]
            }
        })
    }

    const toggleSelectAll = (checked: boolean) => {
        if (!project) return
        
        if (checked) {
            // Select all files (both source and generated)
            setSelectedFiles(project.files.map(f => f.id))
        } else {
            setSelectedFiles([])
        }
    }

    const handleUpdateProject = async (data: any) => {
        try {
            await axios.put(`${API_URL}/api/projects/${projectId}`, {
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
                const response = await axios.post(`${API_URL}/api/files/batch-download`, {
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
                console.error("Batch download failed", error)
                toast.error("Failed to create ZIP archive")
            }
        } else {
            selectedFiles.forEach((fileId, index) => {
                setTimeout(() => {
                    window.open(`${API_URL}/api/files/${fileId}/download`, '_blank')
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
        
        toast.info(`Starting bulk conversion to ${format.toUpperCase()} for ${validFiles.length} files...`)
        
        for (const fileId of validFiles) {
            if (convertingFiles.has(fileId)) continue
            handleConvert(fileId, format)
        }
        
        setSelectedFiles([])
    }

    const handleBulkValidate = () => {
        if (selectedFiles.length === 0) return
        
        let passed = 0
        let failed = 0
        
        selectedFiles.forEach(fileId => {
            const file = project?.files.find(f => f.id === fileId)
            if (file) {
                const namingRegex = /^[A-Z0-9]+-[A-Z]+-[0-9]+/i
                const isNamingValid = namingRegex.test(file.name)
                const isSizeValid = file.size <= 100 * 1024 * 1024
                
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

    const handleViewFile = async (file: ProjectFile) => {
        if (file.status !== 'READY' || !file.apsUrn) {
            toast.error("File is not ready for viewing")
            return
        }

        let token = undefined
        
        if (file.apsProjectId) {
            try {
                 const res = await axios.get(`${API_URL}/api/auth/user-token`, { withCredentials: true })
                 token = res.data.access_token
            } catch (e) {
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
        try {
            const response = await axios.post(`${API_URL}/api/files/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            })

            if (response.data.warning) {
                toast.warning("File uploaded locally only. APS Error: " + response.data.warning)
            } else {
                toast.success("File uploaded successfully")
            }

            fetchProject()
        } catch (error: unknown) {
            showError(error, user?.role, "File upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleApsImport = async (fileData: Record<string, unknown>) => {
        try {
            await axios.post(`${API_URL}/api/files/import-aps`, {
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
            await axios.post(`${API_URL}/api/conversion/${downloadModal.conversionId}/save-to-project`)
            toast.success("File saved to project successfully!")
            setDownloadModal(null)
            fetchProject()
        } catch (error: any) {
            const errorMessage = error.response?.data?.details 
                ? (typeof error.response.data.details === 'object' ? JSON.stringify(error.response.data.details) : error.response.data.details)
                : error.message;
            
            showError(error, user?.role, "Failed to save file to project");
            toast.error("Save Failed", { description: errorMessage, duration: 10000 });
        }
    }

    const handleConvert = async (fileId: string, format: 'pdf' | 'ifc') => {
        try {
            setConvertingFiles(prev => new Set(prev).add(fileId))
            toast.info(`Requesting conversion to ${format.toUpperCase()}...`)

            const response = await axios.post(`${API_URL}/api/conversion/${fileId}`, { format })

            if (!response.data.conversion) {
                throw new Error('No conversion ID returned')
            }

            const conversionId = response.data.conversion.id
            toast.success(`Conversion started!`, { description: 'Waiting for processor...' })

            const pollInterval = setInterval(async () => {
                try {
                    const statusResponse = await axios.get(`${API_URL}/api/conversion/${conversionId}`)
                    const status = statusResponse.data.status

                    if (status === 'COMPLETED') {
                        clearInterval(pollInterval)
                        setConvertingFiles(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(fileId)
                            return newSet
                        })

                        const downloadUrl = `/api/conversion/${conversionId}/download`
                        const fullDownloadUrl = `${API_URL}${downloadUrl}`

                        setDownloadModal({
                            isOpen: true,
                            url: fullDownloadUrl,
                            format: format.toUpperCase(),
                            conversionId: conversionId
                        })

                        toast.success(`Conversion Completed!`, {
                            description: 'Click Download in the popup window.',
                            duration: 5000
                        })

                    } else if (status === 'FAILED') {
                        clearInterval(pollInterval)
                        setConvertingFiles(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(fileId)
                            return newSet
                        })
                        toast.error(`Conversion failed`, { description: statusResponse.data.error || 'Unknown error' })
                    }
                } catch (pollError) {
                    console.warn('Failed to check conversion status:', pollError)
                }
            }, 1000)

            setTimeout(() => {
                clearInterval(pollInterval)
                setConvertingFiles(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(fileId)
                    return newSet
                })
            }, 300000)

        } catch (error: any) {
            setConvertingFiles(prev => {
                const newSet = new Set(prev)
                newSet.delete(fileId)
                return newSet
            })
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

        if (file.size > 100 * 1024 * 1024) {
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
            
            const response = await axios.post(`${API_URL}/api/translation/${fileId}/translate`, {}, { withCredentials: true })

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
            await axios.delete(`${API_URL}/api/files/${fileToDelete}`)
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

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">Loading...</div>
    }

    if (!project) {
        return <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">Project not found</div>
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
                onNewFile={() => fileInputRef.current?.click()}
                onImportAps={() => setIsApsBrowserOpen(true)}
                onSettings={() => {}}
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

            {/* Main Content Tabs */}
            <Tabs defaultValue="files" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="files">Files ({project.files.length})</TabsTrigger>
                    <TabsTrigger value="details">Project Details</TabsTrigger>
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

                <TabsContent value="files">
                    {project.files.length === 0 ? (
                        <EmptyState 
                            title="No files uploaded"
                            description="Upload your first file to get started with this project."
                            primaryActionLabel="Upload File"
                            onPrimaryAction={() => fileInputRef.current?.click()}
                        />
                    ) : (
                        <div className="space-y-8">
                            {/* Source Files Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <Layers className="h-5 w-5 text-dom-blue" />
                                            Source Files
                                        </h3>
                                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-full">
                                            {project.files.filter(f => !f.type.toLowerCase().includes('pdf')).length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white dark:bg-white/5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 h-9">
                                        <Checkbox 
                                            checked={project.files.length > 0 && selectedFiles.length === project.files.length}
                                            onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                                            className="data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue"
                                        />
                                        <span className="text-sm text-gray-500 font-medium">Select All</span>
                                    </div>
                                </div>
                                {project.files.filter(f => !f.type.toLowerCase().includes('pdf')).map((file) => (
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
                                                {file.status === 'READY' && (
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={(e) => { e.stopPropagation(); handleViewFile(file); }}
                                                        className="h-8 px-3 text-xs border-dom-blue/50 text-dom-blue hover:bg-dom-blue hover:text-white"
                                                    >
                                                        <Box className="h-3 w-3 mr-2" />
                                                        View Model
                                                    </Button>
                                                )}
                                                {file.status === 'UPLOADED' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); handleStartTranslation(file.id); }}
                                                        disabled={translatingFiles?.has(file.id)}
                                                        className="h-8 px-3 text-xs"
                                                    >
                                                        {translatingFiles?.has(file.id) ? (
                                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            'Translate'
                                                        )}
                                                    </Button>
                                                )}
                                                
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56">
                                                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">File Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        
                                                        {file.status === 'READY' && (
                                                            <>
                                                                <DropdownMenuGroup>
                                                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1">Conversion</DropdownMenuLabel>
                                                                    <DropdownMenuItem onClick={() => handleConvert(file.id, 'pdf')}>
                                                                        <FileText className="mr-2 h-4 w-4 text-red-500" /> 
                                                                        <span>Convert to PDF</span>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleConvert(file.id, 'ifc')}>
                                                                        <Box className="mr-2 h-4 w-4 text-blue-500" /> 
                                                                        <span>Convert to IFC</span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuGroup>
                                                                <DropdownMenuSeparator />
                                                                
                                                                <DropdownMenuGroup>
                                                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1">Management</DropdownMenuLabel>
                                                                    <Link href={`/dashboard/files/${file.id}`}>
                                                                        <DropdownMenuItem>
                                                                            <Clock className="mr-2 h-4 w-4 text-orange-500" /> 
                                                                            <span>History & Versions</span>
                                                                        </DropdownMenuItem>
                                                                    </Link>
                                                                    <DropdownMenuItem onClick={() => handleValidate(file)}>
                                                                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> 
                                                                        <span>Validate</span>
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuGroup>
                                                                <DropdownMenuSeparator />
                                                            </>
                                                        )}
                                                        
                                                        <DropdownMenuItem 
                                                            onClick={() => confirmDeleteFile(file.id)}
                                                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
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

                            {/* Generated Files Section */}
                            {project.files.some(f => f.type.toLowerCase().includes('pdf')) && (
                                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-red-500" />
                                            Generated Documents
                                        </h3>
                                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-full">
                                            {project.files.filter(f => f.type.toLowerCase().includes('pdf')).length}
                                        </span>
                                    </div>
                                    {project.files.filter(f => f.type.toLowerCase().includes('pdf')).map((file) => (
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
                                                    {file.status === 'READY' && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={(e) => { e.stopPropagation(); handleViewFile(file); }}
                                                            className="h-8 px-3 text-xs border-red-500/50 text-red-600 hover:bg-red-500 hover:text-white"
                                                        >
                                                            <FileText className="h-3 w-3 mr-2" />
                                                            View PDF
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56">
                                                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground uppercase tracking-wider">File Actions</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            
                                                            <DropdownMenuGroup>
                                                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground px-2 py-1">Management</DropdownMenuLabel>
                                                                <Link href={`/dashboard/files/${file.id}`}>
                                                                    <DropdownMenuItem>
                                                                        <Clock className="mr-2 h-4 w-4 text-orange-500" /> 
                                                                        <span>History & Versions</span>
                                                                    </DropdownMenuItem>
                                                                </Link>
                                                            </DropdownMenuGroup>
                                                            <DropdownMenuSeparator />
                                                            
                                                            <DropdownMenuItem 
                                                                onClick={() => confirmDeleteFile(file.id)}
                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
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
                            )}
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
                file={viewerModal?.file}
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

            {/* Bulk Actions */}
            {selectedFiles.length > 0 && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-900 border rounded-full shadow-2xl p-2 flex items-center space-x-2 z-50">
                    <div className="px-4 py-2 font-bold text-sm">
                        {selectedFiles.length} Selected
                    </div>
                    
                    {selectedFiles.length === 2 && (
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={handleCompareFiles}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            <GitCompare className="h-4 w-4 mr-2" /> Compare
                        </Button>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => handleBulkConvert('pdf')}>PDF</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleBulkConvert('ifc')}>IFC</Button>
                    <Button variant="ghost" size="sm" onClick={handleBulkValidate}>Validate</Button>
                    <Button variant="ghost" size="sm" onClick={handleBatchDownload}>Download</Button>
                    <div className="w-px h-6 bg-gray-200 mx-2"></div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedFiles([])}>
                        <span className="sr-only">Clear</span>
                        <Square className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}

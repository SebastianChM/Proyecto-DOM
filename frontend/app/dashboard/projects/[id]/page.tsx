"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { ArrowLeft, Upload, File, FileText, Box, Layers, MoreVertical, RefreshCw, Clock, HardDrive, Cloud, CheckCircle, Trash2, List, GitCompare, Square, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { ViewerModal } from "@/components/ViewerModal"
import { ApsBrowser } from "@/components/ApsBrowser"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

interface ProjectFile {
    id: string
    name: string
    size: number
    type: string
    status: string
    apsUrn: string | null
    createdAt: string
    progress?: number
    apsProjectId?: string // Added to detect APS files
}

interface Project {
    id: string
    name: string
    description: string | null
    files: ProjectFile[]
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
        if (!supportedFormats) return true // Default to true if not loaded yet
        
        const ext = fileType.toLowerCase()
        const format = targetFormat.toLowerCase()
        
        // Direct check (e.g. ifc -> [rvt])
        if (supportedFormats[format] && supportedFormats[format].includes(ext)) {
            return true
        }
        
        // Special case for PDF via SVF2
        // Our backend uses SVF2 + 2dviews for PDF generation
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

    // Polling for file status updates
    useEffect(() => {
        if (!project) return

        const hasProcessingFiles = project.files.some(f =>
            f.status === 'TRANSLATING' || f.status === 'PROCESSING' || f.status === 'PENDING'
        )

        if (hasProcessingFiles) {
            console.log("Polling for updates...")
            const interval = setInterval(() => {
                fetchProject()
            }, 2000) // Poll every 2 seconds

            return () => clearInterval(interval)
        }
    }, [project, fetchProject])

    const toggleFileSelection = (fileId: string) => {
        setSelectedFiles(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId)
            } else if (prev.length < 2) {
                return [...prev, fileId]
            } else {
                // Replace the first selected with the new one
                return [prev[1], fileId]
            }
        })
    }

    const handleBulkConvert = async (format: 'pdf' | 'ifc') => {
        if (selectedFiles.length === 0) return
        
        // Filter files that support the requested format
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
            // Skip if already converting
            if (convertingFiles.has(fileId)) continue
            
            // Trigger conversion for each file
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
                // Simple validation logic reuse
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
            // Determine comparison type based on file extension
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
        
        // Only fetch user token if it's an ACC/BIM 360 file (has apsProjectId)
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
        
        // Client-side validation
        const allowedExtensions = ['rvt', 'dwg', 'pdf', 'ifc', 'nwc', 'dwf'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        
        if (!fileExt || !allowedExtensions.includes(fileExt)) {
            toast.error("Unsupported file format", {
                description: `Allowed formats: ${allowedExtensions.join(', ').toUpperCase()}`
            });
            // Reset input
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
            fetchProject() // Refresh list
        } catch (error) {
            showError(error, user?.role, "Failed to import file")
        }
    }

    const [downloadModal, setDownloadModal] = useState<{ isOpen: boolean, url: string, format: string, conversionId?: string } | null>(null)

    const handleSaveToProject = async () => {
        if (!downloadModal?.conversionId) return

        try {
            toast.info("Saving file to project...")
            await axios.post(`${API_URL}/api/conversion/${downloadModal.conversionId}/save-to-project`)
            toast.success("File saved to project successfully!")
            setDownloadModal(null)
            fetchProject()
        } catch (error: any) {
            // console.warn("Save to project error:", error);
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

            // Poll for conversion status
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

                        // Construct URL
                        // Use the proxy download endpoint which now forces attachment headers
                        const downloadUrl = `/api/conversion/${conversionId}/download`
                        const fullDownloadUrl = `${API_URL}${downloadUrl}`

                        // Open Modal for Manual Download
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
            }, 1000) // Poll every 1 second for faster feedback

            // Stop polling after 5 minutes
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
        // Comprehensive validation logic
        const namingRegex = /^[A-Z0-9]+-[A-Z]+-[0-9]+/i
        const issues: string[] = []

        // Check naming convention
        if (!namingRegex.test(file.name)) {
            issues.push('❌ Naming does NOT match standard (PROJECT-DISCIPLINE-NUMBER)')
        } else {
            issues.push('✅ Naming follows standard format')
        }

        // Check file size
        if (file.size > 100 * 1024 * 1024) { // 100MB
            issues.push('⚠️ File size exceeds recommended 100MB')
        } else {
            issues.push('✅ File size is acceptable')
        }

        // Check file type
        const validTypes = ['RVT', 'DWG', 'IFC', 'PDF']
        if (validTypes.includes(file.type)) {
            issues.push('✅ File type is supported')
        } else {
            issues.push('❌ File type may not be supported')
        }

        // Check status
        if (file.status === 'READY') {
            issues.push('✅ File is ready for use')
        } else if (file.status === 'FAILED') {
            issues.push('❌ File translation failed')
        } else {
            issues.push('⏳ File is still processing')
        }

        // Show results
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

            // Immediate refresh to show status change
            fetchProject()
        } catch (error: unknown) {
            showError(error, user?.role, "Failed to start translation")
        } finally {
            // Keep the loading state for a moment to prevent double-clicks and show "reaction"
            setTimeout(() => {
                setTranslatingFiles(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(fileId)
                    return newSet
                })
            }, 1000)
        }
    }

    const getFileIcon = (type: string) => {
        // Normalize type to handle potential MIME types or inconsistencies
        const normalizedType = type.includes('pdf') ? 'PDF' : type.toUpperCase();
        
        switch (normalizedType) {
            case 'RVT': return <Box className="h-5 w-5 text-dom-blue" />
            case 'DWG': return <Layers className="h-5 w-5 text-yellow-500" />
            case 'PDF': return <FileText className="h-5 w-5 text-red-500" />
            case 'IFC': return <Box className="h-5 w-5 text-yellow-500" />
            default: return <File className="h-5 w-5 text-gray-400" />
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const [fileToDelete, setFileToDelete] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deletingFile, setDeletingFile] = useState(false)

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

    const confirmDeleteFile = (e: React.MouseEvent, fileId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setFileToDelete(fileId)
        setIsDeleteDialogOpen(true)
    }

    const getDisplayStatus = (status: string) => {
        switch (status) {
            case 'UPLOADED': return 'QUEUED';
            case 'TRANSLATING': return 'PROCESSING';
            case 'READY': return 'DONE';
            case 'FAILED': return 'FAILED';
            default: return status;
        }
    }

    // Helper component for rendering a file item
    const FileItem = ({ 
        file, 
        index, 
        selectedFiles, 
        toggleFileSelection, 
        getFileIcon, 
        formatSize, 
        handleStartTranslation, 
        handleConvert, 
        convertingFiles, 
        translatingFiles,
        handleValidate, 
        confirmDeleteFile,
        handleViewFile
    }: any) => (
        <div
            className={`bg-white dark:glass-card border border-gray-200 dark:border-white/10 rounded-xl p-5 flex items-center justify-between group animate-slide-up border-l-2 border-transparent hover:border-l-dom-blue delay-${Math.min(index * 50, 1000)} hover:shadow-md transition-all`}
        >
            <div className="flex items-center space-x-4">
                <div onClick={() => toggleFileSelection(file.id)} className="cursor-pointer mr-1">
                    {selectedFiles.includes(file.id) ? (
                        <CheckSquare className="h-5 w-5 text-purple-500" />
                    ) : (
                        <Square className="h-5 w-5 text-gray-300 dark:text-gray-600 hover:text-gray-400" />
                    )}
                </div>
                <div className="p-3 bg-gradient-to-br dark:from-white/10 dark:to-white/5 from-gray-50 to-white rounded-xl border dark:border-white/10 border-gray-200 group-hover:border-dom-blue/40 transition-all group-hover:scale-105">
                    {getFileIcon(file.type)}
                </div>
                <div>
                    <p 
                        onClick={() => file.status === 'READY' && handleViewFile(file)}
                        className={`font-bold dark:text-white text-gray-900 text-base transition-colors ${file.status === 'READY' ? 'cursor-pointer hover:text-dom-blue dark:hover:text-dom-blue-light hover:underline' : ''}`}
                    >
                        {file.name}
                    </p>
                    <div className="flex items-center text-xs dark:text-gray-400 text-gray-600 space-x-3 mt-1.5">
                        <span className="dark:bg-white/5 bg-gray-100 px-2 py-0.5 rounded font-medium">{formatSize(file.size)}</span>
                        <span className="dark:text-gray-600 text-gray-400">•</span>
                        <span className={`
                            px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide border-2
                            ${file.status === 'READY' ? 'bg-green-500/20 text-green-600 dark:text-green-300 border-green-500/30' :
                                file.status === 'FAILED' ? 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30' :
                                    'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30 animate-pulse'}
                        `}>
                            {getDisplayStatus(file.status)}
                        </span>
                        {file.status === 'TRANSLATING' && (
                            <div className="flex items-center ml-3 space-x-2">
                                <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out absolute left-0"
                                        data-progress={Math.max(5, file.progress || 0)}
                                    >
                                        <style jsx>{`
                                            div[data-progress="${Math.max(5, file.progress || 0)}"] {
                                                width: ${Math.max(5, file.progress || 0)}%;
                                            }
                                        `}</style>
                                    </div>
                                </div>
                                <span className="text-[10px] text-blue-500 font-mono min-w-[24px]">{Math.max(5, file.progress || 0)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0 duration-300">
                {file.status === 'UPLOADED' && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartTranslation(file.id)}
                        disabled={translatingFiles?.has(file.id)}
                        className="h-9 px-4 text-xs border-2 border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500 hover:text-white glass-button font-medium"
                    >
                        {translatingFiles?.has(file.id) ? (
                            <>
                                <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> Starting...
                            </>
                        ) : (
                            'Start Translation'
                        )}
                    </Button>
                )}
                {file.status === 'READY' && (
                    <Link href={`/dashboard/viewer/${file.id}`}>
                        <Button variant="outline" size="sm" className="h-9 px-4 text-xs border-2 border-dom-blue/50 text-dom-blue hover:bg-dom-blue hover:text-white glass-button font-medium">
                            {file.type.toLowerCase().includes('pdf') ? 'View PDF' : 'View Model'}
                        </Button>
                    </Link>
                )}


                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 dark:text-gray-400 text-gray-600 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/10 hover:bg-gray-100">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 dark:glass-panel dark:border-white/10 dark:text-white dark:bg-gray-900/95 bg-white border border-gray-200 text-gray-900 backdrop-blur-xl shadow-xl">
                        <DropdownMenuLabel className="dark:text-white text-gray-900">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="dark:bg-white/10 bg-gray-200" />

                        {file.status === 'READY' && (
                            <>
                                {/* CONVERSION Section */}
                                <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 px-2 py-2 mt-1">Conversion</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => handleConvert(file.id, 'pdf')}
                                    disabled={convertingFiles.has(file.id) || !isConversionSupported(file.type, 'pdf')}
                                    className="cursor-pointer dark:hover:bg-white/10 hover:bg-gray-100 dark:focus:bg-white/10 focus:bg-gray-100 dark:text-white text-gray-900"
                                >
                                    <FileText className="mr-2 h-4 w-4 text-red-500 dark:text-red-400" />
                                    <span>
                                        {convertingFiles.has(file.id) ? 'Converting...' : 
                                         !isConversionSupported(file.type, 'pdf') ? 'Not Supported' : 'Convert to PDF'}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleConvert(file.id, 'ifc')}
                                    disabled={convertingFiles.has(file.id) || !isConversionSupported(file.type, 'ifc')}
                                    className="cursor-pointer dark:hover:bg-white/10 hover:bg-gray-100 dark:focus:bg-white/10 focus:bg-gray-100 dark:text-white text-gray-900"
                                >
                                    <Box className="mr-2 h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                                    <span>
                                        {convertingFiles.has(file.id) ? 'Converting...' : 
                                         !isConversionSupported(file.type, 'ifc') ? 'Not Supported' : 'Convert to IFC'}
                                    </span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator className="dark:bg-white/10 bg-gray-200 my-2" />

                                {/* DATA Section */}
                                <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 px-2 py-2">Data</DropdownMenuLabel>
                                <Link href={`/dashboard/bom/${file.id}`}>
                                    <DropdownMenuItem className="cursor-pointer dark:hover:bg-white/10 hover:bg-gray-100 dark:focus:bg-white/10 focus:bg-gray-100 dark:text-white text-gray-900">
                                        <List className="mr-2 h-4 w-4 text-blue-500 dark:text-blue-400" />
                                        <span>View BOM</span>
                                    </DropdownMenuItem>
                                </Link>
                                <Link href={`/dashboard/files/${file.id}`}>
                                    <DropdownMenuItem className="cursor-pointer dark:hover:bg-white/10 hover:bg-gray-100 dark:focus:bg-white/10 focus:bg-gray-100 dark:text-white text-gray-900">
                                        <Clock className="mr-2 h-4 w-4 text-purple-500 dark:text-purple-400" />
                                        <span>History & Compare</span>
                                    </DropdownMenuItem>
                                </Link>

                                <DropdownMenuSeparator className="dark:bg-white/10 bg-gray-200 my-2" />
                            </>
                        )}

                        {/* QUALITY Section */}
                        <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider dark:text-gray-400 text-gray-500 px-2 py-2">Quality</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleValidate(file)} className="cursor-pointer dark:hover:bg-white/10 hover:bg-gray-100 dark:focus:bg-white/10 focus:bg-gray-100 dark:text-white text-gray-900">
                            <CheckCircle className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
                            <span>Validate Standard</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="dark:bg-white/10 bg-gray-200 my-2" />
                        <DropdownMenuItem onClick={(e) => confirmDeleteFile(e, file.id)} className="cursor-pointer text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 dark:hover:bg-red-500/10 hover:bg-red-50 dark:focus:bg-red-500/10 focus:bg-red-50">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">Loading...</div>
    }

    if (!project) {
        return <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">Project not found</div>
    }

    const uploadedFiles = project.files.filter(f => !f.type.toLowerCase().includes('pdf'));
    const processedFiles = project.files.filter(f => f.type.toLowerCase().includes('pdf'));

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section with stronger visual separation */}
            <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between border-l-4 border-dom-blue shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon" className="dark:glass-button bg-gray-50 dark:bg-white/10 rounded-full h-12 w-12 border border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/20 hover:border-dom-blue transition-all">
                            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">{project.name}</h1>
                        <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">Project Details & Files</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleCompareFiles}
                        disabled={selectedFiles.length !== 2}
                        className={`transition-all ${selectedFiles.length === 2 ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'opacity-0 pointer-events-none'}`}
                    >
                        <GitCompare className="h-4 w-4 mr-2" /> Compare ({selectedFiles.length}/2)
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchProject} className="dark:glass-button bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 hover:border-dom-blue dark:hover:border-dom-blue/50 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/20 transition-all">
                        <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Delete File Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="glass-panel border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-red-500">Delete File</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Are you sure you want to delete this file? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/10">
                            Cancel
                        </Button>
                        <Button onClick={handleDeleteFile} disabled={deletingFile} className="bg-red-600 hover:bg-red-700 text-white">
                            {deletingFile ? "Deleting..." : "Delete File"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar / Info - Distinct styling */}
                <div className="space-y-6 animate-slide-up stagger-1">
                    {/* Project Details Card */}
                    <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold dark:text-white text-gray-900 flex items-center">
                                <div className="p-2 bg-purple-500/10 rounded-lg mr-3">
                                    <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                                </div>
                                Details
                            </h3>
                        </div>
                        <div className="section-divider"></div>
                        <p className="text-sm dark:text-gray-300 text-gray-700 mb-6 leading-relaxed dark:bg-white/5 bg-purple-50/50 p-4 rounded-lg border dark:border-white/5 border-purple-100">
                            {project.description || "No description provided."}
                        </p>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm dark:bg-white/5 bg-gray-50 p-3 rounded-lg border dark:border-white/5 border-gray-200">
                                <span className="dark:text-gray-400 text-gray-600 flex items-center"><Clock className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" /> Created</span>
                                <span className="font-medium dark:text-white text-gray-900">Today</span>
                            </div>
                            <div className="flex justify-between text-sm dark:bg-white/5 bg-gray-50 p-3 rounded-lg border dark:border-white/5 border-gray-200">
                                <span className="dark:text-gray-400 text-gray-600 flex items-center"><HardDrive className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" /> Files</span>
                                <span className="font-medium dark:text-white text-gray-900">{project.files.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Upload Card - Distinct styling */}
                    <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 relative overflow-hidden border-l-4 border-dom-blue shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-dom-blue/5 dark:bg-dom-blue/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-lg font-bold dark:text-white text-gray-900 flex items-center">
                                <div className="p-2 bg-dom-blue/10 dark:bg-dom-blue/20 rounded-lg mr-3">
                                    <Upload className="h-5 w-5 text-dom-blue" />
                                </div>
                                Upload File
                            </h3>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs border border-dom-blue/30 text-dom-blue hover:bg-dom-blue hover:text-white transition-all"
                                onClick={() => setIsApsBrowserOpen(true)}
                            >
                                <Cloud className="h-3 w-3 mr-1" /> Import from Autodesk
                            </Button>
                        </div>
                        <div className="section-divider"></div>
                        <p className="text-xs dark:text-gray-400 text-gray-600 mb-6 relative z-10">Supported: RVT, DWG, PDF, IFC</p>

                        <div className="relative z-10">
                            <Input
                                id="file"
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                disabled={uploading}
                                accept=".rvt,.dwg,.pdf,.ifc,.nwc,.dwf"
                                className="hidden"
                            />
                            <label
                                htmlFor="file"
                                className={`
                                    flex flex-col items-center justify-center w-full h-36 
                                    border-2 border-dashed border-dom-blue/30 rounded-xl 
                                    bg-gradient-to-br from-dom-blue/5 to-transparent hover:from-dom-blue/10 hover:border-dom-blue/60 
                                    transition-all cursor-pointer shadow-inner
                                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="p-4 bg-dom-blue/10 rounded-full mb-3 group-hover:scale-110 transition-transform border border-dom-blue/20">
                                    <Upload className="h-7 w-7 text-dom-blue" />
                                </div>
                                <span className="text-sm dark:text-gray-300 text-gray-700 font-medium">Click to browse files</span>
                                <span className="text-xs dark:text-gray-500 text-gray-600 mt-1">or drag and drop</span>
                            </label>
                        </div>

                        {uploading && (
                            <div className="space-y-3 mt-6 relative z-10">
                                <div className="flex items-center justify-between text-xs text-dom-blue font-medium">
                                    <span>Uploading to APS...</span>
                                    <span className="animate-pulse">Please wait</span>
                                </div>
                                <div className="h-2 dark:bg-white/10 bg-gray-200 rounded-full overflow-hidden border dark:border-white/10 border-gray-300">
                                    <div className="h-full bg-gradient-to-r from-dom-blue to-purple-500 animate-progress-indeterminate shadow-[0_0_15px_rgba(16,6,159,0.8)]"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* File List - Distinct main content area */}
                <div className="lg:col-span-2 animate-slide-up stagger-2 space-y-8">
                    
                    {/* Uploaded Files Section */}
                    <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl min-h-[200px] flex flex-col border-l-4 border-green-500 shadow-sm">
                        <div className="p-6 border-b dark:border-white/10 border-gray-200 flex justify-between items-center dark:bg-gradient-to-r dark:from-white/5 dark:to-transparent bg-gradient-to-r from-green-50/30 to-transparent">
                            <h3 className="text-xl font-bold dark:text-white text-gray-900 flex items-center">
                                <div className="p-2 bg-green-500/10 rounded-lg mr-3">
                                    <Box className="h-5 w-5 text-green-500 dark:text-green-400" />
                                </div>
                                Uploaded Files
                            </h3>
                            <span className="text-xs dark:text-gray-400 text-gray-600 dark:bg-white/10 bg-green-50 px-3 py-1.5 rounded-full border dark:border-white/10 border-green-200 font-medium">{uploadedFiles.length} items</span>
                        </div>

                        <div className="p-6 flex-1">
                            {uploadedFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full dark:text-gray-500 text-gray-400 py-10">
                                    <p className="text-sm font-medium dark:text-gray-300 text-gray-600">No uploaded files yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {uploadedFiles.map((file, index) => (
                                        <FileItem 
                                            key={file.id} 
                                            file={file} 
                                            index={index} 
                                            selectedFiles={selectedFiles}
                                            toggleFileSelection={toggleFileSelection}
                                            getFileIcon={getFileIcon}
                                            formatSize={formatSize}
                                            handleStartTranslation={handleStartTranslation}
                                            handleConvert={handleConvert}
                                            convertingFiles={convertingFiles}
                                            translatingFiles={translatingFiles}
                                            handleValidate={handleValidate}
                                            confirmDeleteFile={confirmDeleteFile}
                                            handleViewFile={handleViewFile}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Processed Files Section */}
                    <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl min-h-[200px] flex flex-col border-l-4 border-red-500 shadow-sm">
                        <div className="p-6 border-b dark:border-white/10 border-gray-200 flex justify-between items-center dark:bg-gradient-to-r dark:from-white/5 dark:to-transparent bg-gradient-to-r from-red-50/30 to-transparent">
                            <h3 className="text-xl font-bold dark:text-white text-gray-900 flex items-center">
                                <div className="p-2 bg-red-500/10 rounded-lg mr-3">
                                    <FileText className="h-5 w-5 text-red-500 dark:text-red-400" />
                                </div>
                                Processed Files (PDF)
                            </h3>
                            <span className="text-xs dark:text-gray-400 text-gray-600 dark:bg-white/10 bg-red-50 px-3 py-1.5 rounded-full border dark:border-white/10 border-red-200 font-medium">{processedFiles.length} items</span>
                        </div>

                        <div className="p-6 flex-1">
                            {processedFiles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full dark:text-gray-500 text-gray-400 py-10">
                                    <p className="text-sm font-medium dark:text-gray-300 text-gray-600">No processed files yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {processedFiles.map((file, index) => (
                                        <FileItem 
                                            key={file.id} 
                                            file={file} 
                                            index={index} 
                                            selectedFiles={selectedFiles}
                                            toggleFileSelection={toggleFileSelection}
                                            getFileIcon={getFileIcon}
                                            formatSize={formatSize}
                                            handleStartTranslation={handleStartTranslation}
                                            handleConvert={handleConvert}
                                            convertingFiles={convertingFiles}
                                            translatingFiles={translatingFiles}
                                            handleValidate={handleValidate}
                                            confirmDeleteFile={confirmDeleteFile}
                                            handleViewFile={handleViewFile}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* APS Browser Dialog */}
            <ApsBrowser
                isOpen={isApsBrowserOpen}
                onClose={() => setIsApsBrowserOpen(false)}
                onImport={handleApsImport}
                projectId={params.id as string}
            />

            {/* Viewer Modal */}
            <ViewerModal
                isOpen={!!viewerModal}
                onClose={() => setViewerModal(null)}
                file={viewerModal?.file}
                token={viewerModal?.token}
            />

            {/* Download Modal */}
            <Dialog open={!!downloadModal} onOpenChange={(open) => !open && setDownloadModal(null)}>
                <DialogContent className="glass-panel border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-green-500 flex items-center">
                            <CheckCircle className="mr-2 h-6 w-6" />
                            Conversion Complete
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Your {downloadModal?.format} file is ready for download.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 flex flex-col gap-3 items-center justify-center">
                        <a
                            href={downloadModal?.url}
                            download={`result.${downloadModal?.format.toLowerCase()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white h-11 px-8 w-full max-w-xs"
                            onClick={() => {
                                // Optional: close modal after download start
                                // setTimeout(() => setDownloadModal(null), 1000)
                            }}
                        >
                            <Upload className="mr-2 h-5 w-5 rotate-180" /> {/* Download Icon */}
                            Download {downloadModal?.format}
                        </a>

                        <div className="flex items-center w-full max-w-xs gap-2">
                            <div className="h-px bg-gray-700 flex-1"></div>
                            <span className="text-xs text-gray-500 uppercase">OR</span>
                            <div className="h-px bg-gray-700 flex-1"></div>
                        </div>

                        <Button 
                            onClick={handleSaveToProject}
                            className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white h-11"
                        >
                            <Cloud className="mr-2 h-5 w-5" />
                            Save to Project & View Online
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDownloadModal(null)} className="text-gray-400 hover:text-white hover:bg-white/10">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Bulk Actions Floating Bar */}
            {selectedFiles.length > 0 && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-full shadow-2xl p-2 flex items-center space-x-2 animate-slide-up z-50">
                    <div className="px-4 py-2 font-bold text-sm dark:text-white text-gray-900 border-r border-gray-200 dark:border-white/10">
                        {selectedFiles.length} Selected
                    </div>
                    
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleBulkConvert('pdf')}
                        className="rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                    >
                        <FileText className="h-4 w-4 mr-2" /> PDF
                    </Button>
                    
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleBulkConvert('ifc')}
                        className="rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
                    >
                        <Box className="h-4 w-4 mr-2" /> IFC
                    </Button>
                    
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleBulkValidate}
                        className="rounded-full hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
                    >
                        <CheckCircle className="h-4 w-4 mr-2" /> Validate
                    </Button>

                    <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-2"></div>

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setSelectedFiles([])}
                        className="rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
                    >
                        <span className="sr-only">Clear selection</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </Button>
                </div>
            )}
        </div>
    )
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios-config"
import { FileText, Search, Filter, Download, Eye, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { showError } from "@/lib/error-handler"
import { useUser } from "@/context/UserContext"
import { FileRow } from "@/components/FileRow"
import { ViewerModal } from "@/components/ViewerModal"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FileItem {
    id: string
    name: string
    type: string
    size: number
    status: string
    apsUrn: string | null
    createdAt: string
    apsProjectId?: string
    projectName?: string
    projectId?: string
    progress?: number
}

interface Project {
    id: string
    name: string
    files: FileItem[]
}

export default function AllFilesPage() {
    const { user } = useUser()
    const [files, setFiles] = useState<FileItem[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState('ALL')
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
    const [tempSelectedProjectIds, setTempSelectedProjectIds] = useState<Set<string>>(new Set())
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
    const [viewerModal, setViewerModal] = useState<{ isOpen: boolean, file: FileItem, token?: string } | null>(null)

    useEffect(() => {
        const fetchAllFiles = async () => {
            try {
                // Fetch all projects to get all files
                // Ideally we would have a dedicated /api/files endpoint
                const response = await apiClient.get('/api/projects')
                const projects: Project[] = Array.isArray(response.data) ? response.data : []

                // Flatten files and attach project name
                const allFiles = projects.flatMap(project =>
                    (project.files || []).map(file => ({
                        ...file,
                        projectName: project.name,
                        projectId: project.id
                    }))
                )

                setFiles(allFiles)
                setProjects(projects)
            } catch (error) {
                showError(error, user?.role, "Failed to load files")
            } finally {
                setLoading(false)
            }
        }

        fetchAllFiles()
    }, [user?.role])

    const handleViewFile = async (file: FileItem) => {
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

    const filteredFiles = files.filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (file.projectName?.toLowerCase() || '').includes(searchQuery.toLowerCase())

        const matchesProject = selectedProjectIds.size === 0 || (file.projectId ? selectedProjectIds.has(file.projectId) : false)

        if (activeFilter === 'ALL') return matchesSearch && matchesProject
        return matchesSearch && matchesProject && file.type === activeFilter
    })

    // Note: toggleSelectAll is available but not currently used in the UI
    // Keeping it for potential future use
    void (function toggleSelectAll(checked: boolean) {
        if (checked) {
            const newSelected = new Set(selectedFiles)
            filteredFiles.forEach(f => newSelected.add(f.id))
            setSelectedFiles(newSelected)

            const nonConvertibleCount = filteredFiles.filter(f => f.type !== 'RVT' && f.type !== 'DWG').length
            if (nonConvertibleCount > 0) {
                toast.info(`Selected all files. Note: ${nonConvertibleCount} files cannot be converted to PDF.`)
            }
        } else {
            const newSelected = new Set(selectedFiles)
            filteredFiles.forEach(f => newSelected.delete(f.id))
            setSelectedFiles(newSelected)
        }
    });

    const toggleSelectFile = (id: string) => {
        const newSelected = new Set(selectedFiles)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedFiles(newSelected)
    }

    const handleBatchConvert = async () => {
        if (selectedFiles.size === 0) return

        const filesToConvert = files.filter(f => selectedFiles.has(f.id))
        let started = 0
        let skippedRvt = 0

        toast.info("Starting batch conversion...")

        for (const file of filesToConvert) {
            // Skip RVT files - PDF export requires Design Automation (not supported yet)
            if (file.type === 'RVT') {
                skippedRvt++
                continue
            }

            // Only DWG/DXF are supported for PDF conversion via Model Derivative
            if (file.type !== 'DWG') continue;

            try {
                await apiClient.post(`/api/conversion/${file.id}`, {
                    format: 'pdf'
                })
                started++
            } catch (error: unknown) {
                const axiosError = error as { response?: { status?: number } };
                if (axiosError.response?.status === 429) {
                    toast.warning("Concurrency limit reached. Please wait for pending conversions to finish.")
                    break;
                }
                console.error(`Failed to start conversion for ${file.name}:`, error)
                showError(error, user?.role, `Failed to convert ${file.name}`)
            }
        }

        if (skippedRvt > 0) {
            toast.warning(`${skippedRvt} Revit file(s) skipped - PDF export not available for RVT files`)
        }

        if (started > 0) {
            toast.success(`Started PDF conversion for ${started} files`)
            setSelectedFiles(new Set()) // Clear selection
        } else if (skippedRvt === 0) {
            toast.info("No eligible files selected for PDF conversion")
        }
    }


    const handleBatchDownload = async () => {
        if (selectedFiles.size === 0) return

        // Filter for valid files (must be READY and have a URN)
        const filesToDownload = files.filter(f =>
            selectedFiles.has(f.id) &&
            f.status === 'READY' &&
            f.apsUrn
        )

        if (filesToDownload.length === 0) {
            toast.warning("No valid files selected for download.")
            return
        }

        if (filesToDownload.length > 1) {
            try {
                toast.info(`Preparing ZIP archive for ${filesToDownload.length} files...`)
                const response = await apiClient.post('/api/files/batch-download', {
                    fileIds: filesToDownload.map(f => f.id)
                }, {
                    responseType: 'blob'
                })

                // Create download link
                const url = window.URL.createObjectURL(new Blob([response.data]))
                const link = document.createElement('a')
                link.href = url
                link.setAttribute('download', `files_archive_${Date.now()}.zip`)
                document.body.appendChild(link)
                link.click()
                link.remove()
                window.URL.revokeObjectURL(url)

                toast.success("ZIP download started")
            } catch (error) {
                console.error("Batch download failed:", {
                    error: error instanceof Error ? error.message : String(error),
                    fileCount: filesToDownload.length
                })
                showError(error, user?.role, "Batch download failed")
                toast.error("Failed to create ZIP archive")
            }
        } else {
            // Single file download
            const file = filesToDownload[0]
            window.open(`/api/files/${file.id}/download`, '_blank')
            toast.success(`Started download for ${file.name}`)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* Header */}
            <div>
                <h2 className="text-4xl font-bold text-foreground tracking-tight">All Files</h2>
                <p className="text-muted-foreground mt-2 text-lg">Global view of all project documents.</p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl shadow-sm border border-border/50">
                {/* Left: Search & Filter */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-secondary/50 border-transparent focus:bg-background transition-all rounded-xl"
                        />
                    </div>

                    <div className="flex items-center bg-secondary/50 rounded-xl p-1">
                        {['ALL', 'RVT', 'DWG', 'PDF'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setActiveFilter(filter)}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeFilter === filter
                                    ? 'bg-white text-dom-blue shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                                    }`}
                            >
                                {filter === 'ALL' ? 'All Files' : filter}
                            </button>
                        ))}
                    </div>

                    <DropdownMenu open={isFilterOpen} onOpenChange={(open) => {
                        setIsFilterOpen(open)
                        if (open) {
                            setTempSelectedProjectIds(new Set(selectedProjectIds))
                        }
                    }}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 border-transparent bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl">
                                <Filter className="mr-2 h-4 w-4" />
                                Filter Projects
                                {selectedProjectIds.size > 0 && (
                                    <span className="ml-2 bg-dom-blue text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                        {selectedProjectIds.size}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72 p-0 rounded-xl border-border/50 shadow-xl">
                            <div className="p-4 border-b border-border/50">
                                <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">Filter by Project</DropdownMenuLabel>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {projects.length === 0 ? (
                                    <div className="p-8 text-sm text-muted-foreground text-center">No projects found</div>
                                ) : (
                                    projects.map((project) => (
                                        <div
                                            key={project.id}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary cursor-pointer transition-colors group"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                const newSelected = new Set(tempSelectedProjectIds)
                                                if (newSelected.has(project.id)) {
                                                    newSelected.delete(project.id)
                                                } else {
                                                    newSelected.add(project.id)
                                                }
                                                setTempSelectedProjectIds(newSelected)
                                            }}
                                        >
                                            <Checkbox
                                                checked={tempSelectedProjectIds.has(project.id)}
                                                className="border-gray-300 data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue rounded-md h-4 w-4"
                                            />
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors">{project.name}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-3 border-t border-border/50 flex items-center justify-between bg-secondary/30">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setTempSelectedProjectIds(new Set())
                                        setSelectedProjectIds(new Set())
                                        setIsFilterOpen(false)
                                    }}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Clear
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setSelectedProjectIds(tempSelectedProjectIds)
                                        setIsFilterOpen(false)
                                    }}
                                    className="bg-dom-blue hover:bg-dom-blue/90 text-white h-8 text-xs font-bold rounded-lg px-4"
                                >
                                    Apply Filter
                                </Button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* File List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-card h-20 animate-pulse rounded-2xl shadow-sm"></div>
                    ))}
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="bg-card rounded-3xl p-16 text-center border border-dashed border-border/50 shadow-sm">
                    <div className="bg-secondary/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No files found</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">Upload files inside your projects to see them appear in this global view.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredFiles.map((file) => (
                        <FileRow
                            key={file.id}
                            fileName={file.name}
                            fileType={file.type}
                            fileSize={formatSize(file.size)}
                            updatedAt={new Date(file.createdAt).toLocaleDateString()}
                            status={file.status}
                            progress={file.progress}
                            isSelected={selectedFiles.has(file.id)}
                            onSelect={() => toggleSelectFile(file.id)}
                            onView={() => handleViewFile(file)}
                            onRetry={() => { }}
                            projectName={file.projectName}
                            actions={
                                <div className="flex items-center gap-2 justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewFile(file)}
                                        className="text-dom-blue hover:bg-blue-50 hover:text-blue-700 font-medium rounded-lg"
                                    >
                                        <Eye className="h-4 w-4 mr-2" /> View
                                    </Button>
                                    <Link href={`/dashboard/projects/${file.projectId}`}>
                                        <Button variant="ghost" size="icon" className="hover:bg-secondary text-muted-foreground hover:text-foreground rounded-full">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            }
                        />
                    ))}
                </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedFiles.size > 0 && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl text-white pl-4 pr-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4 border border-white/10 ring-1 ring-black/20">
                    <div className="flex items-center gap-4 border-r border-gray-700 pr-4">
                        <div className="bg-dom-blue text-white text-xs font-bold px-2 py-1 rounded-full w-6 h-6 flex items-center justify-center">
                            {selectedFiles.size}
                        </div>
                        <span className="font-medium text-sm">Selected</span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedFiles(new Set())} className="text-gray-400 hover:text-white h-auto p-0 hover:bg-transparent">
                            Clear
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        {(() => {
                            // Only DWG files can be converted to PDF (RVT requires Design Automation)
                            const convertibleFiles = files.filter(f => selectedFiles.has(f.id) && f.type === 'DWG');
                            const count = convertibleFiles.length;


                            return (
                                <Button
                                    onClick={handleBatchConvert}
                                    disabled={count === 0}
                                    className={`rounded-full h-9 text-xs font-bold border transition-all px-4 ${count > 0
                                        ? 'bg-white/10 text-white hover:bg-white/20 border-white/10'
                                        : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed'
                                        }`}
                                >
                                    <FileText className="h-3 w-3 mr-2" />
                                    {count > 0 ? `Convert ${count} to PDF` : 'No convertible files'}
                                </Button>
                            );
                        })()}
                        <Button onClick={handleBatchDownload} className="bg-white text-gray-900 hover:bg-gray-200 rounded-full h-9 text-xs font-bold px-4">
                            <Download className="h-3 w-3 mr-2" />
                            {selectedFiles.size > 3 ? 'Download ZIP' : 'Download All'}
                        </Button>
                    </div>
                </div>
            )}

            <ViewerModal
                isOpen={!!viewerModal}
                onClose={() => setViewerModal(null)}
                file={viewerModal?.file ?? null}
                token={viewerModal?.token}
            />
        </div>
    )
}

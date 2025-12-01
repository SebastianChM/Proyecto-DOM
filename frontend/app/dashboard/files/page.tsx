"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import axios from "axios"
import { FileText, Search, Filter, Download, Eye, ArrowRight, CheckSquare, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { showError } from "@/lib/error-handler"
import { useUser } from "@/context/UserContext"
import { FileRow } from "@/components/FileRow"
import { ViewerModal } from "@/components/ViewerModal"

interface Project {
    id: string
    name: string
    files: any[]
}

export default function AllFilesPage() {
    const { user } = useUser()
    const [files, setFiles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
    const [viewerModal, setViewerModal] = useState<{ isOpen: boolean, file: any, token?: string } | null>(null)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    useEffect(() => {
        const fetchAllFiles = async () => {
            try {
                // Fetch all projects to get all files
                // Ideally we would have a dedicated /api/files endpoint
                const response = await axios.get(`${API_URL}/api/projects`)
                const projects: Project[] = response.data
                
                // Flatten files and attach project name
                const allFiles = projects.flatMap(project => 
                    project.files.map(file => ({
                        ...file,
                        projectName: project.name,
                        projectId: project.id
                    }))
                )
                
                setFiles(allFiles)
            } catch (error) {
                showError(error, user?.role, "Failed to load files")
            } finally {
                setLoading(false)
            }
        }

        fetchAllFiles()
    }, [user?.role])

    const handleViewFile = async (file: any) => {
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

    const filteredFiles = files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            const newSelected = new Set(selectedFiles)
            filteredFiles.forEach(f => newSelected.add(f.id))
            setSelectedFiles(newSelected)
        } else {
            const newSelected = new Set(selectedFiles)
            filteredFiles.forEach(f => newSelected.delete(f.id))
            setSelectedFiles(newSelected)
        }
    }

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
        
        toast.info("Starting batch conversion...")

        for (const file of filesToConvert) {
            // Skip if not convertible (e.g. already PDF)
            if (file.type === 'PDF') continue;
            
            try {
                await axios.post(`${API_URL}/api/conversion/${file.id}`, {
                    format: 'pdf'
                })
                started++
            } catch (error) {
                console.error(`Failed to start conversion for ${file.name}`, error)
            }
        }
        
        if (started > 0) {
            toast.success(`Started PDF conversion for ${started} files`)
            setSelectedFiles(new Set()) // Clear selection
        } else {
            toast.info("No eligible files selected for PDF conversion")
        }
    }

    const handleBatchDownload = async () => {
        if (selectedFiles.size === 0) return

        const filesToDownload = files.filter(f => selectedFiles.has(f.id))
        
        if (filesToDownload.length > 3) {
            try {
                toast.info("Preparing ZIP archive...")
                const response = await axios.post(`${API_URL}/api/files/batch-download`, {
                    fileIds: Array.from(selectedFiles)
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
                console.error("Batch download failed", error)
                toast.error("Failed to create ZIP archive")
            }
        } else {
            filesToDownload.forEach((file) => {
                window.open(`${API_URL}/api/files/${file.id}/download`, '_blank')
            })
            toast.success(`Started download for ${filesToDownload.length} files`)
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">All Files</h2>
                    <p className="dark:text-gray-400 text-gray-600 mt-2 text-lg">Global view of all project documents.</p>
                </div>
                
                <div className="flex items-center space-x-3">
                    <div className="flex items-center gap-2 bg-white dark:bg-white/5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 h-10">
                        <Checkbox 
                            checked={filteredFiles.length > 0 && filteredFiles.every(f => selectedFiles.has(f.id))}
                            onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                            className="data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue"
                        />
                        <span className="text-sm text-gray-500 font-medium">Select All</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dom-blue h-4 w-4" />
                        <Input
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 w-64 focus-visible:ring-dom-blue focus-visible:border-dom-blue rounded-xl shadow-sm h-10"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="glass-panel h-16 animate-pulse rounded-xl"></div>
                    ))}
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="glass-panel rounded-3xl p-16 text-center border-dashed border-white/10">
                    <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="h-10 w-10 text-dom-blue" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">No files found</h3>
                    <p className="text-gray-400">Upload files inside your projects to see them here.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredFiles.map((file) => (
                        <div key={file.id} className="group relative">
                            <FileRow
                                fileName={file.name}
                                fileType={file.type}
                                fileSize={formatSize(file.size)}
                                updatedAt={new Date(file.createdAt).toLocaleDateString()}
                                status={file.status}
                                progress={file.progress}
                                isSelected={selectedFiles.has(file.id)}
                                onSelect={() => toggleSelectFile(file.id)}
                                onView={() => handleViewFile(file)}
                                onRetry={() => {}}
                                actions={
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 mr-4 hidden md:inline-block">
                                            Project: <span className="text-dom-blue font-medium">{file.projectName}</span>
                                        </span>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleViewFile(file)}
                                            className="text-dom-blue hover:text-white hover:bg-dom-blue"
                                        >
                                            <Eye className="h-4 w-4 mr-2" /> View
                                        </Button>
                                        <Link href={`/dashboard/projects/${file.projectId}`}>
                                            <Button variant="ghost" size="icon">
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                }
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedFiles.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-xl text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4 border border-white/10">
                    <div className="flex items-center gap-4 border-r border-gray-700 pr-4">
                        <div className="bg-dom-blue text-white text-xs font-bold px-2 py-1 rounded-full">
                            {selectedFiles.size}
                        </div>
                        <span className="font-medium text-sm">Selected</span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedFiles(new Set())} className="text-gray-400 hover:text-white h-auto p-0 hover:bg-transparent">
                            Clear
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handleBatchConvert} className="bg-white/10 text-white hover:bg-white/20 rounded-full h-8 text-xs font-bold border border-white/10">
                            <FileText className="h-3 w-3 mr-2" />
                            Convert to PDF
                        </Button>
                        <Button onClick={handleBatchDownload} className="bg-white text-gray-900 hover:bg-gray-200 rounded-full h-8 text-xs font-bold">
                            <Download className="h-3 w-3 mr-2" />
                            {selectedFiles.size > 3 ? 'Download ZIP' : 'Download All'}
                        </Button>
                    </div>
                </div>
            )}

            <ViewerModal
                isOpen={!!viewerModal}
                onClose={() => setViewerModal(null)}
                file={viewerModal?.file}
                token={viewerModal?.token}
            />
        </div>
    )
}

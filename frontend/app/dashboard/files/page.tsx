"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import axios from "axios"
import { FileText, Search, Filter, Download, Eye, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">All Files</h2>
                    <p className="dark:text-gray-400 text-gray-600 mt-2 text-lg">Global view of all project documents.</p>
                </div>
                
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dom-blue h-4 w-4" />
                        <Input
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 w-64 focus-visible:ring-dom-blue focus-visible:border-dom-blue rounded-xl shadow-sm"
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
                                isSelected={false}
                                onSelect={() => {}}
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

            <ViewerModal
                isOpen={!!viewerModal}
                onClose={() => setViewerModal(null)}
                file={viewerModal?.file}
                token={viewerModal?.token}
            />
        </div>
    )
}

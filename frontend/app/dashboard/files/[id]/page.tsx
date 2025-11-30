"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { ArrowLeft, Clock, GitCompare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface FileVersion {
    id: string
    version: number
    uploadedAt: string
    size: number
    status: string
}

interface FileData {
    id: string
    name: string
    projectId: string
    versions: FileVersion[]
}

export default function FileHistoryPage() {
    const params = useParams()
    const fileId = params.id as string

    const [file, setFile] = useState<FileData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchFileHistory = async () => {
            try {
                const response = await axios.get(`http://localhost:8080/api/files/${fileId}`)
                setFile(response.data)
            } catch (error) {
                console.error('Failed to fetch file history:', error)
            } finally {
                setLoading(false)
            }
        }

        if (fileId) {
            fetchFileHistory()
        }
    }, [fileId])

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString()
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
                Loading file history...
            </div>
        )
    }

    if (!file) {
        return (
            <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
                File not found
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between border-l-4 border-purple-500 shadow-sm">
                <div className="flex items-center space-x-4">
                    <Link href={file ? `/dashboard/projects/${file.projectId}` : '/dashboard'}>
                        <Button variant="ghost" size="icon" className="dark:glass-button bg-gray-50 dark:bg-white/10 rounded-full h-12 w-12 border border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/20">
                            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold dark:text-white text-gray-900 tracking-tight">File History & Compare</h1>
                        <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">{file?.name || 'Loading...'}</p>
                    </div>
                </div>
                <Button className="bg-purple-500 hover:bg-purple-600 text-white" disabled>
                    <GitCompare className="h-4 w-4 mr-2" />
                    Compare Versions
                </Button>
            </div>

            {/* Version History */}
            <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b dark:border-white/10 border-gray-200 dark:bg-white/5 bg-gray-50">
                    <h3 className="text-xl font-bold dark:text-white text-gray-900 flex items-center">
                        <div className="p-2 bg-purple-500/10 rounded-lg mr-3">
                            <Clock className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                        </div>
                        Version History
                    </h3>
                </div>

                <div className="p-6">
                    {!file.versions || file.versions.length === 0 ? (
                        <div className="text-center py-12 dark:text-gray-400 text-gray-500">
                            <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">No version history available</p>
                            <p className="text-sm">This file has not been versioned yet.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="dark:border-white/10 border-gray-200">
                                    <TableHead className="dark:text-white text-gray-900 font-bold">Version</TableHead>
                                    <TableHead className="dark:text-white text-gray-900 font-bold">Uploaded</TableHead>
                                    <TableHead className="dark:text-white text-gray-900 font-bold">Size</TableHead>
                                    <TableHead className="dark:text-white text-gray-900 font-bold">Status</TableHead>
                                    <TableHead className="dark:text-white text-gray-900 font-bold text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {file.versions.map((version) => (
                                    <TableRow key={version.id} className="dark:border-white/10 border-gray-200 dark:hover:bg-white/5 hover:bg-gray-50">
                                        <TableCell className="font-medium dark:text-white text-gray-900">
                                            v{version.version}
                                        </TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700">
                                            {formatDate(version.uploadedAt)}
                                        </TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700">
                                            {formatSize(version.size)}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${version.status === 'READY' ? 'bg-green-500/20 text-green-600 dark:text-green-300' :
                                                    version.status === 'FAILED' ? 'bg-red-500/20 text-red-600 dark:text-red-300' :
                                                        'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                                                }`}>
                                                {version.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" disabled>
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            {/* Info Message */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm dark:text-blue-300 text-blue-800">
                    <strong>Note:</strong> Version comparison and detailed history features are coming soon. Currently showing basic file information.
                </p>
            </div>
        </div>
    )
}

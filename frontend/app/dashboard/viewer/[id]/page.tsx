"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import dynamic from 'next/dynamic'
import { toast } from "sonner"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

// Dynamically import Viewer to avoid SSR issues
const Viewer = dynamic(() => import('@/components/Viewer'), { ssr: false })

interface FileData {
    id: string
    name: string
    apsUrn: string | null
    projectId: string
    status: string
}

export default function ViewerPage() {
    const params = useParams()
    const { user } = useUser()
    const fileId = params.id as string
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    const [file, setFile] = useState<FileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const fetchFile = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/files/${fileId}`)
                setFile(response.data)
            } catch (error) {
                showError(error, user?.role, "Failed to load file details")
            } finally {
                setLoading(false)
            }
        }

        if (fileId) {
            fetchFile()
        }
    }, [fileId, API_URL, user?.role])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dom-blue mx-auto mb-4"></div>
                    <p>Loading 3D viewer...</p>
                </div>
            </div>
        )
    }

    if (!file) {
        return (
            <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
                <div className="text-center">
                    <p className="text-xl mb-4">File not found</p>
                    <Link href="/dashboard">
                        <Button>Return to Dashboard</Button>
                    </Link>
                </div>
            </div>
        )
    }

    if (file.status !== 'READY' || !file.apsUrn) {
        return (
            <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
                <div className="text-center max-w-md">
                    <p className="text-xl mb-4">File is not ready for viewing</p>
                    <p className="dark:text-gray-400 text-gray-600 mb-6">
                        Status: <span className="font-bold">{file.status}</span>
                    </p>
                    <p className="text-sm dark:text-gray-500 text-gray-500 mb-6">
                        {file.status === 'TRANSLATING' && 'The file is currently being processed. Please check back in a few minutes.'}
                        {file.status === 'UPLOADED' && 'The file has been uploaded but translation has not started yet.'}
                        {file.status === 'FAILED' && 'File translation failed. Please try uploading again.'}
                    </p>
                    <Link href={`/dashboard/projects/${file.projectId}`}>
                        <Button>Return to Project</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 p-4 flex items-center justify-between z-10">
                <div className="flex items-center space-x-4">
                    <Link href={`/dashboard/projects/${file.projectId}`}>
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold dark:text-white text-gray-900">{file.name}</h1>
                        <p className="text-sm dark:text-gray-400 text-gray-600">3D Model Viewer</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="flex items-center gap-2"
                >
                    {isFullscreen ? (
                        <>
                            <Minimize2 className="h-4 w-4" />
                            Exit Fullscreen
                        </>
                    ) : (
                        <>
                            <Maximize2 className="h-4 w-4" />
                            Fullscreen
                        </>
                    )}
                </Button>
            </div>

            {/* Viewer */}
            <div className="flex-1 relative bg-gray-100 dark:bg-gray-950">
                <Viewer urn={file.apsUrn} />
            </div>
        </div>
    )
}

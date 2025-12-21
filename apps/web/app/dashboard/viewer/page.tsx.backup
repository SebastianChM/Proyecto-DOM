"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"
import { Box, Upload, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Viewer from "@/components/Viewer"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

function ViewerContent() {
    const searchParams = useSearchParams()
    const urn = searchParams.get('urn')
    const [token, setToken] = useState<string>("")
    const [projects, setProjects] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useUser()
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/auth/token`)
                setToken(response.data.access_token)
            } catch (error) {
                console.error("Failed to fetch viewer token", error)
            }
        }
        fetchToken()
    }, [])

    useEffect(() => {
        if (!urn) {
            const fetchProjects = async () => {
                try {
                    const response = await axios.get(`${API_URL}/api/projects`)
                    setProjects(response.data)
                } catch (error) {
                    showError(error, user?.role, "Failed to load projects")
                } finally {
                    setLoading(false)
                }
            }
            fetchProjects()
        }
    }, [urn, user?.role])

    if (urn && token) {
        return (
            <div className="h-[calc(100vh-100px)] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
                <Viewer token={token} urn={urn} />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in h-full">
            <div>
                <h2 className="text-4xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">3D Viewer</h2>
                <p className="dark:text-gray-400 text-gray-600 mt-2 text-lg">High-performance BIM viewer.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Upload Card */}
                <Card className="glass-panel border-dashed border-2 border-white/20 hover:border-dom-blue/50 transition-all cursor-pointer group h-64 flex items-center justify-center">
                    <CardContent className="text-center">
                        <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="h-8 w-8 text-dom-blue" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Quick View</h3>
                        <p className="text-gray-400 text-sm mb-4">Upload a file to view instantly without saving to a project.</p>
                        <Button variant="outline" className="glass-button">Select File</Button>
                    </CardContent>
                </Card>

                {/* Recent Files Selection */}
                {projects.flatMap(p => p.files).filter((f: any) => f.status === 'READY' && (f.type === 'RVT' || f.type === 'IFC')).slice(0, 5).map((file: any) => (
                    <Card key={file.id} className="glass-panel hover:bg-white/5 transition-all group">
                        <CardContent className="p-6 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-dom-blue/10 rounded-xl">
                                        <Box className="h-6 w-6 text-dom-blue" />
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 bg-black/20 px-2 py-1 rounded">{file.type}</span>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1 truncate" title={file.name}>{file.name}</h3>
                                <p className="text-sm text-gray-400">Ready to view</p>
                            </div>
                            <Button 
                                className="w-full mt-4 bg-dom-blue/10 hover:bg-dom-blue text-dom-blue hover:text-white border border-dom-blue/20"
                                onClick={() => window.location.href = `/dashboard/viewer?urn=${file.apsUrn}`}
                            >
                                Open Viewer <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

export default function ViewerPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading Viewer...</div>}>
            <ViewerContent />
        </Suspense>
    )
}

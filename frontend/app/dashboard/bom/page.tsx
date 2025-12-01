"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { TableProperties, Search, ChevronRight, Box, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { showError } from "@/lib/error-handler"
import { useUser } from "@/context/UserContext"

interface Project {
    id: string
    name: string
    files: any[]
}

interface BOMItem {
    id: number
    name: string
    category: string
    family: string
    type: string
    material: string
    volume: number
    area: number
    count: number
}

export default function BOMPage() {
    const { user } = useUser()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedFile, setSelectedFile] = useState<any | null>(null)
    const [bomData, setBomData] = useState<BOMItem[]>([])
    const [loadingBom, setLoadingBom] = useState(false)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    useEffect(() => {
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
    }, [user?.role])

    const handleFileSelect = async (file: any) => {
        if (file.status !== 'READY') {
            toast.error("File must be processed (READY) to extract quantities.")
            return
        }
        
        setSelectedFile(file)
        setLoadingBom(true)
        
        try {
            const response = await axios.get(`${API_URL}/api/files/${file.id}/bom`)
            setBomData(response.data)
        } catch (error) {
            showError(error, user?.role, "Failed to load BOM data")
            setBomData([])
        } finally {
            setLoadingBom(false)
        }
    }

    return (
        <div className="space-y-8 animate-fade-in h-[calc(100vh-100px)] flex flex-col">
            <div>
                <h2 className="text-4xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">BOM & Quantities</h2>
                <p className="dark:text-gray-400 text-gray-600 mt-2 text-lg">Extract automated Bill of Materials from your BIM models.</p>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Sidebar: File Selection */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col gap-4 overflow-hidden">
                    <Card className="h-full flex flex-col glass-panel border-white/10">
                        <CardHeader>
                            <CardTitle className="text-lg">Select Model</CardTitle>
                            <CardDescription>Choose a file to analyze</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0">
                            {loading ? (
                                <div className="p-4 text-center text-gray-500">Loading projects...</div>
                            ) : (
                                <div className="space-y-1">
                                    {projects.map(project => (
                                        <div key={project.id} className="px-2">
                                            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                {project.name}
                                            </div>
                                            {project.files.filter((f: any) => f.type === 'RVT' || f.type === 'IFC').length === 0 && (
                                                <div className="px-4 py-2 text-sm text-gray-400 italic">No BIM models</div>
                                            )}
                                            {project.files.filter((f: any) => f.type === 'RVT' || f.type === 'IFC').map((file: any) => (
                                                <button
                                                    key={file.id}
                                                    onClick={() => handleFileSelect(file)}
                                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-between group ${
                                                        selectedFile?.id === file.id 
                                                            ? 'bg-dom-blue text-white shadow-lg' 
                                                            : 'hover:bg-white/10 text-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center overflow-hidden">
                                                        <Box className="h-4 w-4 mr-3 flex-shrink-0" />
                                                        <span className="truncate">{file.name}</span>
                                                    </div>
                                                    {selectedFile?.id === file.id && <ChevronRight className="h-4 w-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content: BOM Table */}
                <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col overflow-hidden">
                    <Card className="h-full flex flex-col glass-panel border-white/10">
                        {!selectedFile ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                                <TableProperties className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">No model selected</p>
                                <p className="text-sm">Select a BIM model from the list to view quantities.</p>
                            </div>
                        ) : loadingBom ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dom-blue"></div>
                            </div>
                        ) : bomData.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                                <Database className="h-16 w-16 mb-4 opacity-20" />
                                <p className="text-lg font-medium">No Data Available</p>
                                <p className="text-sm">Could not extract properties from this model.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{selectedFile.name}</h3>
                                        <p className="text-sm text-gray-400">{bomData.length} items found</p>
                                    </div>
                                    <Button variant="outline" className="glass-button">
                                        Export CSV
                                    </Button>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-400 uppercase bg-black/20 sticky top-0 backdrop-blur-md">
                                            <tr>
                                                <th className="px-6 py-3">Category</th>
                                                <th className="px-6 py-3">Family</th>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Material</th>
                                                <th className="px-6 py-3 text-right">Qty</th>
                                                <th className="px-6 py-3 text-right">Vol (m³)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {bomData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-white">{item.category}</td>
                                                    <td className="px-6 py-3 text-gray-300">{item.family}</td>
                                                    <td className="px-6 py-3 text-gray-400">{item.type}</td>
                                                    <td className="px-6 py-3 text-gray-400">{item.material}</td>
                                                    <td className="px-6 py-3 text-right text-white">{item.count}</td>
                                                    <td className="px-6 py-3 text-right text-gray-300">{item.volume?.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    )
}

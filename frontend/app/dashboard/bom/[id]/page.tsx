"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import axios from "axios"
import { ArrowLeft, Download, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

interface BOMItem {
    id: string
    name: string
    category: string
    family: string
    type: string
    material: string
    volume: number
    area: number
    length: number
    count: number
}

interface FileData {
    id: string
    name: string
    projectId: string
}

export default function BOMPage() {
    const params = useParams()
    const { user } = useUser()
    const fileId = params.id as string
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    const [file, setFile] = useState<FileData | null>(null)
    const [bomData, setBomData] = useState<BOMItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        const fetchBOM = async () => {
            try {
                // Fetch file info
                const fileResponse = await axios.get(`${API_URL}/api/files/${fileId}`)
                setFile(fileResponse.data)

                // Fetch BOM data
                const bomResponse = await axios.get(`${API_URL}/api/files/${fileId}/bom`)
                setBomData(bomResponse.data.items || bomResponse.data || [])
            } catch (error) {
                showError(error, user?.role, "Failed to load BOM data")
            } finally {
                setLoading(false)
            }
        }

        if (fileId) {
            fetchBOM()
        }
    }, [fileId, API_URL, user?.role])

    const filteredData = bomData.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.family.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
                Loading BOM data...
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 flex items-center justify-between border-l-4 border-green-500 shadow-sm">
                <div className="flex items-center space-x-4">
                    <Link href={file ? `/dashboard/projects/${file.projectId}` : '/dashboard'}>
                        <Button variant="ghost" size="icon" className="dark:glass-button bg-gray-50 dark:bg-white/10 rounded-full h-12 w-12 border border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/20">
                            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold dark:text-white text-gray-900 tracking-tight">Bill of Materials</h1>
                        <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">{file?.name || 'Loading...'}</p>
                    </div>
                </div>
                <Button className="bg-green-500 hover:bg-green-600 text-white">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 dark:text-gray-400 text-gray-500" />
                        <Input
                            placeholder="Search by name, category, or family..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 dark:bg-white/5 dark:border-white/10 dark:text-white bg-white border-gray-300 text-gray-900"
                        />
                    </div>
                    <Button variant="outline" className="dark:glass-button bg-white dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-700 dark:text-white">
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-600">
                        Showing {filteredData.length} of {bomData.length} items
                    </span>
                </div>
            </div>

            {/* BOM Table */}
            <div className="bg-white dark:glass-panel border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="dark:border-white/10 border-gray-200 dark:bg-white/5 bg-gray-50">
                                <TableHead className="dark:text-white text-gray-900 font-bold">Name</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold">Category</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold">Family</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold">Type</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold">Material</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold text-right">Volume (m³)</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold text-right">Area (m²)</TableHead>
                                <TableHead className="dark:text-white text-gray-900 font-bold text-right">Count</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 dark:text-gray-400 text-gray-500">
                                        {searchTerm ? 'No items match your search' : 'No BOM data available'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((item) => (
                                    <TableRow key={item.id} className="dark:border-white/10 border-gray-200 dark:hover:bg-white/5 hover:bg-gray-50">
                                        <TableCell className="font-medium dark:text-white text-gray-900">{item.name}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700">{item.category}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700">{item.family}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700">{item.type}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700">{item.material}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700 text-right">{item.volume.toFixed(2)}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700 text-right">{item.area.toFixed(2)}</TableCell>
                                        <TableCell className="dark:text-gray-300 text-gray-700 text-right">{item.count}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}

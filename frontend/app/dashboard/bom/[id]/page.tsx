"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import apiClient from "@/lib/axios-config"
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

    const [file, setFile] = useState<FileData | null>(null)
    const [bomData, setBomData] = useState<BOMItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        const fetchBOM = async () => {
            try {
                // Fetch file info
                const fileResponse = await apiClient.get(`/api/files/${fileId}`)
                setFile(fileResponse.data)

                // Fetch BOM data
                const bomResponse = await apiClient.get(`/api/files/${fileId}/bom`)
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
    }, [fileId, user?.role])

    const filteredData = bomData.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.family.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalVolume = bomData.reduce((acc, item) => acc + (item.volume || 0), 0)
    const totalArea = bomData.reduce((acc, item) => acc + (item.area || 0), 0)

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
                <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-lg font-medium text-foreground animate-pulse">Loading BOM Data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border-l-4 border-primary">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link href={file ? `/dashboard/projects/${file.projectId}` : '/dashboard'}>
                            <Button variant="ghost" size="icon" className="glass-button rounded-full h-12 w-12 hover:bg-primary/10 hover:text-primary transition-colors">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">Bill of Materials</h1>
                            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                {file?.name || 'Loading...'}
                            </p>
                        </div>
                    </div>
                    <Button className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all hover:scale-105 w-full md:w-auto">
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Filter className="h-16 w-16 text-primary" />
                        </div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Items</h3>
                        <p className="text-4xl font-bold text-foreground">{bomData.length}</p>
                        <div className="mt-4 h-1 w-full bg-primary/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-full animate-slide-in-right"></div>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <div className="h-16 w-16 border-4 border-blue-500 rounded-lg"></div>
                        </div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Volume</h3>
                        <p className="text-4xl font-bold text-foreground">{totalVolume.toFixed(2)} <span className="text-lg text-muted-foreground font-normal">m³</span></p>
                        <div className="mt-4 h-1 w-full bg-blue-500/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[75%] animate-slide-in-right delay-100"></div>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <div className="h-16 w-16 border-4 border-orange-500 rounded-full"></div>
                        </div>
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Area</h3>
                        <p className="text-4xl font-bold text-foreground">{totalArea.toFixed(2)} <span className="text-lg text-muted-foreground font-normal">m²</span></p>
                        <div className="mt-4 h-1 w-full bg-orange-500/10 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 w-[60%] animate-slide-in-right delay-200"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, category, or family..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white/5 border-white/10 text-foreground focus:ring-primary/50 focus:border-primary/50 transition-all"
                    />
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <span className="text-sm text-muted-foreground">
                        Showing <span className="font-bold text-foreground">{filteredData.length}</span> items
                    </span>
                    <Button variant="outline" className="glass-button border-white/10 hover:bg-white/10">
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                </div>
            </div>

            {/* BOM Table */}
            <div className="glass-card rounded-2xl overflow-hidden shadow-xl border border-white/5">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-white/10 bg-white/5 hover:bg-white/5">
                                <TableHead className="text-foreground font-bold py-4">Name</TableHead>
                                <TableHead className="text-foreground font-bold py-4">Category</TableHead>
                                <TableHead className="text-foreground font-bold py-4">Family</TableHead>
                                <TableHead className="text-foreground font-bold py-4">Type</TableHead>
                                <TableHead className="text-foreground font-bold py-4">Material</TableHead>
                                <TableHead className="text-foreground font-bold text-right py-4">Volume (m³)</TableHead>
                                <TableHead className="text-foreground font-bold text-right py-4">Area (m²)</TableHead>
                                <TableHead className="text-foreground font-bold text-right py-4">Count</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="h-8 w-8 opacity-50" />
                                            <p>{searchTerm ? 'No items match your search' : 'No BOM data available'}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((item, index) => (
                                    <TableRow
                                        key={item.id}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">{item.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.category}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.family}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.type}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.material}</TableCell>
                                        <TableCell className="text-muted-foreground text-right font-mono">{item.volume?.toFixed(2) || '0.00'}</TableCell>
                                        <TableCell className="text-muted-foreground text-right font-mono">{item.area?.toFixed(2) || '0.00'}</TableCell>
                                        <TableCell className="text-muted-foreground text-right font-mono">{item.count}</TableCell>
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

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import axios from "axios"
import { 
    LayoutDashboard, 
    FolderKanban, 
    FileText, 
    Box, 
    Activity, 
    Clock, 
    ArrowUpRight,
    CheckCircle,
    AlertCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

export default function DashboardPage() {
    const { user } = useUser()
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalFiles: 0,
        activeModels: 0,
        totalSize: 0,
        recentActivity: [] as any[],
        isProcessing: false
    })
    const [loading, setLoading] = useState(true)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/projects`)
                const projects = response.data
                
                const totalFiles = projects.reduce((acc: number, p: any) => acc + p._count.files, 0)
                
                // Calculate total size from all files in all projects
                const totalSize = projects.reduce((acc: number, p: any) => {
                    return acc + (p.files?.reduce((fAcc: number, f: any) => fAcc + (f.size || 0), 0) || 0)
                }, 0)

                // Check if any file is currently processing
                const isProcessing = projects.some((p: any) => 
                    p.files?.some((f: any) => f.status === 'TRANSLATING' || f.status === 'PROCESSING')
                )
                
                setStats({
                    totalProjects: projects.length,
                    totalFiles: totalFiles,
                    activeModels: Math.floor(totalFiles * 0.4), // Mocking active models count for now
                    totalSize: totalSize,
                    recentActivity: projects.slice(0, 5), // Using recent projects as activity
                    isProcessing: isProcessing
                })
            } catch (error) {
                console.error("Failed to load dashboard stats", error)
            } finally {
                setLoading(false)
            }
        }
        fetchDashboardData()
    }, [])

    const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
        <Card className="glass-panel border-white/10 relative overflow-hidden group hover:scale-105 transition-transform duration-300">
            <div className={`absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
                <Icon className="w-32 h-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {title}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-white/5 ${color.replace('text-', 'text-')}`}>
                    <Icon className="w-4 h-4" />
                </div>
            </CardHeader>
            <CardContent className="relative z-10">
                <div className="text-3xl font-black text-white mb-1 tracking-tight">{value}</div>
                <p className="text-[10px] font-medium text-gray-500 flex items-center uppercase tracking-wide">
                    <span className="text-green-400 flex items-center mr-1.5 bg-green-400/10 px-1.5 py-0.5 rounded">
                        <ArrowUpRight className="w-3 h-3 mr-1" /> {trend}
                    </span>
                    vs last month
                </p>
            </CardContent>
        </Card>
    )

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-4xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">
                        Welcome back, {user?.name?.split(' ')[0] || 'User'}
                    </h2>
                    <p className="dark:text-gray-400 text-gray-600 mt-2 text-lg">
                        Here's what's happening with your projects today.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/dashboard/projects">
                        <Button className="bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/30">
                            <FolderKanban className="mr-2 h-4 w-4" /> View Projects
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Projects" 
                    value={loading ? "..." : stats.totalProjects} 
                    icon={FolderKanban} 
                    trend="+12%" 
                    color="text-blue-500" 
                />
                <StatCard 
                    title="Total Files" 
                    value={loading ? "..." : stats.totalFiles} 
                    icon={FileText} 
                    trend="+24%" 
                    color="text-purple-500" 
                />
                <StatCard 
                    title="Active Models" 
                    value={loading ? "..." : stats.activeModels} 
                    icon={Box} 
                    trend="+5%" 
                    color="text-orange-500" 
                />
                <StatCard 
                    title="System Status" 
                    value="Operational" 
                    icon={Activity} 
                    trend="99.9%" 
                    color="text-green-500" 
                />
            </div>

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">Recent Projects</h3>
                        <Link href="/dashboard/projects" className="text-sm text-dom-blue hover:text-white transition-colors">
                            View All
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            [1, 2, 3].map(i => <div key={i} className="glass-panel h-20 animate-pulse rounded-xl"></div>)
                        ) : stats.recentActivity.length === 0 ? (
                            <div className="glass-panel p-8 text-center text-gray-500">No recent activity</div>
                        ) : (
                            stats.recentActivity.map((project: any) => (
                                <Link href={`/dashboard/projects/${project.id}`} key={project.id}>
                                    <div className="glass-panel p-4 rounded-xl hover:bg-white/5 transition-all group flex items-center justify-between border border-white/5 hover:border-dom-blue/30">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 group-hover:text-white group-hover:bg-blue-500 transition-all">
                                                <FolderKanban className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white group-hover:text-dom-blue transition-colors">{project.name}</h4>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-xs text-gray-500">Updated {new Date(project.updatedAt).toLocaleDateString()}</p>
                                                    {project.location && (
                                                        <p className="text-[10px] text-gray-400 flex items-center">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-dom-blue/50 mr-1.5"></span>
                                                            {project.location.split(',')[0]}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-xs text-gray-400">Files</div>
                                                <div className="font-mono text-sm text-white">{project._count?.files || 0}</div>
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors" />
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions / System Health */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white">System Health</h3>
                    <Card className="glass-panel border-white/10">
                        <CardContent className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                    <span className="text-sm font-medium text-gray-300">APS Services</span>
                                </div>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                    <span className="text-sm font-medium text-gray-300">Database</span>
                                </div>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`h-2 w-2 rounded-full ${stats.isProcessing ? 'bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'}`}></div>
                                    <span className="text-sm font-medium text-gray-300">Conversion Engine</span>
                                </div>
                                <span className={`text-xs ${stats.isProcessing ? 'text-blue-500 font-semibold' : 'text-yellow-500'}`}>
                                    {stats.isProcessing ? 'Processing...' : 'Idle'}
                                </span>
                            </div>
                            <div className="pt-4 border-t border-white/10">
                                <progress 
                                    value={stats.totalSize} 
                                    max={100 * 1024 * 1024 * 1024}
                                    className="w-full h-2 rounded-full overflow-hidden appearance-none border-none bg-white/5 mb-1 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-dom-blue [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-dom-blue [&::-moz-progress-bar]:rounded-full"
                                />
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>{formatBytes(stats.totalSize)} Used</span>
                                    <span>100 GB Total</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
// End of DashboardPage

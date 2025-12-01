"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import axios from "axios"
import { Plus, Folder, FileText, MoreVertical, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { showError } from "@/lib/error-handler"
import { useUser } from "@/context/UserContext"

interface Project {
    id: string
    name: string
    description: string | null
    createdAt: string
    updatedAt: string
    _count: {
        files: number
    }
}


export default function ProjectsPage() {
    const { user } = useUser()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newProject, setNewProject] = useState({ name: "", description: "" })
    const [creating, setCreating] = useState(false)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("")
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest')

    // Delete State
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
        fetchProjects()
    }, [])

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

    const handleCreateProject = async () => {
        if (!newProject.name.trim()) {
            toast.error("Project name is required")
            return
        }

        setCreating(true)
        try {
            const response = await axios.post(`${API_URL}/api/projects`, newProject)
            setProjects([response.data, ...projects])
            setIsDialogOpen(false)
            setNewProject({ name: "", description: "" })
            toast.success("Project created successfully!")
        } catch (error) {
            showError(error, user?.role, "Failed to create project")
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteProject = async () => {
        if (!projectToDelete) return

        setDeleting(true)
        try {
            await axios.delete(`${API_URL}/api/projects/${projectToDelete}`)
            setProjects(projects.filter(p => p.id !== projectToDelete))
            setIsDeleteDialogOpen(false)
            setProjectToDelete(null)
            toast.success("Project deleted successfully")
        } catch (error) {
            showError(error, user?.role, "Failed to delete project")
        } finally {
            setDeleting(false)
        }
    }

    const confirmDelete = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault() // Prevent navigation
        e.stopPropagation()
        setProjectToDelete(projectId)
        setIsDeleteDialogOpen(true)
    }

    // Filtered & Sorted Projects
    const filteredProjects = projects
        .filter(project =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => {
            if (sortOrder === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            if (sortOrder === 'name') return a.name.localeCompare(b.name)
            return 0
        })

    const toggleSort = () => {
        setSortOrder(current => {
            if (current === 'newest') return 'oldest'
            if (current === 'oldest') return 'name'
            return 'newest'
        })
        toast.info(`Sorting by: ${sortOrder === 'newest' ? 'Oldest' : sortOrder === 'oldest' ? 'Name' : 'Newest'}`)
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-up">
                <div>
                    <h2 className="text-4xl font-bold dark:text-white text-gray-900 tracking-tight text-glow">Projects</h2>
                    <p className="dark:text-gray-400 text-gray-600 mt-2 text-lg">Manage your BIM portfolio.</p>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dom-blue h-4 w-4" />
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 w-64 focus-visible:ring-dom-blue focus-visible:border-dom-blue rounded-xl shadow-sm"
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={toggleSort} className="glass-button rounded-xl" title="Toggle Sort Order">
                        <Filter className={`h-4 w-4 ${sortOrder !== 'newest' ? 'text-dom-blue' : ''}`} />
                    </Button>
                    
                    {isMounted ? (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/30 transition-all hover:scale-105 rounded-xl px-6">
                                    <Plus className="mr-2 h-4 w-4" /> New Project
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="glass-panel border-white/10 text-white sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold">Create New Project</DialogTitle>
                                    <DialogDescription className="text-gray-400">
                                        Add a new BIM project to your workspace.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name" className="text-gray-300">Project Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="Building A - Phase 1"
                                            value={newProject.name}
                                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                            className="bg-white/5 border-white/10 text-white focus-visible:ring-dom-blue"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="description" className="text-gray-300">Description</Label>
                                        <Input
                                            id="description"
                                            placeholder="Project description..."
                                            value={newProject.description}
                                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                            className="bg-white/5 border-white/10 text-white focus-visible:ring-dom-blue"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/10">
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateProject} disabled={creating} className="bg-dom-blue hover:bg-dom-blue-dark text-white">
                                        {creating ? "Creating..." : "Create Project"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    ) : (
                        <Button className="bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/30 transition-all hover:scale-105 rounded-xl px-6">
                            <Plus className="mr-2 h-4 w-4" /> New Project
                        </Button>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="glass-panel border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-red-500">Delete Project</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Are you sure you want to delete this project? This action cannot be undone and all associated files will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-gray-400 hover:text-white hover:bg-white/10">
                            Cancel
                        </Button>
                        <Button onClick={handleDeleteProject} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                            {deleting ? "Deleting..." : "Delete Project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Content Section */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="glass-card h-48 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="glass-panel rounded-3xl p-16 text-center border-dashed border-white/10 animate-fade-in">
                    <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
                        <Folder className="h-10 w-10 text-dom-blue" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                        {searchQuery ? "No projects match your search" : "No projects found"}
                    </h3>
                    <p className="text-gray-400 mb-8 max-w-md mx-auto">
                        {searchQuery ? "Try adjusting your search terms." : "Get started by creating your first project to manage your BIM models."}
                    </p>
                    {!searchQuery && (
                        <Button onClick={() => setIsDialogOpen(true)} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm">
                            <Plus className="mr-2 h-4 w-4" /> Create Project
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project, index) => (
                        <Link href={`/dashboard/projects/${project.id}`} key={project.id}>
                            <div className={`bg-white dark:bg-[#1e2139] border-2 border-gray-300 dark:border-[#2a2f4a] rounded-2xl p-6 h-full group relative overflow-hidden animate-slide-up delay-${Math.min(index * 100, 1000)} shadow-lg hover:shadow-2xl dark:shadow-none transition-all duration-300`}>
                                {/* Hover Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-dom-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-dom-blue/10 dark:bg-dom-blue/20 rounded-xl group-hover:bg-dom-blue group-hover:scale-110 transition-all duration-300 shadow-sm border border-dom-blue/20">
                                            <Folder className="h-6 w-6 text-dom-blue dark:text-dom-blue-light group-hover:text-white transition-colors" />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-white/10 dark:hover:bg-white/5 -mr-2 -mt-2 z-20"
                                            onClick={(e) => confirmDelete(e, project.id)}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-dom-blue dark:group-hover:text-dom-blue-light transition-colors">{project.name}</h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-6 flex-1">
                                        {project.description || "No description provided."}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200 dark:border-[#2a2f4a]">
                                        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                                            <span className="font-medium text-gray-700 dark:text-gray-300">{project._count.files} Files</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2a2f4a] px-2 py-1 rounded-full border border-gray-200 dark:border-[#3a3f5a]">
                                            {new Date(project.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

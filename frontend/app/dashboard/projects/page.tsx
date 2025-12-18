"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import apiClient from "@/lib/axios-config"
import { Plus, Folder, FileText, MoreVertical, Search, Filter, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { showError } from "@/lib/error-handler"
import { useUser } from "@/context/UserContext"

import { AutodeskProjectBrowser } from "@/components/projects/AutodeskProjectBrowser"

interface Project {
    id: string
    name: string
    description: string | null
    clientName: string | null
    location: string | null
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

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("")
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest')

    // Delete State
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    // Autodesk Import State
    const [isAutodeskDialogOpen, setIsAutodeskDialogOpen] = useState(false)
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        setIsMounted(true)
        fetchProjects()
    }, [])

    const fetchProjects = async () => {
        try {
            const response = await apiClient.get('/api/projects')
            setProjects(Array.isArray(response.data) ? response.data : [])
        } catch (error) {
            showError(error, user?.role, "Failed to load projects")
        } finally {
            setLoading(false)
        }
    }

    const handleImportFromAutodesk = async (data: { apsProjectId: string, apsFolderId: string, hubId: string, name: string }) => {
        setImporting(true)
        try {
            await apiClient.post('/api/projects/import-aps', {
                name: data.name,
                apsProjectId: data.apsProjectId,
                apsFolderId: data.apsFolderId,
                hubId: data.hubId,
                clientName: "Autodesk Construction Cloud"
            })

            toast.success("Project linked successfully! Synchronization started.")
            setIsAutodeskDialogOpen(false)
            fetchProjects()
        } catch (error) {
            showError(error, user?.role, "Failed to link project")
        } finally {
            setImporting(false)
        }
    }

    const handleCreateProject = async () => {
        // Client-side validation
        if (!newProject.name.trim()) {
            toast.error("Project name is required")
            return
        }

        if (newProject.name.length < 3) {
            toast.error("Project name must be at least 3 characters")
            return
        }

        if (newProject.name.length > 50) {
            toast.error("Project name must be at most 50 characters")
            return
        }

        setCreating(true)
        try {
            const response = await apiClient.post('/api/projects', newProject)
            setProjects([response.data, ...projects])
            setIsDialogOpen(false)
            setNewProject({ name: "", description: "" })
            toast.success("Project created successfully!")
        } catch (error: any) {
            if (error.response?.data?.details && Array.isArray(error.response.data.details)) {
                error.response.data.details.forEach((err: any) => {
                    toast.error(`${err.path}: ${err.message}`)
                });
            } else {
                showError(error, user?.role, "Failed to create project")
            }
        } finally {
            setCreating(false)
        }
    }

    const handleDeleteProject = async () => {
        if (!projectToDelete) return
        setDeleting(true)
        try {
            await apiClient.delete(`/api/projects/${projectToDelete}`)
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
                    <h2 className="text-4xl font-bold text-foreground tracking-tight animate-in slide-in-from-left-2">Projects</h2>
                    <p className="text-muted-foreground mt-2 text-lg animate-in slide-in-from-left-3 delay-100">Manage your BIM portfolio.</p>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors h-4 w-4" />
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground w-64 focus-visible:ring-primary focus-visible:border-primary rounded-xl shadow-sm transition-all focus:w-72"
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={toggleSort} className="glass-button rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" title="Toggle Sort Order">
                        <Filter className={`h-4 w-4 ${sortOrder !== 'newest' ? 'text-primary' : ''}`} />
                    </Button>

                    {isMounted ? (
                        <>
                            <Dialog open={isAutodeskDialogOpen} onOpenChange={setIsAutodeskDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="glass-button rounded-xl hover:bg-primary/10 hover:text-primary transition-colors mr-2">
                                        <Database className="mr-2 h-4 w-4" /> Link from Autodesk
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-panel border-border text-foreground sm:max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold">Link Autodesk Project</DialogTitle>
                                        <DialogDescription>
                                            Select a project folder from your Autodesk account to synchronize files automatically.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <AutodeskProjectBrowser
                                        onSelect={handleImportFromAutodesk}
                                        onCancel={() => setIsAutodeskDialogOpen(false)}
                                    />
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/30 transition-all hover:scale-105 rounded-xl px-6">
                                        <Plus className="mr-2 h-4 w-4" /> New Project
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-panel border-border text-foreground sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold">Create New Project</DialogTitle>
                                        <DialogDescription className="text-muted-foreground">
                                            Add a new BIM project to your workspace.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name" className="text-foreground">Project Name</Label>
                                            <Input
                                                id="name"
                                                placeholder="Building A - Phase 1"
                                                value={newProject.name}
                                                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                                className="bg-card border-border text-foreground focus-visible:ring-dom-blue"
                                                minLength={3}
                                                maxLength={50}
                                            />
                                            <p className="text-xs text-muted-foreground text-right">{newProject.name.length}/50</p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="description" className="text-foreground">Description</Label>
                                            <Input
                                                id="description"
                                                placeholder="Project description..."
                                                value={newProject.description}
                                                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                                className="bg-card border-border text-foreground focus-visible:ring-dom-blue"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
                                            Cancel
                                        </Button>
                                        <Button onClick={handleCreateProject} disabled={creating} className="bg-dom-blue hover:bg-dom-blue-dark text-white">
                                            {creating ? "Creating..." : "Create Project"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    ) : (
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 rounded-xl px-6">
                            <Plus className="mr-2 h-4 w-4" /> New Project
                        </Button>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="glass-panel border-border text-foreground sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-red-500">Delete Project</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Are you sure you want to delete this project? This action cannot be undone and all associated files will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-muted-foreground hover:text-foreground hover:bg-secondary">
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
                <div className="glass-panel rounded-3xl p-16 text-center border-dashed border-border animate-fade-in">
                    <div className="bg-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
                        <Folder className="h-10 w-10 text-dom-blue" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                        {searchQuery ? "No projects match your search" : "No projects found"}
                    </h3>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        {searchQuery ? "Try adjusting your search terms." : "Get started by creating your first project to manage your BIM models."}
                    </p>
                    {!searchQuery && (
                        <Button onClick={() => setIsDialogOpen(true)} className="bg-secondary hover:bg-secondary/80 text-foreground border border-border backdrop-blur-sm">
                            <Plus className="mr-2 h-4 w-4" /> Create Project
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project, index) => (
                        <Link href={`/dashboard/projects/${project.id}`} key={project.id}>
                            <div className={`glass-card rounded-2xl p-6 h-full group relative overflow-hidden animate-slide-up delay-${Math.min(index * 100, 1000)} hover:scale-[1.02] transition-all duration-300`}>
                                {/* Hover Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:scale-110 transition-all duration-300 shadow-sm border border-primary/20">
                                            <Folder className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-red-400 hover:bg-secondary -mr-2 -mt-2 z-20"
                                            onClick={(e) => confirmDelete(e, project.id)}
                                            aria-label="Delete project"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{project.name}</h3>

                                    {(project.clientName || project.location) && (
                                        <div className="flex flex-col gap-1 mb-3 text-xs text-muted-foreground">
                                            {project.clientName && (
                                                <div className="flex items-center">
                                                    <span className="font-semibold mr-1">Client:</span> {project.clientName}
                                                </div>
                                            )}
                                            {project.location && (
                                                <div className="flex items-center">
                                                    <span className="font-semibold mr-1">Loc:</span> <span className="truncate max-w-[200px]">{project.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">
                                        {project.description || "No description provided."}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t-2 border-border">
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                                            <span className="font-medium text-foreground">{project._count.files} Files</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full border border-border">
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

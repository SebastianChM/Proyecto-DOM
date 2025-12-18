"use client"

import { useState, useEffect } from "react"
import apiClient from "@/lib/axios-config"
import { Folder, Database, ChevronRight, Check, File, FileText, ArrowLeft, RefreshCw, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

interface BrowserProps {
    onSelect: (data: { apsProjectId: string, apsFolderId: string, hubId: string, name: string }) => void;
    onCancel: () => void;
}

export function AutodeskProjectBrowser({ onSelect, onCancel }: BrowserProps) {
    const [step, setStep] = useState<'hubs' | 'projects' | 'browser'>('hubs')
    const [loading, setLoading] = useState(false)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Data States
    const [hubs, setHubs] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])

    // Browser State
    const [folders, setFolders] = useState<any[]>([]) // Current level folders
    const [files, setFiles] = useState<any[]>([]) // Current level files

    // Selection States
    const [selectedHub, setSelectedHub] = useState<any>(null)
    const [selectedProject, setSelectedProject] = useState<any>(null)
    const [selectedFolder, setSelectedFolder] = useState<any>(null) // The target folder to link

    // Navigation Path (Stack of folder IDs/Names)
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
    const [path, setPath] = useState<{ id: string, name: string }[]>([])

    // Load Hubs on mount
    useEffect(() => {
        loadHubs()
    }, [])

    const loadHubs = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await apiClient.get('/api/aps/hubs')
            setHubs(res.data)
        } catch (error: any) {
            console.error("Failed to load hubs", error)
            /* 
               If the backend returns 401 (Unauthorized), it means the session text is missing or invalid.
               We check for this specific status to give a helpful hint.
            */
            if (error.response?.status === 401) {
                setError("Authentication required. Please login to Autodesk.")
            } else {
                setError("Failed to load hubs. Please try again.")
            }
            toast.error("Could not load Autodesk Hubs")
        } finally {
            setLoading(false)
        }
    }

    const loadProjects = async (hubId: string) => {
        setLoading(true)
        try {
            const res = await apiClient.get(`/api/aps/hubs/${hubId}/projects`)
            setProjects(res.data)
            setStep('projects')
        } catch (error) {
            toast.error("Failed to load projects")
        } finally {
            setLoading(false)
        }
    }

    const loadTopFolders = async (hubId: string, projectId: string) => {
        setLoading(true)
        try {
            const res = await apiClient.get(`/api/aps/hubs/${hubId}/projects/${projectId}/topFolders`)
            setFolders(res.data)
            setFiles([]) // Top folders usually don't have files directly visible or mixed
            setCurrentFolderId(null) // Root
            setStep('browser')
        } catch (error) {
            toast.error("Failed to load folders")
        } finally {
            setLoading(false)
        }
    }

    const loadFolderContents = async (projectId: string, folderId: string) => {
        setPreviewLoading(true)
        try {
            const res = await apiClient.get(`/api/aps/projects/${projectId}/folders/${folderId}/contents`)

            // Separate folders and files
            const rawContents = res.data;
            const newFolders = rawContents.filter((item: any) => item.type === 'folders');
            const newFiles = rawContents.filter((item: any) => item.type === 'items');

            setFolders(newFolders);
            setFiles(newFiles);
        } catch (error) {
            toast.error("Failed to load contents")
        } finally {
            setPreviewLoading(false)
        }
    }

    const handleHubClick = (hub: any) => {
        setSelectedHub(hub)
        setPath([{ id: 'hub', name: hub.name }])
        loadProjects(hub.id)
    }

    const handleProjectClick = (project: any) => {
        setSelectedProject(project)
        setPath(prev => [...prev, { id: 'project', name: project.name }])
        loadTopFolders(selectedHub.id, project.id)
    }

    // Entering a folder (Drill down)
    const handleFolderEnter = (folder: any) => {
        setCurrentFolderId(folder.id)
        setPath(prev => [...prev, { id: folder.id, name: folder.name }])
        // Sync selection with navigation
        setSelectedFolder(folder)
        loadFolderContents(selectedProject.id, folder.id)
    }

    const handleBack = () => {
        if (step === 'projects') {
            setStep('hubs');
            setSelectedHub(null);
            setPath([]);
            return;
        }
        if (step === 'browser') {
            if (path.length <= 2) { // Hub -> Project -> [Root]
                setStep('projects');
                setSelectedProject(null);
                setPath(prev => prev.slice(0, 1));
                return;
            }

            // Go up one level
            const newPath = path.slice(0, -1);
            setPath(newPath);

            const parent = newPath[newPath.length - 1];
            if (parent.id === 'project') {
                // Back at root
                setCurrentFolderId(null);
                loadTopFolders(selectedHub.id, selectedProject.id);
            } else {
                setCurrentFolderId(parent.id);
                loadFolderContents(selectedProject.id, parent.id);
                setSelectedFolder(null);
            }
        }
    }

    const handleConfirm = () => {
        if (!selectedFolder || !selectedProject || !selectedHub) return;

        onSelect({
            apsProjectId: selectedProject.id,
            apsFolderId: selectedFolder.id,
            hubId: selectedHub.id,
            name: selectedFolder.name
        })
    }

    return (
        <div className="flex flex-col h-[500px]">
            {/* Header / Breadcrumb */}
            <div className="flex items-center justify-between mb-4 p-3 bg-secondary/50 rounded-xl border border-border">
                <div className="flex items-center overflow-hidden">
                    {(step !== 'hubs') && (
                        <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2 h-6 w-6">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <div className="flex items-center text-sm">
                        <Database className="w-4 h-4 mr-2 text-dom-blue" />
                        {path.map((p, i) => (
                            <div key={i} className="flex items-center whitespace-nowrap">
                                {i > 0 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />}
                                <span className={`truncate max-w-[150px] ${i === path.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                                    {p.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Split Pane Content */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* LEFT PANE: Navigation / Folders */}
                <div className="w-1/2 flex flex-col">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">
                        {step === 'hubs' ? 'Select Hub' : step === 'projects' ? 'Select Project' : 'Browse Folders'}
                    </h3>
                    <ScrollArea className="flex-1 border border-border rounded-xl bg-card/50">
                        <div className="p-2 space-y-1">
                            {loading ? (
                                <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
                            ) : (
                                <>
                                    {step === 'hubs' && hubs.map(hub => (
                                        <div key={hub.id} onClick={() => handleHubClick(hub)}
                                            className="p-3 hover:bg-primary/10 rounded-lg cursor-pointer flex items-center group transition-all">
                                            <Database className="w-4 h-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span className="font-medium text-sm">{hub.name}</span>
                                            <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))}

                                    {/* Empty/Error State for Hubs */}
                                    {step === 'hubs' && hubs.length === 0 && !loading && (
                                        <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                                            <p className="text-muted-foreground mb-4 font-medium">
                                                {error || "No Autodesk Hubs found."}
                                            </p>
                                            <Button variant="outline" size="sm" onClick={loadHubs} className="min-w-[100px]">
                                                <RefreshCw className="w-4 h-4 mr-2" /> Retry
                                            </Button>

                                            {/* Show tip if error is Auth related OR if no hubs found (might need switch account) */}
                                            {(!error || (error && error.includes("Authentication"))) && (
                                                <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                                                    <p className="text-xs text-muted-foreground">
                                                        Tip: Ensure you have access to a Hub. Try using the User Menu (top right) to <b>Switch Account</b> (Logout) and Login again.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {step === 'projects' && projects.map(proj => (
                                        <div key={proj.id} onClick={() => handleProjectClick(proj)}
                                            className="p-3 hover:bg-primary/10 rounded-lg cursor-pointer flex items-center group transition-all">
                                            <Folder className="w-4 h-4 mr-3 text-yellow-500" />
                                            <span className="font-medium text-sm truncate">{proj.name}</span>
                                            <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))}

                                    {step === 'browser' && folders.map(folder => (
                                        <div key={folder.id}
                                            onClick={() => handleFolderEnter(folder)}
                                            className={`p-3 rounded-lg cursor-pointer flex items-center group transition-all ${selectedFolder?.id === folder.id ? 'bg-primary/10 border-primary/20' : 'hover:bg-secondary'}`}>
                                            <Folder className={`w-4 h-4 mr-3 ${selectedFolder?.id === folder.id ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
                                            <span className="font-medium text-sm truncate flex-1">{folder.name}</span>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    ))}

                                    {step === 'browser' && folders.length === 0 && (
                                        <div className="text-center p-4 text-muted-foreground text-sm italic">
                                            No subfolders
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* RIGHT PANE: File Preview */}
                <div className="w-1/2 flex flex-col">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1 flex items-center justify-between">
                        <span>Folder Contents</span>
                        {selectedFolder && <span className="text-primary truncate max-w-[150px] ml-2">{selectedFolder.name}</span>}
                    </h3>
                    <ScrollArea className="flex-1 border border-border rounded-xl bg-card">
                        <div className="p-2 space-y-1">
                            {previewLoading ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <span className="text-xs">Loading files...</span>
                                </div>
                            ) : step !== 'browser' ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                                    <Eye className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-sm">Select a project to browse files</span>
                                </div>
                            ) : !selectedFolder ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                                    <Folder className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-sm">Select a folder to view contents</span>
                                </div>
                            ) : files.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                                    <File className="w-8 h-8 mb-2 opacity-50" />
                                    <span className="text-sm">No files in this folder</span>
                                </div>
                            ) : (
                                files.map((file: any) => (
                                    <div key={file.id} className="p-2.5 rounded-lg border border-border/50 bg-secondary/20 flex items-center text-sm">
                                        <FileText className="w-4 h-4 mr-3 text-blue-400" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate">{file.name}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {file.lastModified ? new Date(file.lastModified).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Footer Action */}
            <div className="mt-4 flex justify-between items-center pt-2 border-t border-border">
                <div className="flex items-center text-xs text-muted-foreground">
                    {selectedFolder && (
                        <span>
                            Ready to link: <span className="font-bold text-foreground">{selectedFolder.name}</span>
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!selectedFolder} className="bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/20">
                        Link Selected Folder
                    </Button>
                </div>
            </div>
        </div>
    )
}

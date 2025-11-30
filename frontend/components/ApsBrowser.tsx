"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Folder, FileText, ChevronRight, ArrowLeft, Loader2, Database } from "lucide-react"
import axios from "axios"
import { toast } from "sonner"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

interface ApsBrowserProps {
    isOpen: boolean
    onClose: () => void
    onImport: (file: Record<string, unknown>) => void
    projectId: string
}

interface ApsAttributes {
    name?: string
    displayName?: string
    [key: string]: unknown
}

interface ApsRelationships {
    tip?: {
        data?: {
            id?: string
        }
    }
    [key: string]: unknown
}

interface ApsItem {
    id: string
    type: 'hubs' | 'projects' | 'folders' | 'items' | 'versions'
    name: string
    attributes?: ApsAttributes
    relationships?: ApsRelationships
}

export function ApsBrowser({ isOpen, onClose, onImport }: ApsBrowserProps) {
    const { user } = useUser()
    const [view, setView] = useState<'hubs' | 'projects' | 'folders'>('hubs')
    const [items, setItems] = useState<ApsItem[]>([])
    const [loading, setLoading] = useState(false)
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, name: string, type: string }[]>([])

    // Selection state
    const [selectedHub, setSelectedHub] = useState<string | null>(null)
    const [selectedProject, setSelectedProject] = useState<string | null>(null)
    // const [selectedFolder, setSelectedFolder] = useState<string | null>(null) // Unused
    const [selectedFile, setSelectedFile] = useState<ApsItem | null>(null)

    const fetchHubs = useCallback(async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/aps/hubs`, { withCredentials: true })
            setItems(res.data.map((hub: { id: string, attributes: ApsAttributes }) => ({
                id: hub.id,
                type: 'hubs',
                name: hub.attributes.name || 'Unknown Hub',
                attributes: hub.attributes
            })))
            setBreadcrumbs([{ id: 'root', name: 'Hubs', type: 'hubs' }])
        } catch (error) {
            showError(error, user?.role, "Failed to load Autodesk Hubs. Please ensure you are logged in.")
        } finally {
            setLoading(false)
        }
    }, [user?.role])

    useEffect(() => {
        if (isOpen && view === 'hubs') {
            fetchHubs()
        }
    }, [isOpen, view, fetchHubs])

    const fetchProjects = async (hubId: string) => {
        setLoading(true)
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/aps/hubs/${hubId}/projects`, { withCredentials: true })
            setItems(res.data.map((proj: { id: string, attributes: ApsAttributes }) => ({
                id: proj.id,
                type: 'projects',
                name: proj.attributes.name || 'Unknown Project',
                attributes: proj.attributes
            })))
            setView('projects')
        } catch (error) {
            showError(error, user?.role, "Failed to load projects.")
        } finally {
            setLoading(false)
        }
    }

    const fetchTopFolders = async (hubId: string, apsProjectId: string) => {
        setLoading(true)
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/aps/hubs/${hubId}/projects/${apsProjectId}/topFolders`, { withCredentials: true })
            // Usually returns "Project Files" folder
            setItems(res.data.map((folder: { id: string, attributes: ApsAttributes }) => ({
                id: folder.id,
                type: 'folders',
                name: folder.attributes.displayName || folder.attributes.name || 'Unknown Folder',
                attributes: folder.attributes
            })))
            setView('folders')
        } catch (error) {
            showError(error, user?.role, "Failed to load folders.")
        } finally {
            setLoading(false)
        }
    }

    const fetchFolderContents = async (apsProjectId: string, folderId: string) => {
        setLoading(true)
        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/aps/projects/${apsProjectId}/folders/${folderId}/contents`, { withCredentials: true })
            setItems(res.data.map((item: { id: string, type: 'folders' | 'items', attributes: ApsAttributes, relationships: ApsRelationships }) => ({
                id: item.id,
                type: item.type, // 'folders' or 'items'
                name: item.attributes.displayName || item.attributes.name || 'Unknown Item',
                attributes: item.attributes,
                relationships: item.relationships
            })))
            setView('folders')
        } catch (error) {
            showError(error, user?.role, "Failed to load folder contents.")
        } finally {
            setLoading(false)
        }
    }

    const handleItemClick = (item: ApsItem) => {
        if (item.type === 'hubs') {
            setSelectedHub(item.id)
            setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.name, type: 'hubs' }])
            fetchProjects(item.id)
        } else if (item.type === 'projects') {
            setSelectedProject(item.id)
            setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.name, type: 'projects' }])
            if (selectedHub) fetchTopFolders(selectedHub, item.id)
        } else if (item.type === 'folders') {
            // setSelectedFolder(item.id)
            setBreadcrumbs([...breadcrumbs, { id: item.id, name: item.name, type: 'folders' }])
            if (selectedProject) fetchFolderContents(selectedProject, item.id)
        } else if (item.type === 'items') {
            // It's a file (item), select it
            setSelectedFile(item)
        }
    }

    const handleBack = () => {
        if (breadcrumbs.length <= 1) return

        const newBreadcrumbs = [...breadcrumbs]
        newBreadcrumbs.pop()
        const previous = newBreadcrumbs[newBreadcrumbs.length - 1]
        setBreadcrumbs(newBreadcrumbs)
        setSelectedFile(null)

        if (previous.type === 'hubs' && previous.id === 'root') {
            setView('hubs')
            fetchHubs()
            setSelectedHub(null)
        } else if (previous.type === 'hubs') {
            setView('projects')
            fetchProjects(previous.id)
            setSelectedProject(null)
        } else if (previous.type === 'projects') {
            setView('folders')
            if (selectedHub && selectedProject) fetchTopFolders(selectedHub, selectedProject)
        } else if (previous.type === 'folders') {
            // Go back to parent folder... this logic is tricky without keeping track of parent IDs
            // For simplicity, let's just reload the previous folder in the breadcrumb
            if (selectedProject) fetchFolderContents(selectedProject, previous.id)
        }
    }

    const handleImport = async () => {
        if (!selectedFile || !selectedProject) return

        setLoading(true)
        try {
            // Try to get the tip version ID (latest version)
            const tipVersionId = selectedFile.relationships?.tip?.data?.id
            const idToUse = tipVersionId || selectedFile.id

            await onImport({
                name: selectedFile.name,
                urn: Buffer.from(idToUse).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
                apsProjectId: selectedProject,
                apsFileId: selectedFile.id
            })
            onClose()
        } catch (error) {
            showError(error, user?.role, "Failed to import file")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="glass-panel border-white/10 text-white sm:max-w-2xl h-[600px] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Database className="h-5 w-5 text-dom-blue" />
                        Browse Autodesk Projects
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Select a file from your Autodesk Construction Cloud or BIM 360 projects.
                    </DialogDescription>
                </DialogHeader>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-gray-400 pb-2 border-b border-white/10 overflow-x-auto whitespace-nowrap">
                    {breadcrumbs.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={handleBack}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    )}
                    {breadcrumbs.map((crumb, index) => (
                        <div key={crumb.id} className="flex items-center">
                            {index > 0 && <ChevronRight className="h-4 w-4 mx-1 opacity-50" />}
                            <span className={index === breadcrumbs.length - 1 ? "text-white font-medium" : ""}>
                                {crumb.name}
                            </span>
                        </div>
                    ))}
                </div>

                <ScrollArea className="flex-1 pr-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-dom-blue" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 mt-2">
                            {items.length === 0 && (
                                <div className="text-center text-gray-500 py-10">No items found</div>
                            )}
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className={`
                                        flex items-center p-3 rounded-lg cursor-pointer transition-all border border-transparent
                                        ${selectedFile?.id === item.id
                                            ? 'bg-dom-blue/20 border-dom-blue/50'
                                            : 'hover:bg-white/5 hover:border-white/10'}
                                    `}
                                >
                                    <div className="p-2 bg-white/5 rounded-md mr-3">
                                        {item.type === 'hubs' && <Database className="h-5 w-5 text-purple-400" />}
                                        {item.type === 'projects' && <Folder className="h-5 w-5 text-yellow-400" />}
                                        {item.type === 'folders' && <Folder className="h-5 w-5 text-blue-400" />}
                                        {item.type === 'items' && <FileText className="h-5 w-5 text-green-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 capitalize">{item.type.slice(0, -1)}</p>
                                    </div>
                                    {item.type !== 'items' && <ChevronRight className="h-4 w-4 text-gray-600" />}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="mt-4 pt-4 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={!selectedFile || loading}
                        className="bg-dom-blue hover:bg-dom-blue-dark text-white"
                    >
                        {loading ? "Importing..." : "Import Selected File"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

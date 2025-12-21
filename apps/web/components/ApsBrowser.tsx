"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Folder,
  FileText,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Database,
  HardDrive,
  Building,
} from "lucide-react";
import apiClient from "@/lib/axios-config";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ApsBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: Record<string, unknown>) => void;
  projectId?: string; // Optional
}

interface Item {
  id: string;
  name: string;
  type: "hubs" | "projects" | "folders" | "items";
  lastModified?: string;
  versionId?: string;
  rootFolderId?: string;
  [key: string]: unknown;
}

type BrowserView = "HUBS" | "PROJECTS" | "FOLDERS";

export function ApsBrowser({ isOpen, onClose, onImport }: ApsBrowserProps) {
  const [view, setView] = useState<BrowserView>("HUBS");
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  // Data state
  const [items, setItems] = useState<Item[]>([]);

  // Navigation state
  // Navigation state

  const [currentProject, setCurrentProject] = useState<Item | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Item[]>([]);
  const [selectedFile, setSelectedFile] = useState<Item | null>(null);

  // Fetch Hubs on open
  useEffect(() => {
    if (isOpen) {
      fetchHubs();
      setSelectedFile(null);
      setView("HUBS");
      setBreadcrumbs([]);
      setBreadcrumbs([]);
      setCurrentProject(null);
      setNeedsLogin(false);
    }
  }, [isOpen]);

  const fetchHubs = async () => {
    setLoading(true);
    setNeedsLogin(false);
    try {
      const { data } = await apiClient.get("/api/aps/hubs");
      setItems(
        data.map((h: Record<string, unknown>) => ({
          ...h,
          type: "hubs",
        })) as Item[],
      );
      setView("HUBS");
    } catch (error: unknown) {
      const err = error as { response?: { status: number } };
      if (err.response && err.response.status === 401) {
        setNeedsLogin(true);
      } else {
        toast.error("Failed to load Hubs");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async (hubId: string) => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/api/aps/hubs/${hubId}/projects`);
      setItems(
        data.map((p: Record<string, unknown>) => ({
          ...p,
          type: "projects",
        })) as Item[],
      );
      setView("PROJECTS");
    } catch (error) {
      toast.error("Failed to load Projects");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderContents = async (projectId: string, folderId: string) => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(
        `/api/aps/projects/${projectId}/folders/${folderId}`,
      );
      setItems(data); // Already has correct structure from Proxy
      setView("FOLDERS");
    } catch (error) {
      toast.error("Failed to load Folder contents");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleHubClick = (hub: Item) => {
    setBreadcrumbs([{ ...hub, type: "hubs" }]);
    fetchProjects(hub.id);
  };

  const handleProjectClick = (project: Item) => {
    setCurrentProject(project);
    // Root folder logic
    if (!project.rootFolderId) {
      toast.error("Project has no root folder");
      return;
    }

    // Add project to breadcrumbs
    setBreadcrumbs((prev) => [...prev, { ...project, type: "projects" }]);

    fetchFolderContents(project.id, project.rootFolderId);
  };

  const handleItemClick = (item: Item) => {
    if (item.type === "folders") {
      setBreadcrumbs((prev) => [...prev, item]);
      fetchFolderContents(currentProject!.id, item.id);
      setSelectedFile(null);
    } else if (item.type === "items") {
      setSelectedFile(item);
    }
  };

  const handleBack = () => {
    if (breadcrumbs.length === 0) return;

    const newBreadcrumbs = [...breadcrumbs];
    newBreadcrumbs.pop();
    setBreadcrumbs(newBreadcrumbs);
    setSelectedFile(null);

    const prev = newBreadcrumbs[newBreadcrumbs.length - 1];

    if (!prev) {
      // Back to Hubs
      fetchHubs();
      setCurrentProject(null);
      return;
    }

    if (prev.type === "hubs") {
      // Back to Projects
      setCurrentProject(null);
      fetchProjects(prev.id);
    } else if (prev.type === "projects") {
      // Back to Root Folder
      fetchFolderContents(prev.id, prev.rootFolderId!);
    } else if (prev.type === "folders") {
      // Back to parent folder
      fetchFolderContents(currentProject!.id, prev.id);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !currentProject) return;

    const fileData = {
      name: selectedFile.name,
      apsFileId: selectedFile.versionId || selectedFile.id,
      apsProjectId: currentProject.id,
    };

    onImport(fileData);
    onClose();
  };

  const handleConnect = () => {
    // Redirect to backend auth login
    window.location.href = "/api/auth/login";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-panel border-white/10 text-white sm:max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5 text-dom-blue" />
            Browse Autodesk Projects
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Select a file from your Autodesk Construction Cloud or BIM 360
            projects.
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-gray-400 pb-2 border-b border-white/10 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {view !== "HUBS" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mr-1"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 opacity-50" />
              )}
              <span
                className={cn(
                  "max-w-[150px] truncate",
                  index === breadcrumbs.length - 1
                    ? "text-white font-medium"
                    : "",
                )}
              >
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
          ) : needsLogin ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center p-8">
              <div className="p-4 rounded-full bg-white/5">
                <Building className="h-12 w-12 text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  Connect your Autodesk Account
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                  To browse your projects, you need to authorize this
                  application to access your Autodesk Construction Cloud data.
                </p>
              </div>
              <Button
                onClick={handleConnect}
                className="bg-dom-blue hover:bg-dom-blue-dark"
              >
                Connect with Autodesk
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 mt-2">
              {items.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                  {view === "FOLDERS" ? "Empty folder" : "No items found"}
                </div>
              )}

              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.type === "hubs") handleHubClick(item);
                    else if (item.type === "projects") handleProjectClick(item);
                    else handleItemClick(item);
                  }}
                  className={cn(
                    "flex items-center p-3 rounded-lg cursor-pointer transition-all border border-transparent",
                    selectedFile?.id === item.id
                      ? "bg-dom-blue/20 border-dom-blue/50"
                      : "hover:bg-white/5 hover:border-white/10",
                  )}
                >
                  <div className="p-2 bg-white/5 rounded-md mr-3">
                    {item.type === "hubs" && (
                      <HardDrive className="h-5 w-5 text-purple-400" />
                    )}
                    {item.type === "projects" && (
                      <Building className="h-5 w-5 text-yellow-400" />
                    )}
                    {item.type === "folders" && (
                      <Folder className="h-5 w-5 text-blue-400" />
                    )}
                    {item.type === "items" && (
                      <FileText className="h-5 w-5 text-green-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {item.lastModified
                        ? new Date(item.lastModified).toLocaleDateString()
                        : item.type}
                    </p>
                  </div>
                  {item.type !== "items" && (
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4 pt-4 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={!selectedFile || loading}
            className="bg-dom-blue hover:bg-dom-blue-dark text-white"
          >
            {loading ? "Importing..." : "Link Selected File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

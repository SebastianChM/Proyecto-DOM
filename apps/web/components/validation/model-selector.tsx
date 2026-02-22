"use client";

import { useState, useEffect } from "react";
import {
  Check,
  ChevronsUpDown,
  Search,
  Folder,
  Box,
  AlertTriangle,
} from "lucide-react"; // Removed FileCode
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import apiClient from "@/lib/axios-config";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";

interface ModelSelectorProps {
  onModelSelect: (urn: string, name: string, projectId?: string) => void;
}

interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
}

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  apsUrn: string | null;
  status: string;
}

export function ModelSelector({ onModelSelect }: ModelSelectorProps) {
  const [openProject, setOpenProject] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  // Removed unused loading state
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      setNeedsLogin(false);
      try {
        // Fetch projects with their files to avoid waterfall requests
        const res = await apiClient.get("/api/projects");
        setProjects(Array.isArray(res.data) ? res.data : []);
      } catch (error: unknown) {
        const axiosErr = error as { response?: { status?: number } };
        if (axiosErr.response?.status === 401) {
          // Suppress console error for expected 401s
          setNeedsLogin(true);
          setProjects([]);
        } else {
          logger.error("Failed to fetch projects", {
            error: (error as Error)?.message,
          });
          toast.error("Failed to load projects");
        }
      }
    };
    fetchProjects();
  }, []);

  // When a project is selected, we might need to fetch its files if they aren't included in the list
  const handleSelectProject = async (project: Project) => {
    setSelectedProject(project);
    setOpenProject(false);
    setSelectedFileId(""); // Reset file selection

    // If files are not populated (depending on API), we might need to fetch them here
    if (!project.files) {
      try {
        const res = await apiClient.get(`/api/projects/${project.id}`);
        setSelectedProject(res.data);
      } catch {
        toast.error("Failed to load project files");
      }
    }
  };

  const handleSelectFile = (file: ProjectFile) => {
    if (!file.apsUrn) {
      toast.error("This file has not been processed by Autodesk (No URN).");
      return;
    }
    setSelectedFileId(file.id);
    onModelSelect(file.apsUrn, file.name, selectedProject?.id);
  };

  const compatibleFiles =
    selectedProject?.files?.filter(
      (f) =>
        f.apsUrn && ["rvt", "dwg", "nwc", "ifc"].includes(f.type.toLowerCase()),
    ) || [];

  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Project Selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted-foreground">
          1. Select Project
        </span>
        <Popover open={openProject} onOpenChange={setOpenProject}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openProject}
              className={cn(
                "w-full justify-between",
                needsLogin && "border-yellow-500 text-yellow-600 bg-yellow-50",
              )}
            >
              {needsLogin ? (
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Auth Required - Click to Login
                </span>
              ) : selectedProject ? (
                <div className="flex items-center gap-2 truncate">
                  <Folder className="h-4 w-4 text-blue-500" />
                  {selectedProject.name}
                </div>
              ) : (
                "Select a project..."
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-2" align="start">
            {needsLogin ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-50" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Authentication Required</p>
                  <p className="text-xs text-muted-foreground">
                    Please sign in to access your projects.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    (window.location.href = "/api/auth/login?prompt=login")
                  }
                >
                  Sign in with Autodesk
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center border-b px-3 pb-2 mb-2">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    className="flex h-6 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[200px]">
                  {filteredProjects.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No project found.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredProjects.map((project) => (
                        <div
                          key={project.id}
                          onClick={() => handleSelectProject(project)}
                          className={cn(
                            "flex items-center rounded-sm px-2 py-1.5 text-sm outline-none cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground",
                            selectedProject?.id === project.id && "bg-accent",
                          )}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProject?.id === project.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {project.name}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* File Selector (Only visible if project selected) */}
      {selectedProject && (
        <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2">
          <span className="text-sm font-medium text-muted-foreground">
            2. Select Model
          </span>
          <ScrollArea className="h-[200px] rounded-md border p-2">
            {compatibleFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Box className="h-8 w-8 opacity-20" />
                <p className="text-xs text-center">
                  No compatible 3D models (RVT/DWG/NWC)
                  <br />
                  found in this project.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {compatibleFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleSelectFile(file)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors",
                      selectedFileId === file.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Box className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    {selectedFileId === file.id && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] bg-primary/20 text-primary border-transparent"
                      >
                        Selected
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <p className="text-[10px] text-muted-foreground text-right">
            Showing only processed models with URN.
          </p>
        </div>
      )}
    </div>
  );
}

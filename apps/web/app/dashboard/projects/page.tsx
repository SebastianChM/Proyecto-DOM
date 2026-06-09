"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { projectsService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/types";
import {
  Plus,
  Folder,
  FileText,
  MoreVertical,
  Search,
  Filter,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { showError } from "@/lib/error-handler";
import { useUser } from "@/context/UserContext";

import { AutodeskProjectBrowser } from "@/components/projects/AutodeskProjectBrowser";

interface Project {
  id: string;
  name: string;
  description?: string | null;
  clientName?: string | null;
  location?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files?: number;
    members?: number;
  };
}

function ProjectsPageContent() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Search & Filter State (server-side)
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "name">(
    "newest",
  );

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 18; // 6 per row x 3 rows

  // Delete State
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Autodesk Import State
  const [isAutodeskDialogOpen, setIsAutodeskDialogOpen] = useState(false);

  const fetchProjects = useCallback(
    async (pg?: number, q?: string, sort?: string) => {
      try {
        setLoading(true);
        const currentPage = pg ?? page;
        const currentSearch = q ?? searchQuery;
        const currentSort = sort ?? sortOrder;

        const sortBy = currentSort === "name" ? "name" : "updatedAt";
        const sortOrd =
          currentSort === "oldest"
            ? "asc"
            : currentSort === "name"
              ? "asc"
              : "desc";

        const result = await projectsService.list({
          page: currentPage,
          pageSize,
          search: currentSearch || undefined,
          sortBy,
          sortOrder: sortOrd,
        });

        setProjects(result.data);
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      } catch (error) {
        showError(error, user?.role, "Failed to load projects");
      } finally {
        setLoading(false);
      }
    },
    [page, searchQuery, sortOrder, user?.role],
  );

  useEffect(() => {
    setIsMounted(true);
    void fetchProjects(1);
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the new-project dialog when the dashboard navigates here with ?new=true
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setIsDialogOpen(true);
      // Remove the query param without triggering a full navigation
      router.replace("/dashboard/projects");
    }
  }, [searchParams, router]);

  // Debounced search — always passes current values to avoid stale closure
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void fetchProjects(1, searchQuery, sortOrder);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, sortOrder, fetchProjects]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void fetchProjects(newPage);
  };

  const handleImportFromAutodesk = async (data: {
    apsProjectId: string;
    apsFolderId: string;
    hubId: string;
    name: string;
  }) => {
    try {
      await projectsService.importAps({
        name: data.name,
        apsProjectId: data.apsProjectId,
        apsFolderId: data.apsFolderId,
        hubId: data.hubId,
        clientName: "Autodesk Construction Cloud",
      });

      toast.success("Project linked successfully! Synchronization started.");
      setIsAutodeskDialogOpen(false);
      void fetchProjects(1);
    } catch (error) {
      showError(error, user?.role, "Failed to link project");
    }
  };

  const handleCreateProject = async () => {
    // Client-side validation
    if (!newProject.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    if (newProject.name.length < 3) {
      toast.error("Project name must be at least 3 characters");
      return;
    }

    if (newProject.name.length > 50) {
      toast.error("Project name must be at most 50 characters");
      return;
    }

    setCreating(true);
    try {
      const created = await projectsService.create(newProject);
      setProjects([created, ...projects]);
      setIsDialogOpen(false);
      setNewProject({ name: "", description: "" });
      toast.success("Project created successfully!");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.body?.details &&
        Array.isArray(error.body.details)
      ) {
        (
          error.body.details as Array<{ path: string; message: string }>
        ).forEach((err) => {
          toast.error(`${err.path}: ${err.message}`);
        });
      } else {
        showError(error, user?.role, "Failed to create project");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await projectsService.delete(projectToDelete);
      setProjects(projects.filter((p) => p.id !== projectToDelete));
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
      toast.success("Project deleted successfully");
    } catch (error) {
      showError(error, user?.role, "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    setProjectToDelete(projectId);
    setIsDeleteDialogOpen(true);
  };

  const toggleSort = () => {
    const next =
      sortOrder === "newest"
        ? "oldest"
        : sortOrder === "oldest"
          ? "name"
          : "newest";
    setSortOrder(next);
    setPage(1);
    fetchProjects(1, searchQuery, next);
    toast.info(
      `Sorting by: ${next === "newest" ? "Newest" : next === "oldest" ? "Oldest" : "Name"}`,
    );
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Projects
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage your BIM portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 w-56 text-sm rounded-md"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleSort}
            className="h-9 w-9 rounded-md"
            title="Toggle Sort Order"
          >
            <Filter
              className={`h-3.5 w-3.5 ${sortOrder !== "newest" ? "text-primary" : ""}`}
            />
          </Button>

          {isMounted ? (
            <>
              <Dialog
                open={isAutodeskDialogOpen}
                onOpenChange={setIsAutodeskDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mr-2">
                    <Database className="mr-1.5 h-3.5 w-3.5" /> Link from
                    Autodesk
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-border text-foreground sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">
                      Link Autodesk Project
                    </DialogTitle>
                    <DialogDescription>
                      Select a project folder from your Autodesk account to
                      synchronize files automatically.
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
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-sm shadow-[#6366f1]/20"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-border text-foreground sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">
                      Create New Project
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Add a new BIM project to your workspace.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-foreground">
                        Project Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Building A - Phase 1"
                        value={newProject.name}
                        onChange={(e) =>
                          setNewProject({ ...newProject, name: e.target.value })
                        }
                        className="bg-card border-border text-foreground focus-visible:ring-primary"
                        minLength={3}
                        maxLength={50}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {newProject.name.length}/50
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description" className="text-foreground">
                        Description
                      </Label>
                      <Input
                        id="description"
                        placeholder="Project description..."
                        value={newProject.description}
                        onChange={(e) =>
                          setNewProject({
                            ...newProject,
                            description: e.target.value,
                          })
                        }
                        className="bg-card border-border text-foreground focus-visible:ring-primary"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setIsDialogOpen(false)}
                      className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateProject}
                      disabled={creating}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
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
        <DialogContent className="border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-500">
              Delete Project
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this project? This action cannot
              be undone and all associated files will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border h-40 rounded-lg animate-pulse"
            ></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
          <div className="bg-muted w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
            <Folder className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {searchQuery
              ? "No projects match your search"
              : "No projects found"}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
            {searchQuery
              ? "Try adjusting your search terms."
              : "Get started by creating your first project to manage your BIM models."}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-secondary hover:bg-secondary/80 text-foreground border border-border backdrop-blur-sm"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Results info */}
          <div className="text-sm text-muted-foreground">
            Showing {projects.length} of {total} projects
            {searchQuery && <> matching &quot;{searchQuery}&quot;</>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link href={`/dashboard/projects/${project.id}`} key={project.id}>
                <div className="bg-card border border-border rounded-lg p-4 h-full group relative hover:border-primary/30 transition-colors">
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-start mb-3">
                      <div className="p-2 bg-brand-subtle rounded-md text-primary">
                        <Folder className="h-4 w-4" />
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

                    <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>

                    {(project.clientName || project.location) && (
                      <div className="flex flex-col gap-1 mb-3 text-xs text-muted-foreground">
                        {project.clientName && (
                          <div className="flex items-center">
                            <span className="font-semibold mr-1">Client:</span>{" "}
                            {project.clientName}
                          </div>
                        )}
                        {project.location && (
                          <div className="flex items-center">
                            <span className="font-semibold mr-1">Loc:</span>{" "}
                            <span className="truncate max-w-[200px]">
                              {project.location}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-muted-foreground text-xs line-clamp-2 mb-4 flex-1">
                      {project.description || "No description provided."}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <FileText className="mr-1 h-3 w-3" />
                        <span className="font-medium text-foreground">
                          {project._count?.files ?? 0} Files
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="text-muted-foreground"
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
                )
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  typeof item === "string" ? (
                    <span
                      key={`dots-${i}`}
                      className="px-2 text-muted-foreground"
                    >
                      {item}
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant={item === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(item)}
                      className={
                        item === page
                          ? "bg-primary text-white"
                          : "text-muted-foreground"
                      }
                    >
                      {item}
                    </Button>
                  ),
                )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="text-muted-foreground"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageContent />
    </Suspense>
  );
}

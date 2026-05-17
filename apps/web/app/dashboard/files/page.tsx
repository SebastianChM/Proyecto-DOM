"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import apiClient from "@/lib/axios-config";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { showError } from "@/lib/error-handler";
import { useUser } from "@/context/UserContext";
import { FileRow } from "@/components/FileRow";
import { ViewerModal } from "@/components/ViewerModal";
import { logger } from "@/lib/logger";
import {
  FALLBACK_SUPPORTED_FORMATS,
  isConversionSupportedByFormats,
  normalizeSupportedFormats,
} from "@/lib/conversion/contracts";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  status: string;
  apsUrn: string | null;
  createdAt: string;
  apsProjectId?: string;
  projectName?: string;
  projectId?: string;
  progress?: number;
  project?: { id: string; name: string };
}

interface FilterProject {
  id: string;
  name: string;
  fileCount: number;
}

export default function AllFilesPage() {
  const { user } = useUser();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [filterProjects, setFilterProjects] = useState<FilterProject[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [supportedFormats, setSupportedFormats] = useState<
    Record<string, string[]>
  >(FALLBACK_SUPPORTED_FORMATS);
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    file: FileItem;
    token?: string;
  } | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  /** Debounce search input (400ms) */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /** Fetch files from /api/files/all with server-side pagination and filters */
  const fetchFiles = useCallback(
    async (targetPage?: number) => {
      try {
        setLoading(true);
        const p = targetPage ?? page;
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(pageSize),
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (activeFilter !== "ALL") params.set("type", activeFilter);
        if (selectedProjectId) params.set("projectId", selectedProjectId);

        const response = await apiClient.get(
          `/api/files/all?${params.toString()}`,
        );
        const { meta, filters, data } = response.data;

        // Flatten project info into each file
        const filesWithProject = (data as FileItem[]).map((f) => ({
          ...f,
          projectName: f.project?.name,
          projectId: f.project?.id ?? f.projectId,
        }));

        setFiles(filesWithProject);
        setTotal(meta.total);
        setTotalPages(meta.totalPages);
        setPage(meta.page);
        if (filters?.projects) setFilterProjects(filters.projects);
      } catch (error) {
        showError(error, user?.role, "Failed to load files");
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      debouncedSearch,
      activeFilter,
      selectedProjectId,
      pageSize,
      user?.role,
    ],
  );

  /** Re-fetch when pagination, search, or filters change */
  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const fetchSupportedFormats = async () => {
      try {
        const response = await apiClient.get("/api/conversion/formats");
        const normalized = normalizeSupportedFormats(response.data);
        if (Object.keys(normalized).length > 0) {
          setSupportedFormats(normalized);
        }
      } catch (error) {
        logger.warn("Failed to fetch conversion formats for all-files page", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void fetchSupportedFormats();
  }, []);

  const canConvertFileToPdf = (file: FileItem): boolean => {
    return (
      file.status === "READY" &&
      isConversionSupportedByFormats(supportedFormats, file.type, "pdf")
    );
  };

  const handleViewFile = async (file: FileItem) => {
    if (file.status !== "READY" || !file.apsUrn) {
      toast.error("File is not ready for viewing");
      return;
    }

    let token = undefined;
    if (file.apsProjectId) {
      try {
        const res = await apiClient.get("/api/auth/user-token");
        token = res.data.access_token;
      } catch {
        logger.info("No user token available for ACC file");
      }
    }

    setViewerModal({
      isOpen: true,
      file,
      token,
    });
  };

  /** Handle page change */
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const toggleSelectFile = (id: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const handleBatchConvert = async () => {
    if (selectedFiles.size === 0) return;

    const filesToConvert = files.filter(
      (file) => selectedFiles.has(file.id) && canConvertFileToPdf(file),
    );

    if (filesToConvert.length === 0) {
      toast.info("No eligible files selected for PDF conversion");
      return;
    }

    let started = 0;

    toast.info("Starting batch conversion...");

    for (const file of filesToConvert) {
      try {
        await apiClient.post(`/api/conversion/${file.id}`, {
          format: "pdf",
        });
        started++;
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 429) {
          toast.warning(
            "Concurrency limit reached. Please wait for pending conversions to finish.",
          );
          break;
        }

        logger.error(`Failed to start conversion for ${file.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        showError(error, user?.role, `Failed to convert ${file.name}`);
      }
    }

    if (started > 0) {
      toast.success(`Started PDF conversion for ${started} files`);
      setSelectedFiles(new Set());
      return;
    }

    toast.info("No eligible files selected for PDF conversion");
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) return;

    // Filter for valid files (must be READY and have a URN)
    const filesToDownload = files.filter(
      (f) => selectedFiles.has(f.id) && f.status === "READY" && f.apsUrn,
    );

    if (filesToDownload.length === 0) {
      toast.warning("No valid files selected for download.");
      return;
    }

    if (filesToDownload.length > 1) {
      try {
        toast.info(
          `Preparing ZIP archive for ${filesToDownload.length} files...`,
        );
        const response = await apiClient.post(
          "/api/files/batch-download",
          {
            fileIds: filesToDownload.map((f) => f.id),
          },
          {
            responseType: "blob",
          },
        );

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `files_archive_${Date.now()}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        toast.success("ZIP download started");
      } catch (error) {
        logger.error("Batch download failed", {
          error: error instanceof Error ? error.message : String(error),
          fileCount: filesToDownload.length,
        });
        showError(error, user?.role, "Batch download failed");
        toast.error("Failed to create ZIP archive");
      }
    } else {
      // Single file download
      const file = filesToDownload[0];
      window.open(`/api/files/${file.id}/download`, "_blank");
      toast.success(`Started download for ${file.name}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <div>
        <h2 className="text-4xl font-bold text-foreground tracking-tight">
          All Files
        </h2>
        <p className="text-muted-foreground mt-2 text-lg">
          Global view of all project documents.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg shadow-sm border border-border/50">
        {/* Left: Search & Filter */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-transparent focus:bg-background transition-all rounded-xl"
            />
          </div>

          <div className="flex items-center bg-secondary/50 rounded-xl p-1">
            {["ALL", "RVT", "DWG", "PDF"].map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeFilter === filter
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                }`}
              >
                {filter === "ALL" ? "All Files" : filter}
              </button>
            ))}
          </div>

          <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 border-transparent bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl"
              >
                <Filter className="mr-2 h-4 w-4" />
                {selectedProjectId
                  ? (filterProjects.find((p) => p.id === selectedProjectId)
                      ?.name ?? "Project")
                  : "Filter Projects"}
                {selectedProjectId && (
                  <span className="ml-2 bg-brand text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    1
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-72 p-0 rounded-xl border-border/50 shadow-sm"
            >
              <div className="p-4 border-b border-border/50">
                <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
                  Filter by Project
                </DropdownMenuLabel>
              </div>

              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {filterProjects.length === 0 ? (
                  <div className="p-8 text-sm text-muted-foreground text-center">
                    No projects found
                  </div>
                ) : (
                  filterProjects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary cursor-pointer transition-colors group"
                      onClick={() => {
                        setSelectedProjectId(
                          selectedProjectId === project.id ? "" : project.id,
                        );
                        setPage(1);
                        setIsFilterOpen(false);
                      }}
                    >
                      <Checkbox
                        checked={selectedProjectId === project.id}
                        className="border-gray-300 data-[state=checked]:bg-brand data-[state=checked]:border-primary rounded-md h-4 w-4"
                      />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground truncate transition-colors flex-1">
                        {project.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {project.fileCount}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-border/50 flex items-center justify-end bg-secondary/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProjectId("");
                    setPage(1);
                    setIsFilterOpen(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Results info */}
      {!loading && files.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {files.length} of {total} files
          {debouncedSearch && <> matching &quot;{debouncedSearch}&quot;</>}
        </div>
      )}

      {/* File List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-card h-20 animate-pulse rounded-lg shadow-sm"
            ></div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="bg-card rounded-lg p-16 text-center border border-dashed border-border/50 shadow-sm">
          <div className="bg-secondary/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            No files found
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Upload files inside your projects to see them appear in this global
            view.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {files.map((file) => (
              <FileRow
                key={file.id}
                fileName={file.name}
                fileType={file.type}
                fileSize={formatSize(file.size)}
                updatedAt={new Date(file.createdAt).toLocaleDateString()}
                status={file.status}
                progress={file.progress}
                isSelected={selectedFiles.has(file.id)}
                onSelect={() => toggleSelectFile(file.id)}
                onView={() => handleViewFile(file)}
                onRetry={() => {}}
                projectName={file.projectName}
                actions={
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewFile(file)}
                      className="text-primary hover:bg-blue-50 hover:text-blue-700 font-medium rounded-lg"
                    >
                      <Eye className="h-4 w-4 mr-2" /> View
                    </Button>
                    <Link href={`/dashboard/projects/${file.projectId}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-secondary text-muted-foreground hover:text-foreground rounded-full"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                }
              />
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

      {/* Bulk Actions Bar */}
      {selectedFiles.size > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl text-white pl-4 pr-6 py-3 rounded-full shadow-md flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4 border border-white/10 ring-1 ring-black/20">
          <div className="flex items-center gap-4 border-r border-gray-700 pr-4">
            <div className="bg-brand text-white text-xs font-bold px-2 py-1 rounded-full w-6 h-6 flex items-center justify-center">
              {selectedFiles.size}
            </div>
            <span className="font-medium text-sm">Selected</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFiles(new Set())}
              className="text-gray-400 hover:text-white h-auto p-0 hover:bg-transparent"
            >
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const convertibleFiles = files.filter(
                (f) => selectedFiles.has(f.id) && canConvertFileToPdf(f),
              );
              const count = convertibleFiles.length;

              return (
                <Button
                  onClick={handleBatchConvert}
                  disabled={count === 0}
                  className={`rounded-full h-9 text-xs font-bold border transition-all px-4 ${
                    count > 0
                      ? "bg-white/10 text-white hover:bg-white/20 border-white/10"
                      : "bg-white/5 text-gray-500 border-white/5 cursor-not-allowed"
                  }`}
                >
                  <FileText className="h-3 w-3 mr-2" />
                  {count > 0
                    ? `Convert ${count} to PDF`
                    : "No convertible files"}
                </Button>
              );
            })()}
            <Button
              onClick={handleBatchDownload}
              className="bg-white text-gray-900 hover:bg-gray-200 rounded-full h-9 text-xs font-bold px-4"
            >
              <Download className="h-3 w-3 mr-2" />
              {selectedFiles.size > 3 ? "Download ZIP" : "Download All"}
            </Button>
          </div>
        </div>
      )}

      <ViewerModal
        isOpen={!!viewerModal}
        onClose={() => setViewerModal(null)}
        file={viewerModal?.file ?? null}
        token={viewerModal?.token}
      />
    </div>
  );
}

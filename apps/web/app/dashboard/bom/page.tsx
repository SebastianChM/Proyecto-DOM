"use client";

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/lib/axios-config";
import { projectsService } from "@/lib/api/services";
import type { Project, ProjectFile } from "@/lib/api/types";
import {
  TableProperties,
  ChevronRight,
  ChevronLeft,
  Box,
  Database,
  Search,
  Download,
  BarChart3,
  Filter,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { showError } from "@/lib/error-handler";
import { useUser } from "@/context/UserContext";

interface BomMeta {
  mode: string;
  totalRawElements: number;
  totalFiltered: number;
  totalAggregated: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface BomSummaryCategory {
  category: string;
  count: number;
  uniqueTypes: number;
  totalVolume: number;
  totalArea: number;
  totalLength: number;
}

interface AggregatedBomItem {
  category: string;
  family: string;
  type: string;
  material: string;
  count: number;
  totalVolume: number;
  totalArea: number;
  totalLength: number;
}

interface BomResponse {
  meta: BomMeta;
  categories: string[];
  summary: BomSummaryCategory[];
  data: AggregatedBomItem[];
}

export default function BOMPage() {
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [bomResponse, setBomResponse] = useState<BomResponse | null>(null);
  const [loadingBom, setLoadingBom] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showSummary, setShowSummary] = useState(true);
  const pageSize = 50;

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsService.list({ pageSize: 100 });
        setProjects(response.data ?? []);
      } catch (error) {
        showError(error, user?.role, "Failed to load projects");
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [user?.role]);

  const fetchBom = useCallback(
    async (fileId: string, pg: number, cat: string, q: string) => {
      setLoadingBom(true);
      try {
        const params = new URLSearchParams({
          mode: "aggregated",
          page: String(pg),
          pageSize: String(pageSize),
        });
        if (cat) params.set("category", cat);
        if (q) params.set("search", q);

        const response = await apiClient.get(
          `/api/files/${fileId}/bom?${params.toString()}`,
        );
        setBomResponse(response.data);
      } catch (error) {
        showError(error, user?.role, "Failed to load BOM data");
        setBomResponse(null);
      } finally {
        setLoadingBom(false);
      }
    },
    [user?.role],
  );

  const handleFileSelect = (file: ProjectFile) => {
    if (file.status !== "READY") {
      toast.error("File must be processed (READY) to extract quantities.");
      return;
    }
    setSelectedFile(file);
    setSearch("");
    setCategoryFilter("");
    setPage(1);
    fetchBom(file.id, 1, "", "");
  };

  // Debounced search
  useEffect(() => {
    if (!selectedFile) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchBom(selectedFile.id, 1, categoryFilter, search);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (selectedFile)
      fetchBom(selectedFile.id, newPage, categoryFilter, search);
  };

  const handleCategoryClick = (cat: string) => {
    const newCat = categoryFilter === cat ? "" : cat;
    setCategoryFilter(newCat);
    setPage(1);
  };

  const handleExportCSV = async () => {
    if (!selectedFile) return;
    try {
      const response = await apiClient.get(
        `/api/files/${selectedFile.id}/bom/export?mode=aggregated`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BOM_${selectedFile.name}_aggregated.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("BOM exported successfully");
    } catch (error) {
      showError(error, user?.role, "Failed to export CSV");
    }
  };

  const meta = bomResponse?.meta;
  const summary = bomResponse?.summary || [];
  const categories = bomResponse?.categories || [];
  const data = bomResponse?.data || [];

  return (
    <div className="space-y-6 animate-fade-in h-[calc(100vh-100px)] flex flex-col">
      <div>
        <h2 className="text-4xl font-bold text-foreground tracking-tight ">
          BOM & Quantities
        </h2>
        <p className="text-muted-foreground mt-2 text-lg">
          Extract automated Bill of Materials from your BIM models.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Sidebar: File Selection */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          <Card className="h-full flex flex-col bg-card border border-border">
            <CardHeader>
              <CardTitle className="text-lg">Select Model</CardTitle>
              <CardDescription>Choose a file to analyze</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading projects...
                </div>
              ) : (
                <div className="space-y-1">
                  {projects.map((project) => (
                    <div key={project.id} className="px-2">
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {project.name}
                      </div>
                      {project.files?.filter(
                        (f) => f.type === "RVT" || f.type === "IFC",
                      ).length === 0 && (
                        <div className="px-4 py-2 text-sm text-muted-foreground italic">
                          No BIM models
                        </div>
                      )}
                      {project.files
                        ?.filter((f) => f.type === "RVT" || f.type === "IFC")
                        .map((file) => (
                          <button
                            key={file.id}
                            onClick={() => handleFileSelect(file)}
                            className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-between group ${
                              selectedFile?.id === file.id
                                ? "bg-brand text-white shadow-lg"
                                : "hover:bg-secondary text-foreground"
                            }`}
                          >
                            <div className="flex items-center overflow-hidden">
                              <Box className="h-4 w-4 mr-3 flex-shrink-0" />
                              <span className="truncate">{file.name}</span>
                            </div>
                            {selectedFile?.id === file.id && (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col overflow-hidden gap-4">
          {!selectedFile ? (
            <Card className="h-full flex flex-col bg-card border border-border">
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <TableProperties className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No model selected</p>
                <p className="text-sm">
                  Select a BIM model from the list to view quantities.
                </p>
              </div>
            </Card>
          ) : loadingBom && !bomResponse ? (
            <Card className="h-full flex items-center justify-center bg-card border border-border">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </Card>
          ) : !bomResponse || data.length === 0 ? (
            <Card className="h-full flex flex-col bg-card border border-border">
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Database className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No Data Available</p>
                <p className="text-sm">
                  Could not extract properties from this model.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              {showSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
                  <Card className="bg-card border border-border">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">
                        {meta?.totalRawElements.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total Elements
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border border-border">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">
                        {meta?.totalAggregated.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Unique Types
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border border-border">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">
                        {categories.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Categories
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border border-border">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-foreground">
                        {summary
                          .reduce((s, c) => s + c.totalVolume, 0)
                          .toFixed(1)}{" "}
                        m³
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total Volume
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Category Summary (collapsible) */}
              {showSummary && summary.length > 0 && (
                <Card className="flex-shrink-0 bg-card border border-border">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Categories Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                      {summary.map((cat) => (
                        <button
                          key={cat.category}
                          onClick={() => handleCategoryClick(cat.category)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            categoryFilter === cat.category
                              ? "bg-brand text-white shadow-xs"
                              : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {cat.category}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              categoryFilter === cat.category
                                ? "border-white/50 text-white"
                                : ""
                            }`}
                          >
                            {cat.count}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, family, type, material..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-card border-border"
                  />
                </div>

                {categoryFilter && (
                  <Badge
                    variant="secondary"
                    className="gap-1 cursor-pointer"
                    onClick={() => handleCategoryClick(categoryFilter)}
                  >
                    <Filter className="h-3 w-3" />
                    {categoryFilter}
                    <span className="ml-1 text-muted-foreground">×</span>
                  </Badge>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSummary(!showSummary)}
                    className="text-muted-foreground"
                  >
                    <Layers className="h-4 w-4 mr-1" />
                    {showSummary ? "Hide" : "Show"} Summary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card border border-border"
                    onClick={handleExportCSV}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Filtered info */}
              {meta &&
                (meta.totalFiltered !== meta.totalRawElements ||
                  categoryFilter ||
                  search) && (
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    Showing {meta.totalItems} aggregated rows from{" "}
                    {meta.totalFiltered.toLocaleString()} elements
                    {meta.totalFiltered !== meta.totalRawElements && (
                      <>
                        {" "}
                        (filtered from {meta.totalRawElements.toLocaleString()}{" "}
                        total)
                      </>
                    )}
                  </div>
                )}

              {/* Data Table */}
              <Card className="flex-1 min-h-0 flex flex-col bg-card border border-border overflow-hidden">
                {loadingBom ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-secondary sticky top-0 backdrop-blur-md z-10">
                        <tr>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Family</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Material</th>
                          <th className="px-4 py-3 text-right">Count</th>
                          <th className="px-4 py-3 text-right">Volume (m³)</th>
                          <th className="px-4 py-3 text-right">Area (m²)</th>
                          <th className="px-4 py-3 text-right">Length (m)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-secondary/50 transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <button
                                className="font-medium text-foreground hover:text-primary transition-colors"
                                onClick={() =>
                                  handleCategoryClick(item.category)
                                }
                              >
                                {item.category}
                              </button>
                            </td>
                            <td
                              className="px-4 py-2.5 text-muted-foreground truncate max-w-[180px]"
                              title={item.family}
                            >
                              {item.family || "—"}
                            </td>
                            <td
                              className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]"
                              title={item.type}
                            >
                              {item.type || "—"}
                            </td>
                            <td
                              className="px-4 py-2.5 text-muted-foreground truncate max-w-[150px]"
                              title={item.material}
                            >
                              {item.material || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                              {item.count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                              {item.totalVolume > 0
                                ? item.totalVolume.toFixed(3)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                              {item.totalArea > 0
                                ? item.totalArea.toFixed(3)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                              {item.totalLength > 0
                                ? item.totalLength.toFixed(3)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card flex-shrink-0">
                    <div className="text-xs text-muted-foreground">
                      Page {page} of {meta.totalPages} · {meta.totalItems} rows
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => handlePageChange(page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from(
                        { length: Math.min(meta.totalPages, 7) },
                        (_, i) => {
                          // Show pages around current
                          let p: number;
                          if (meta.totalPages <= 7) {
                            p = i + 1;
                          } else if (page <= 4) {
                            p = i + 1;
                          } else if (page >= meta.totalPages - 3) {
                            p = meta.totalPages - 6 + i;
                          } else {
                            p = page - 3 + i;
                          }
                          return (
                            <Button
                              key={p}
                              variant={p === page ? "default" : "ghost"}
                              size="sm"
                              className={`w-8 h-8 p-0 ${p === page ? "bg-brand text-white" : ""}`}
                              onClick={() => handlePageChange(p)}
                            >
                              {p}
                            </Button>
                          );
                        },
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={page >= meta.totalPages}
                        onClick={() => handlePageChange(page + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

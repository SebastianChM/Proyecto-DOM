"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/axios-config";
import { ArrowLeft, Download, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";

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

interface FileData {
  id: string;
  name: string;
  projectId: string;
}

export default function BOMPage() {
  const params = useParams();
  const { user } = useUser();
  const fileId = params.id as string;

  const [file, setFile] = useState<FileData | null>(null);
  const [bomData, setBomData] = useState<AggregatedBomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchBOM = async () => {
      try {
        // Fetch file info
        const fileResponse = await apiClient.get(`/api/files/${fileId}`);
        setFile(fileResponse.data);

        // Fetch BOM data — aggregated view, server-paginated to 100 rows max
        const bomResponse = await apiClient.get(
          `/api/files/${fileId}/bom?mode=aggregated&pageSize=100`,
        );
        setBomData(bomResponse.data.data ?? []);
      } catch (error) {
        showError(error, user?.role, "Failed to load BOM data");
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchBOM();
    }
  }, [fileId, user?.role]);

  const handleExportCSV = useCallback(async () => {
    if (!fileId) return;
    try {
      const response = await apiClient.get(
        `/api/files/${fileId}/bom/export?mode=aggregated`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BOM_${file?.name ?? fileId}_aggregated.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error, user?.role, "Failed to export CSV");
    }
  }, [fileId, file?.name, user?.role]);

  const filteredData = useMemo(
    () =>
      bomData.filter(
        (item) =>
          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.family.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.material.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [bomData, searchTerm],
  );

  const totalVolume = useMemo(
    () =>
      Math.round(
        bomData.reduce((acc, item) => acc + item.totalVolume, 0) * 1e6,
      ) / 1e6,
    [bomData],
  );
  const totalArea = useMemo(
    () =>
      Math.round(bomData.reduce((acc, item) => acc + item.totalArea, 0) * 1e6) /
      1e6,
    [bomData],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black">
        <div className="bg-card border border-border p-8 rounded-lg flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="text-lg font-medium text-foreground animate-pulse">
            Loading BOM Data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header Section */}
      <div className="flex flex-col gap-6">
        <div className="bg-card border border-border p-6 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 border-l-4 border-primary">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link
              href={
                file ? `/dashboard/projects/${file.projectId}` : "/dashboard"
              }
            >
              <Button
                variant="ghost"
                size="icon"
                className="bg-card border border-border rounded-full h-12 w-12 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Bill of Materials
              </h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {file?.name || "Loading..."}
              </p>
            </div>
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all hover:scale-105 w-full md:w-auto"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border p-6 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Filter className="h-16 w-16 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Total Items
            </h3>
            <p className="text-4xl font-bold text-foreground">
              {bomData.length}
            </p>
            <div className="mt-4 h-1 w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-full animate-slide-in-right"></div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="h-16 w-16 border-4 border-blue-500 rounded-lg"></div>
            </div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Total Volume
            </h3>
            <p className="text-4xl font-bold text-foreground">
              {totalVolume.toFixed(2)}{" "}
              <span className="text-lg text-muted-foreground font-normal">
                m³
              </span>
            </p>
            <div className="mt-4 h-1 w-full bg-blue-500/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-[75%] animate-slide-in-right delay-100"></div>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <div className="h-16 w-16 border-4 border-orange-500 rounded-full"></div>
            </div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Total Area
            </h3>
            <p className="text-4xl font-bold text-foreground">
              {totalArea.toFixed(2)}{" "}
              <span className="text-lg text-muted-foreground font-normal">
                m²
              </span>
            </p>
            <div className="mt-4 h-1 w-full bg-orange-500/10 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 w-[60%] animate-slide-in-right delay-200"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-card border border-border p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by category, family, type, or material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-foreground focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <span className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-bold text-foreground">
              {filteredData.length}
            </span>{" "}
            items
          </span>
          <Button
            variant="outline"
            className="bg-card border border-border border-white/10 hover:bg-white/10"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* BOM Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm border border-white/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-white/5 hover:bg-white/5">
                <TableHead className="text-foreground font-bold py-4">
                  Category
                </TableHead>
                <TableHead className="text-foreground font-bold py-4">
                  Family
                </TableHead>
                <TableHead className="text-foreground font-bold py-4">
                  Type
                </TableHead>
                <TableHead className="text-foreground font-bold py-4">
                  Material
                </TableHead>
                <TableHead className="text-foreground font-bold text-right py-4">
                  Count
                </TableHead>
                <TableHead className="text-foreground font-bold text-right py-4">
                  Total Volume (m³)
                </TableHead>
                <TableHead className="text-foreground font-bold text-right py-4">
                  Total Area (m²)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-16 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 opacity-50" />
                      <p>
                        {searchTerm
                          ? "No items match your search"
                          : "No BOM data available"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, idx) => (
                  <TableRow
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <TableCell className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.family}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.material}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono">
                      {item.count}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono">
                      {item.totalVolume > 0 ? item.totalVolume.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono">
                      {item.totalArea > 0 ? item.totalArea.toFixed(3) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

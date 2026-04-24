"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/axios-config";
import {
  ArrowLeft,
  Clock,
  GitCompare,
  Eye,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";

interface FileVersion {
  id: string;
  versionNumber: number;
  displayName: string;
  createTime: string;
  createUserName: string;
  urn: string | null;
  size: number;
  status: string;
}

interface FileData {
  id: string;
  name: string;
  projectId: string;
}

interface VersionsResponse {
  file: FileData;
  versions: FileVersion[];
  source: "APS" | "LOCAL";
}

export default function FileHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const fileId = params.id as string;

  const [data, setData] = useState<VersionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  useEffect(() => {
    const fetchFileHistory = async () => {
      try {
        const response = await apiClient.get<VersionsResponse>(
          `/api/files/${fileId}/versions`,
        );
        setData(response.data);
      } catch (error) {
        showError(error, user?.role, "Failed to fetch file history");
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchFileHistory();
    }
  }, [fileId, user?.role]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const toggleVersionSelection = (versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      } else if (prev.length < 2) {
        return [...prev, versionId];
      } else {
        // Replace the first selected with the new one
        return [prev[1], versionId];
      }
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length !== 2 || !data) return;

    const version1 = data.versions.find((v) => v.id === selectedVersions[0]);
    const version2 = data.versions.find((v) => v.id === selectedVersions[1]);

    if (version1?.urn && version2?.urn) {
      // Determine comparison type based on file extension
      const isPdf = data.file.name.toLowerCase().endsWith(".pdf");
      const type = isPdf ? "2d" : "3d";

      router.push(
        `/dashboard/viewer/compare?primary=${version1.urn}&diff=${version2.urn}&file=${fileId}&type=${type}`,
      );
    }
  };

  const handleViewVersion = (urn: string) => {
    router.push(`/dashboard/viewer/${fileId}?urn=${urn}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 animate-spin text-purple-500" />
          <p>Loading version history...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:text-white text-gray-900">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">File not found</p>
          <Link href="/dashboard">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white dark:bg-card border border-border border border-gray-200 dark:border-white/10 rounded-lg p-6 flex items-center justify-between border-l-4 border-purple-500 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/projects/${data.file.projectId}`}>
            <Button
              variant="ghost"
              size="icon"
              className="dark:bg-card border border-border bg-gray-50 dark:bg-white/10 rounded-full h-12 w-12 border border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold dark:text-white text-gray-900 tracking-tight">
              File History & Compare
            </h1>
            <p className="dark:text-gray-400 text-gray-600 text-sm mt-1">
              {data.file.name}
            </p>
            <Badge variant="outline" className="mt-2">
              {data.source === "APS" ? "☁️ Autodesk Cloud" : "💾 Local Storage"}
            </Badge>
          </div>
        </div>
        <Button
          className="bg-purple-500 hover:bg-purple-600 text-white"
          disabled={selectedVersions.length !== 2}
          onClick={handleCompare}
        >
          <GitCompare className="h-4 w-4 mr-2" />
          Compare Selected ({selectedVersions.length}/2)
        </Button>
      </div>

      {/* Version History */}
      <div className="bg-white dark:bg-card border border-border border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm">
        <div className="p-6 border-b dark:border-white/10 border-gray-200 dark:bg-white/5 bg-gray-50">
          <h3 className="text-xl font-bold dark:text-white text-gray-900 flex items-center">
            <div className="p-2 bg-purple-500/10 rounded-lg mr-3">
              <Clock className="h-5 w-5 text-purple-500 dark:text-purple-400" />
            </div>
            Version History
            <span className="ml-3 text-sm font-normal dark:text-gray-400 text-gray-600">
              ({data.versions.length}{" "}
              {data.versions.length === 1 ? "version" : "versions"})
            </span>
          </h3>
        </div>

        <div className="p-6">
          {data.versions.length === 0 ? (
            <div className="text-center py-12 dark:text-gray-400 text-gray-500">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                No version history available
              </p>
              <p className="text-sm">This file has not been versioned yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="dark:border-white/10 border-gray-200">
                  <TableHead className="dark:text-white text-gray-900 font-bold w-12"></TableHead>
                  <TableHead className="dark:text-white text-gray-900 font-bold">
                    Version
                  </TableHead>
                  <TableHead className="dark:text-white text-gray-900 font-bold">
                    Created
                  </TableHead>
                  <TableHead className="dark:text-white text-gray-900 font-bold">
                    Created By
                  </TableHead>
                  <TableHead className="dark:text-white text-gray-900 font-bold">
                    Size
                  </TableHead>
                  <TableHead className="dark:text-white text-gray-900 font-bold">
                    Status
                  </TableHead>
                  <TableHead className="dark:text-white text-gray-900 font-bold text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.versions.map((version) => {
                  const isSelected = selectedVersions.includes(version.id);
                  return (
                    <TableRow
                      key={version.id}
                      className={`dark:border-white/10 border-gray-200 dark:hover:bg-white/5 hover:bg-gray-50 cursor-pointer transition-colors ${
                        isSelected ? "dark:bg-purple-500/10 bg-purple-50" : ""
                      }`}
                      onClick={() => toggleVersionSelection(version.id)}
                    >
                      <TableCell>
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-purple-500" />
                        ) : (
                          <Square className="h-5 w-5 dark:text-gray-400 text-gray-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium dark:text-white text-gray-900">
                        {version.displayName}
                        {version.versionNumber ===
                          Math.max(
                            ...data.versions.map((v) => v.versionNumber),
                          ) && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Latest
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="dark:text-gray-300 text-gray-700">
                        {formatDate(version.createTime)}
                      </TableCell>
                      <TableCell className="dark:text-gray-300 text-gray-700">
                        {version.createUserName}
                      </TableCell>
                      <TableCell className="dark:text-gray-300 text-gray-700">
                        {formatSize(version.size)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            version.status === "READY"
                              ? "bg-green-500/20 text-green-600 dark:text-green-300"
                              : version.status === "FAILED"
                                ? "bg-red-500/20 text-red-600 dark:text-red-300"
                                : "bg-blue-500/20 text-blue-600 dark:text-blue-300"
                          }`}
                        >
                          {version.status}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!version.urn}
                          onClick={() =>
                            version.urn && handleViewVersion(version.urn)
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Info Message */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-sm dark:text-blue-300 text-blue-800">
          <strong>How to compare:</strong> Select two versions by clicking on
          them, then click &quot;Compare Selected&quot; to view differences.
          (DiffTool for 3D models, PixelCompare for PDFs).
        </p>
      </div>
    </div>
  );
}

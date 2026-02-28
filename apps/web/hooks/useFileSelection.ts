"use client";

import { useState, useMemo, useCallback } from "react";
import type { ProjectFileDetail } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileTypeFilter = "ALL" | "RVT" | "DWG" | "PDF" | "IFC" | "OTHER";

export interface GroupedFiles {
  RVT: ProjectFileDetail[];
  DWG: ProjectFileDetail[];
  PDF: ProjectFileDetail[];
  IFC: ProjectFileDetail[];
  OTHER: ProjectFileDetail[];
}

export interface UseFileSelectionReturn {
  /** Currently selected file IDs. */
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  toggleFileSelection: (fileId: string) => void;
  toggleSelectAll: () => void;

  /** Search term for file name filter. */
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;

  /** Active type filter tab. */
  activeFilter: FileTypeFilter;
  setActiveFilter: (filter: string) => void;

  /** Files matching search + type filter. */
  filteredFiles: ProjectFileDetail[];

  /** Files grouped by type (only when filter is ALL, otherwise null). */
  groupedFiles: GroupedFiles | null;

  /** True when exactly 2 selected files are of compatible types for comparison. */
  areFilesCompatibleForCompare: (fileIds: string[]) => boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFileSelection(
  files: ProjectFileDetail[],
): UseFileSelectionReturn {
  // --- State ---
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FileTypeFilter>("ALL");

  // --- Derived: filtered files ---
  const filteredFiles = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return files.filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(term);
      const matchesFilter =
        activeFilter === "ALL" || file.type === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [files, searchTerm, activeFilter]);

  // --- Derived: grouped files ---
  const groupedFiles = useMemo<GroupedFiles | null>(() => {
    if (activeFilter !== "ALL") return null;
    return {
      RVT: filteredFiles.filter((f) => f.type === "RVT"),
      DWG: filteredFiles.filter((f) => f.type === "DWG"),
      PDF: filteredFiles.filter((f) => f.type === "PDF"),
      IFC: filteredFiles.filter((f) => f.type === "IFC"),
      OTHER: filteredFiles.filter(
        (f) => !["RVT", "DWG", "PDF", "IFC"].includes(f.type),
      ),
    };
  }, [filteredFiles, activeFilter]);

  // --- Handlers ---
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId],
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedFiles((prev) => {
      if (prev.length === files.length && files.length > 0) {
        return [];
      }
      return files.map((f) => f.id);
    });
  }, [files]);

  // --- Helpers ---
  const areFilesCompatibleForCompare = useCallback(
    (fileIds: string[]) => {
      const selected = files.filter((f) => fileIds.includes(f.id));
      if (selected.length !== 2) return false;

      const is3D = (f: ProjectFileDetail) =>
        ["rvt", "ifc", "nwc", "dwg"].includes(f.type.toLowerCase());
      const is2D = (f: ProjectFileDetail) =>
        ["pdf", "dwf"].includes(f.type.toLowerCase());

      return (
        (is3D(selected[0]) && is3D(selected[1])) ||
        (is2D(selected[0]) && is2D(selected[1]))
      );
    },
    [files],
  );

  return {
    selectedFiles,
    setSelectedFiles,
    toggleFileSelection,
    toggleSelectAll,
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter: setActiveFilter as (filter: string) => void,
    filteredFiles,
    groupedFiles,
    areFilesCompatibleForCompare,
  };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/lib/axios-config";

export type Permission =
  | "project:create"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "project:share"
  | "project:archive"
  | "file:create"
  | "file:read"
  | "file:update"
  | "file:delete"
  | "file:download"
  | "member:invite"
  | "member:update"
  | "member:remove"
  | "validation:run"
  | "validation:read"
  | "validation:resolve"
  | "settings:read"
  | "settings:update";

export type Role =
  | "ADMIN"
  | "OWNER"
  | "EDITOR"
  | "VIEWER_DOWNLOAD"
  | "VIEWER"
  | "NONE";

interface ProjectPermissions {
  role: Role;
  permissions: string[];
  isOwner: boolean;
  isAdmin: boolean;
}

interface UseProjectPermissionsReturn {
  /** Current user's role in the project */
  role: Role;
  /** List of permission strings */
  permissions: string[];
  /** Whether user is the project owner */
  isOwner: boolean;
  /** Whether user is a global admin */
  isAdmin: boolean;
  /** Whether permissions are still loading */
  loading: boolean;
  /** Error message if failed to load */
  error: string | null;
  /** Check if user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if user can perform common actions */
  can: {
    share: boolean;
    edit: boolean;
    delete: boolean;
    upload: boolean;
    download: boolean;
    manageMembers: boolean;
  };
  /** Refetch permissions */
  refresh: () => Promise<void>;
}

/**
 * Hook to get and check user permissions for a project
 *
 * @example
 * const { can, hasPermission, role } = useProjectPermissions(projectId)
 *
 * if (can.share) {
 *   // Show share button
 * }
 *
 * if (hasPermission('file:delete')) {
 *   // Show delete button
 * }
 */
export function useProjectPermissions(
  projectId: string | null,
): UseProjectPermissionsReturn {
  const [data, setData] = useState<ProjectPermissions>({
    role: "NONE",
    permissions: [],
    isOwner: false,
    isAdmin: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(
        `/api/project-members/${projectId}/permissions`,
      );
      setData(response.data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load permissions";
      setError(errorMessage);
      console.error("Error fetching permissions:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      return data.permissions.includes(permission);
    },
    [data.permissions],
  );

  // Pre-computed common permission checks
  const can = {
    share: hasPermission("project:share"),
    edit: hasPermission("project:update"),
    delete: hasPermission("project:delete"),
    upload: hasPermission("file:create"),
    download: hasPermission("file:download"),
    manageMembers:
      hasPermission("member:invite") ||
      hasPermission("member:update") ||
      hasPermission("member:remove"),
  };

  return {
    role: data.role,
    permissions: data.permissions,
    isOwner: data.isOwner,
    isAdmin: data.isAdmin,
    loading,
    error,
    hasPermission,
    can,
    refresh: fetchPermissions,
  };
}

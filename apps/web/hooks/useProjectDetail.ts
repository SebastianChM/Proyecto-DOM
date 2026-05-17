"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { projectsService, projectMembersService } from "@/lib/api/services";
import type { ProjectDetail } from "@/lib/api/types";
import type { ProjectMember } from "@/components/ProjectSettingsModal";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseProjectDetailReturn {
  /** Full project (null while loading or on error). */
  project: ProjectDetail | null;
  /** Setter exposed for mutations still living in page.tsx (interim). */
  setProject: React.Dispatch<React.SetStateAction<ProjectDetail | null>>;
  /** True only during the initial load. */
  loading: boolean;
  /** Re-fetch the project from the API. */
  fetchProject: () => Promise<void>;

  // --- Members ---
  members: ProjectMember[];
  fetchMembers: () => Promise<void>;
  handleInviteMember: (email: string, role: string) => Promise<void>;
  handleUpdateMemberRole: (userId: string, role: string) => Promise<void>;
  handleRemoveMember: (userId: string) => Promise<void>;

  // --- Settings / share dialogs ---
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isShareDialogOpen: boolean;
  setIsShareDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // --- Project-level actions ---
  handleUpdateProject: (
    data: Record<string, string | undefined>,
  ) => Promise<void>;
  handleDeleteProject: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectDetail(projectId: string): UseProjectDetailReturn {
  const { user } = useUser();
  const router = useRouter();

  // --- Core state ---
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Members state ---
  const [members, setMembers] = useState<ProjectMember[]>([]);

  // --- Dialog state ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch project
  // ---------------------------------------------------------------------------

  const fetchProject = useCallback(async () => {
    try {
      const data = await projectsService.get(projectId);
      setProject(data);
    } catch (error) {
      showError(error, user?.role, "Failed to load project details");
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.role]);

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  // ---------------------------------------------------------------------------
  // Update project
  // ---------------------------------------------------------------------------

  const handleUpdateProject = useCallback(
    async (data: Record<string, string | undefined>) => {
      try {
        await projectsService.update(projectId, {
          status: data.projectType,
          discipline: data.discipline,
          clientName: data.ownerName,
          location: data.location,
          startDate: data.startDate,
          endDate: data.endDate,
          description: data.notes,
        });
        toast.success("Project details updated successfully");
        fetchProject();
      } catch (error) {
        showError(error, user?.role, "Failed to update project details");
      }
    },
    [projectId, user?.role, fetchProject],
  );

  // ---------------------------------------------------------------------------
  // Delete project
  // ---------------------------------------------------------------------------

  const handleDeleteProject = useCallback(async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this project? This action cannot be undone.",
    );
    if (!confirmed) return;
    try {
      await projectsService.delete(projectId);
      toast.success("Project deleted successfully");
      router.push("/dashboard");
    } catch (error) {
      showError(error, user?.role, "Failed to delete project");
    }
  }, [projectId, router, user?.role]);

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------

  const fetchMembers = useCallback(async () => {
    try {
      const data = await projectMembersService.list(projectId);
      if (Array.isArray(data)) {
        setMembers(data as unknown as ProjectMember[]);
      } else {
        logger.error("Expected members to be an array", { data });
        setMembers([]);
      }
    } catch (error) {
      logger.warn("Failed to fetch members", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [projectId]);

  // Auto-fetch members when settings modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      fetchMembers();
    }
  }, [isSettingsOpen, fetchMembers]);

  const handleInviteMember = useCallback(
    async (email: string, role: string) => {
      await projectMembersService.invite(projectId, email, role);
      fetchMembers();
    },
    [projectId, fetchMembers],
  );

  const handleUpdateMemberRole = useCallback(
    async (userId: string, role: string) => {
      await projectMembersService.changeRole(projectId, userId, role);
      fetchMembers();
    },
    [projectId, fetchMembers],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      await projectMembersService.remove(projectId, userId);
      fetchMembers();
    },
    [projectId, fetchMembers],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    project,
    setProject,
    loading,
    fetchProject,

    members,
    fetchMembers,
    handleInviteMember,
    handleUpdateMemberRole,
    handleRemoveMember,

    isSettingsOpen,
    setIsSettingsOpen,
    isShareDialogOpen,
    setIsShareDialogOpen,

    handleUpdateProject,
    handleDeleteProject,
  };
}

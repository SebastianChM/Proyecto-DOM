"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import apiClient from "@/lib/axios-config";
import {
  Crown,
  Shield,
  Eye,
  Download,
  Edit3,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Member {
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
    picture?: string;
  };
}

interface ProjectMembersListProps {
  projectId: string;
  canManageMembers: boolean;
}

const ROLE_CONFIG = {
  OWNER: {
    label: "Owner",
    icon: Crown,
    color: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  },
  ADMIN: {
    label: "Admin",
    icon: Shield,
    color: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  },
  EDITOR: {
    label: "Editor",
    icon: Edit3,
    color: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  },
  VIEWER_DOWNLOAD: {
    label: "Viewer+DL",
    icon: Download,
    color: "bg-green-500/20 text-green-500 border-green-500/30",
  },
  VIEWER: {
    label: "Viewer",
    icon: Eye,
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
};

export function ProjectMembersList({
  projectId,
  canManageMembers,
}: ProjectMembersListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/api/project-members/${projectId}/members`,
      );
      setMembers(response.data);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdating(userId);
      await apiClient.put(
        `/api/project-members/${projectId}/members/${userId}`,
        { role: newRole },
      );
      toast.success("Rol actualizado");
      fetchMembers();
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      toast.error("Error al cambiar rol", {
        description: axiosError.response?.data?.message,
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      setUpdating(memberToRemove.userId);
      await apiClient.delete(
        `/api/project-members/${projectId}/members/${memberToRemove.userId}`,
      );
      toast.success("Miembro removido");
      setMemberToRemove(null);
      fetchMembers();
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      toast.error("Error al remover miembro", {
        description: axiosError.response?.data?.message,
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay miembros en este proyecto
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {members.map((member) => {
          const roleConfig =
            ROLE_CONFIG[member.role as keyof typeof ROLE_CONFIG] ||
            ROLE_CONFIG.VIEWER;
          const RoleIcon = roleConfig.icon;
          const isOwnerOrAdmin =
            member.role === "OWNER" || member.role === "ADMIN";
          const canModify = canManageMembers && !isOwnerOrAdmin;

          return (
            <div
              key={member.userId}
              className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {member.user.name?.charAt(0).toUpperCase() ||
                      member.user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {member.user.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {member.user.email}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canModify ? (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.userId, value)
                      }
                      disabled={updating === member.userId}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EDITOR">Editor</SelectItem>
                        <SelectItem value="VIEWER_DOWNLOAD">
                          Viewer + Download
                        </SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setMemberToRemove(member)}
                      disabled={updating === member.userId}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge
                    variant="outline"
                    className={`${roleConfig.color} border`}
                  >
                    <RoleIcon className="h-3 w-3 mr-1" />
                    {roleConfig.label}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Remover miembro?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.user.name} perderá acceso a este proyecto. Esta
              acción se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

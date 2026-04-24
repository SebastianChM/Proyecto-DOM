import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, UserPlus, AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";

export interface ProjectMember {
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER_DOWNLOAD" | "VIEWER";
  user: {
    name: string;
    email: string;
    picture?: string;
  };
}

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  members: ProjectMember[];
  currentUserRole?: string;
  onInviteMember: (email: string, role: string) => Promise<void>;
  onUpdateMemberRole: (userId: string, newRole: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onDeleteProject: () => Promise<void>;
}

export function ProjectSettingsModal({
  isOpen,
  onClose,
  projectName,
  members,
  currentUserRole,
  onInviteMember,
  onUpdateMemberRole,
  onRemoveMember,
  onDeleteProject,
}: ProjectSettingsModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEWER");
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    setIsInviting(true);
    try {
      await onInviteMember(inviteEmail, inviteRole);
      setInviteEmail("");
      setInviteRole("VIEWER");
      toast.success("Member invited successfully");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const handleDelete = async () => {
    if (
      confirm(
        "Are you sure you want to delete this project? This action cannot be undone.",
      )
    ) {
      setIsDeleting(true);
      try {
        await onDeleteProject();
      } catch {
        setIsDeleting(false);
      }
    }
  };

  const canManageMembers =
    currentUserRole === "OWNER" ||
    currentUserRole === "EDITOR" ||
    currentUserRole === "ADMIN";
  const canDeleteProject =
    currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] bg-white dark:bg-card border border-border border-gray-200 dark:border-white/10">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Manage settings and access for {projectName}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="members" className="w-full mt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            {/* Invite Section */}
            {canManageMembers && (
              <div className="flex gap-3 items-end p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Invite New Member
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-9 bg-white dark:bg-black/20"
                      />
                    </div>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-[140px] bg-white dark:bg-black/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EDITOR">Editor</SelectItem>
                        <SelectItem value="VIEWER_DOWNLOAD">
                          Viewer + DL
                        </SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleInvite} disabled={isInviting}>
                      {isInviting ? (
                        "Inviting..."
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" /> Invite
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="rounded-md border border-gray-200 dark:border-white/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(members) ? members : []).map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user.picture} />
                          <AvatarFallback>
                            {member.user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {member.user.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {member.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManageMembers && member.role !== "OWNER" ? (
                          <Select
                            defaultValue={member.role}
                            onValueChange={(val) =>
                              onUpdateMemberRole(member.userId, val)
                            }
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EDITOR">Editor</SelectItem>
                              <SelectItem value="VIEWER_DOWNLOAD">
                                Viewer + DL
                              </SelectItem>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            {member.role.replace("_", " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageMembers && member.role !== "OWNER" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => onRemoveMember(member.userId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 p-4">
              <h3 className="text-red-800 dark:text-red-400 font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" /> Danger Zone
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                Deleting a project is irreversible. All files, versions, and
                data will be permanently removed.
              </p>
              {canDeleteProject ? (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full sm:w-auto"
                >
                  {isDeleting ? "Deleting..." : "Delete Project"}
                </Button>
              ) : (
                <p className="text-sm italic text-gray-500">
                  You do not have permission to delete this project.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

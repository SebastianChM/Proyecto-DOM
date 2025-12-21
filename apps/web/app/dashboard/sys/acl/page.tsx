"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/axios-config";
import {
  Shield,
  Users,
  FolderKanban,
  Key,
  Search,
  MoreVertical,
  Crown,
  Edit2,
  Trash2,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUser } from "@/context/UserContext";
import { showError } from "@/lib/error-handler";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  ownerId: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  isFromAutodesk: boolean;
  _count: {
    members: number;
  };
}

interface ProjectMember {
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
}

const ROLE_COLORS = {
  ADMIN:
    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900",
  OWNER:
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900",
  EDITOR:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900",
  VIEWER_DOWNLOAD:
    "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900",
  VIEWER:
    "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
  USER: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
};

const ROLE_ICONS = {
  ADMIN: Crown,
  OWNER: Shield,
  EDITOR: Edit2,
  VIEWER_DOWNLOAD: Users,
  VIEWER: Users,
};

export default function AdminRBACPage() {
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMembersDialog, setShowMembersDialog] = useState(false);

  // Verify user is ADMIN
  useEffect(() => {
    if (!user) return;
    if (user.role !== "ADMIN") {
      toast.error("Access Denied", {
        description: "You need administrator privileges to access this page",
      });
      window.location.href = "/dashboard";
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, projectsRes] = await Promise.all([
        apiClient.get("/api/users"),
        apiClient.get("/api/projects"),
      ]);
      setUsers(usersRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      showError(error, "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectMembers = async (projectId: string) => {
    try {
      const res = await apiClient.get(
        `/api/project-members/${projectId}/members`,
      );
      setProjectMembers(res.data);
    } catch (error) {
      showError(error, "Failed to load project members");
    }
  };

  const handleViewMembers = async (project: Project) => {
    setSelectedProject(project);
    await fetchProjectMembers(project.id);
    setShowMembersDialog(true);
  };

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      await apiClient.put(`/api/admin/users/${userId}/role`, { role: newRole });
      toast.success("Role updated successfully");
      fetchData();
    } catch (error) {
      showError(error, "Failed to update user role");
    }
  };

  const handleChangeMemberRole = async (
    projectId: string,
    userId: string,
    newRole: string,
  ) => {
    try {
      await apiClient.put(
        `/api/project-members/${projectId}/members/${userId}`,
        { role: newRole },
      );
      toast.success("Member role updated");
      if (selectedProject) {
        await fetchProjectMembers(selectedProject.id);
      }
    } catch (error) {
      showError(error, "Failed to update member role");
    }
  };

  const handleRemoveMember = async (projectId: string, userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await apiClient.delete(
        `/api/project-members/${projectId}/members/${userId}`,
      );
      toast.success("Member removed");
      if (selectedProject) {
        await fetchProjectMembers(selectedProject.id);
      }
    } catch (error) {
      showError(error, "Failed to remove member");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!user || user.role !== "ADMIN") {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-dom-blue animate-pulse" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-10 h-10 text-red-500" />
            RBAC Administration
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage users, projects, and permissions
          </p>
        </div>
        <Badge className="bg-red-500/10 text-red-600 border-red-200 px-4 py-2 text-sm border">
          <Crown className="w-4 h-4 mr-2" />
          Administrator Access
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {users.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {users.filter((u) => u.role === "ADMIN").length} admins
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {projects.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {projects.filter((p) => p.isFromAutodesk).length} from Autodesk
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {projects.reduce((acc, p) => acc + (p._count?.members || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total memberships
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-semibold text-green-500">
                Operational
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All services running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
        <Input
          placeholder="Search users or projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Users Table */}
      <Card className="glass-panel border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="w-5 h-5" />
                Users Management
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage user roles and permissions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">User</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Role</TableHead>
                <TableHead className="text-muted-foreground">Joined</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const RoleIcon =
                  ROLE_ICONS[u.role as keyof typeof ROLE_ICONS] || Users;
                return (
                  <TableRow
                    key={u.id}
                    className="border-border hover:bg-muted/50"
                  >
                    <TableCell className="font-medium text-foreground">
                      {u.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${ROLE_COLORS[u.role as keyof typeof ROLE_COLORS]} border`}
                      >
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={u.role}
                        onValueChange={(role) =>
                          handleChangeUserRole(u.id, role)
                        }
                        disabled={u.id === user.id}
                      >
                        <SelectTrigger className="w-32 bg-background border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">USER</SelectItem>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card className="glass-panel border-border bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FolderKanban className="w-5 h-5" />
                Projects & Permissions
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                View and manage project memberships
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Project</TableHead>
                <TableHead className="text-muted-foreground">Owner</TableHead>
                <TableHead className="text-muted-foreground">Source</TableHead>
                <TableHead className="text-muted-foreground">Members</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((p) => (
                <TableRow
                  key={p.id}
                  className="border-border hover:bg-muted/50"
                >
                  <TableCell className="font-medium text-foreground">
                    {p.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.owner?.name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        p.isFromAutodesk
                          ? "bg-blue-500/10 text-blue-600 border-blue-200"
                          : "bg-slate-500/10 text-slate-600 border-slate-200"
                      }
                    >
                      {p.isFromAutodesk ? "Autodesk" : "Local"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground border-border"
                    >
                      {p._count?.members || 0} members
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                      onClick={() => handleViewMembers(p)}
                    >
                      <Key className="w-4 h-4 mr-2" />
                      View Permissions
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-3xl glass-panel bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Key className="w-5 h-5" />
              Project Permissions: {selectedProject?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manage member roles and permissions for this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">
                    Member
                  </TableHead>
                  <TableHead className="text-muted-foreground">Role</TableHead>
                  <TableHead className="text-muted-foreground">
                    Invited
                  </TableHead>
                  <TableHead className="text-right text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectMembers.map((member) => {
                  const RoleIcon =
                    ROLE_ICONS[member.role as keyof typeof ROLE_ICONS] || Users;
                  return (
                    <TableRow key={member.userId} className="border-border">
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">
                            {member.user?.name || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.user?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${ROLE_COLORS[member.role as keyof typeof ROLE_COLORS]} border`}
                        >
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        —
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role !== "OWNER" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-popover border-border text-popover-foreground"
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  handleChangeMemberRole(
                                    selectedProject!.id,
                                    member.userId,
                                    "EDITOR",
                                  )
                                }
                              >
                                Change to EDITOR
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleChangeMemberRole(
                                    selectedProject!.id,
                                    member.userId,
                                    "VIEWER_DOWNLOAD",
                                  )
                                }
                              >
                                Change to VIEWER_DOWNLOAD
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleChangeMemberRole(
                                    selectedProject!.id,
                                    member.userId,
                                    "VIEWER",
                                  )
                                }
                              >
                                Change to VIEWER
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-600"
                                onClick={() =>
                                  handleRemoveMember(
                                    selectedProject!.id,
                                    member.userId,
                                  )
                                }
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-secondary"
              onClick={() => setShowMembersDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

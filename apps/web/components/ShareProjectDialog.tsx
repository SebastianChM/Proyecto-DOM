"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import apiClient from "@/lib/axios-config";
import { UserPlus, Mail, Shield } from "lucide-react";

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onMemberAdded?: () => void;
}

const ROLES = [
  {
    value: "EDITOR",
    label: "Editor",
    description: "Puede editar archivos y ejecutar validaciones",
  },
  {
    value: "VIEWER_DOWNLOAD",
    label: "Viewer + Download",
    description: "Puede ver y descargar archivos",
  },
  {
    value: "VIEWER",
    label: "Viewer",
    description: "Solo puede ver (sin descargar)",
  },
];

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onMemberAdded,
}: ShareProjectDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("VIEWER");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Por favor ingresa un email");
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/api/project-members/${projectId}/members`, {
        email: email.trim(),
        role,
      });

      toast.success("Invitación enviada", {
        description: `${email} ahora tiene acceso como ${ROLES.find((r) => r.value === role)?.label}`,
      });

      setEmail("");
      setRole("VIEWER");
      onOpenChange(false);
      onMemberAdded?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error al compartir";
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      toast.error("Error al compartir proyecto", {
        description: axiosError.response?.data?.message || errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Compartir Proyecto
          </DialogTitle>
          <DialogDescription>
            Invita a otros usuarios a colaborar en{" "}
            <strong>{projectName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email del usuario
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Rol
            </Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar Invitación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

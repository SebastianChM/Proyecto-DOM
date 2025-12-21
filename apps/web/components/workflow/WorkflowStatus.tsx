"use client";

/**
 * WorkflowStatus Component
 *
 * Displays the current workflow state with visual badge and available transitions.
 * Provides interactive buttons for performing workflow transitions.
 */

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import apiClient from "@/lib/axios-config";
import {
  ChevronDown,
  Loader2,
  Play,
  Send,
  Check,
  RotateCcw,
  Eye,
  Package,
  AlertTriangle,
  FileEdit,
  Upload,
  BadgeCheck,
  RefreshCw,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

export interface WorkflowState {
  name: string;
  displayName: string;
  color: string;
  icon?: string;
}

export interface AvailableTransition {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  buttonVariant: string;
  requireComment: boolean;
  requireConfirmation: boolean;
  confirmationMessage?: string;
  toState: WorkflowState;
}

export interface WorkflowInstance {
  id: string;
  currentStateName: string;
  currentStateDisplay: string;
  currentStateColor: string;
  status: string;
  availableTransitions: AvailableTransition[];
  userRole: string;
}

interface WorkflowStatusProps {
  entityType: "PROJECT" | "FILE" | "VALIDATION";
  entityId: string;
  onWorkflowChange?: (workflow: WorkflowInstance) => void;
  showTransitions?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

// ============================================
// ICON MAPPING
// ============================================

const ICON_MAP: Record<string, React.ElementType> = {
  play: Play,
  send: Send,
  check: Check,
  "check-circle": Check,
  "rotate-ccw": RotateCcw,
  eye: Eye,
  package: Package,
  "package-check": Package,
  "alert-triangle": AlertTriangle,
  "file-edit": FileEdit,
  upload: Upload,
  loader: Loader2,
  "badge-check": BadgeCheck,
  "refresh-cw": RefreshCw,
};

function getIcon(iconName?: string): React.ElementType {
  if (!iconName) return ChevronDown;
  return ICON_MAP[iconName] || ChevronDown;
}

// ============================================
// WORKFLOW STATUS COMPONENT
// ============================================

export function WorkflowStatus({
  entityType,
  entityId,
  onWorkflowChange,
  showTransitions = true,
  size = "default",
  className = "",
}: WorkflowStatusProps) {
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    transition: AvailableTransition | null;
    comment: string;
  }>({
    open: false,
    transition: null,
    comment: "",
  });

  // Fetch workflow
  const fetchWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(
        `/api/workflows/${entityType}/${entityId}`,
      );
      setWorkflow(response.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load workflow";
      console.error("Error fetching workflow:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  // Initial fetch
  useState(() => {
    fetchWorkflow();
  });

  // Perform transition
  const performTransition = async (
    transition: AvailableTransition,
    comment?: string,
  ) => {
    try {
      setTransitioning(true);

      const response = await apiClient.post(
        `/api/workflows/${entityType}/${entityId}/transition`,
        {
          transitionName: transition.name,
          comment,
        },
      );

      setWorkflow(response.data.workflow);
      onWorkflowChange?.(response.data.workflow);

      toast.success("Estado actualizado", {
        description: `Cambió a "${transition.toState.displayName}"`,
      });

      // Close dialog if open
      setConfirmDialog({ open: false, transition: null, comment: "" });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message =
        axiosError.response?.data?.message || "Error al cambiar estado";
      toast.error("Error", { description: message });
    } finally {
      setTransitioning(false);
    }
  };

  // Handle transition click
  const handleTransitionClick = (transition: AvailableTransition) => {
    if (transition.requireComment || transition.requireConfirmation) {
      setConfirmDialog({
        open: true,
        transition,
        comment: "",
      });
    } else {
      performTransition(transition);
    }
  };

  // Handle confirmation
  const handleConfirm = () => {
    if (confirmDialog.transition) {
      if (
        confirmDialog.transition.requireComment &&
        !confirmDialog.comment.trim()
      ) {
        toast.error("Comentario requerido", {
          description: "Debes agregar un comentario para esta acción",
        });
        return;
      }
      performTransition(confirmDialog.transition, confirmDialog.comment);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: "text-xs py-0.5 px-2",
    default: "text-sm py-1 px-3",
    lg: "text-base py-1.5 px-4",
  };

  if (loading && !workflow) {
    return (
      <Badge
        variant="outline"
        className={`${sizeClasses[size]} ${className} animate-pulse`}
      >
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Cargando...
      </Badge>
    );
  }

  if (error || !workflow) {
    return (
      <Badge
        variant="outline"
        className={`${sizeClasses[size]} ${className} text-muted-foreground`}
      >
        Sin workflow
      </Badge>
    );
  }

  const hasTransitions = workflow.availableTransitions.length > 0;

  return (
    <>
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {/* Current State Badge */}
        <Badge
          style={{
            backgroundColor: `${workflow.currentStateColor}20`,
            color: workflow.currentStateColor,
            borderColor: `${workflow.currentStateColor}40`,
          }}
          className={`${sizeClasses[size]} border font-medium`}
        >
          {workflow.currentStateDisplay}
        </Badge>

        {/* Transitions Dropdown */}
        {showTransitions && hasTransitions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={transitioning}
                className="h-7 px-2"
              >
                {transitioning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <span className="text-xs">Acciones</span>
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Transiciones disponibles
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workflow.availableTransitions.map((transition) => {
                const Icon = getIcon(transition.icon);
                const isDestructive =
                  transition.buttonVariant === "destructive";

                return (
                  <DropdownMenuItem
                    key={transition.id}
                    onClick={() => handleTransitionClick(transition)}
                    className={
                      isDestructive
                        ? "text-destructive focus:text-destructive"
                        : ""
                    }
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <div className="flex flex-col">
                      <span>{transition.displayName}</span>
                      {transition.description && (
                        <span className="text-xs text-muted-foreground">
                          {transition.description}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchWorkflow}
          disabled={loading}
          className="h-7 w-7 p-0"
          title="Actualizar estado"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open)
            setConfirmDialog({ open: false, transition: null, comment: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.transition?.displayName}</DialogTitle>
            <DialogDescription>
              {confirmDialog.transition?.confirmationMessage ||
                confirmDialog.transition?.description ||
                "¿Estás seguro de realizar esta acción?"}
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.transition?.requireComment && (
            <div className="space-y-2">
              <Label htmlFor="comment">
                Comentario {confirmDialog.transition.requireComment && "*"}
              </Label>
              <Textarea
                id="comment"
                placeholder="Escribe un comentario..."
                value={confirmDialog.comment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setConfirmDialog((prev) => ({
                    ...prev,
                    comment: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog({ open: false, transition: null, comment: "" })
              }
              disabled={transitioning}
            >
              Cancelar
            </Button>
            <Button
              variant={
                confirmDialog.transition?.buttonVariant === "destructive"
                  ? "destructive"
                  : "default"
              }
              onClick={handleConfirm}
              disabled={transitioning}
            >
              {transitioning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorkflowStatus;

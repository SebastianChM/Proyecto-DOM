"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, History, Info, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface SaveRunDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: SaveRunData) => Promise<void>;
  defaultModelVersion?: string;
}

export interface SaveRunData {
  runName: string;
  modelVersion: string;
  modelName?: string;
  notes?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SaveRunDialog({
  open,
  onClose,
  onSave,
  defaultModelVersion = "v1.0",
}: SaveRunDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SaveRunData>({
    runName: `Validación ${new Date().toLocaleDateString("es-CL")}`,
    modelVersion: defaultModelVersion,
    modelName: "",
    notes: "",
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Error al guardar el registro");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      onClose();
    }
  };

  const isValid = formData.runName.trim() && formData.modelVersion.trim();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Guardar en Historial</DialogTitle>
              <DialogDescription className="mt-1">
                Guarda esta validación para mantener un registro histórico.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Run Name */}
          <div className="grid gap-2">
            <Label htmlFor="runName" className="text-foreground">
              Nombre del Registro <span className="text-red-500">*</span>
            </Label>
            <Input
              id="runName"
              value={formData.runName}
              onChange={(e) =>
                setFormData({ ...formData, runName: e.target.value })
              }
              placeholder="Ej: Validación Estructural Fase 2"
              disabled={saving}
              className={cn(
                !formData.runName.trim() &&
                  "border-amber-300 focus-visible:ring-amber-400",
              )}
            />
          </div>

          {/* Model Version & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="modelVersion" className="text-foreground">
                Versión del Modelo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="modelVersion"
                value={formData.modelVersion}
                onChange={(e) =>
                  setFormData({ ...formData, modelVersion: e.target.value })
                }
                placeholder="v1.0, Rev A, etc."
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Identifica la versión del modelo
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="modelName" className="text-foreground">
                Nombre del Modelo
              </Label>
              <Input
                id="modelName"
                value={formData.modelName}
                onChange={(e) =>
                  setFormData({ ...formData, modelName: e.target.value })
                }
                placeholder="Edificio Central.rvt"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Opcional</p>
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes" className="text-foreground">
              Notas
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Añade observaciones sobre esta validación..."
              rows={3}
              disabled={saving}
              className="resize-none"
            />
          </div>

          {/* Info Box */}
          <div className="flex gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">
                Beneficios del historial
              </p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>Compara resultados entre versiones del modelo</li>
                <li>Documenta el progreso del proyecto</li>
                <li>Genera reportes para auditorías</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

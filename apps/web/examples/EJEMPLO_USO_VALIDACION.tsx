// =====================================================
// EJEMPLO DE INTEGRACIÓN DEL SISTEMA DE VALIDACIÓN
// Para usar en: frontend/app/dashboard/validation/page.tsx
// =====================================================

"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState } from "react";
import { useNotifications } from "@/context/NotificationContext";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ValidationPageExample() {
  const { user } = useUser();
  const { addNotification, fetchNotifications } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [etData, setEtData] = useState<any[]>([]);
  const [modelData, setModelData] = useState<any[]>([]);

  /**
   * Ejemplo de ejecución de validación con el nuevo sistema
   */
  const runValidation = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setLoading(true);
    try {
      // 1. Llamar al endpoint de validación
      const response = await fetch("/api/validation-runner/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: selectedFile,
          fileName: "Torre-Reforma.rvt",
          fileUrn: "urn:dXJuOmFkc2sud2lwcHJvZDpmcy5maWxlOnZmLkFCQ0RFRg",
          projectId: "project-uuid",
          userId: user.id,

          // Datos de la Engineering Table (del Excel subido)
          etData: [
            {
              tag: "FV-101",
              type: "Ball Valve",
              size: '2"',
              location: "Level 1",
            },
            { tag: "P-205", type: "Centrifugal Pump", power: "50HP" },
            { tag: "V-300", type: "Storage Tank", capacity: "1000L" },
          ],

          // Datos del modelo 3D (extraídos con APS API)
          modelData: [
            { tag: "FV-101", type: "Gate Valve", size: '2"' }, // MISMATCH!
            { tag: "V-300", type: "Storage Tank", capacity: "1000L" },
            { tag: "EXTRA-001", type: "Unknown" }, // UNDOCUMENTED!
            // P-205 MISSING!
          ],

          validationRules: {
            checkTypes: true,
            checkSizes: true,
            checkLocations: false,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 2. Mostrar resultados
        const summary = result.data.summary;
        toast.success(`Validation Complete: ${summary.issues} issues found`);

        // 3. Las notificaciones ya fueron creadas automáticamente por el backend
        // Solo necesitamos refrescar el context
        await fetchNotifications();

        // 4. Mostrar detalles
        console.log("Validation Results:", result.data.validation);

        // El sistema automáticamente:
        // ✅ Guardó la validación en ValidationRun
        // ✅ Creó ValidationIssue para cada problema
        // ✅ Generó Notifications (visible en la campana)
        // ✅ Detectó cambios si hay validación previa
      } else {
        toast.error("Validation failed");
      }
    } catch (error) {
      console.error("Error running validation:", error);
      toast.error("Failed to run validation");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Ver historial de validaciones
   */
  const viewHistory = async () => {
    try {
      const response = await fetch(
        `/api/validation-runner/history/${selectedFile}`,
      );
      const result = await response.json();

      if (result.success) {
        console.log("Validation History:", result.data);
        // Mostrar en UI
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  /**
   * Comparar dos validaciones
   */
  const compareValidations = async (id1: string, id2: string) => {
    try {
      const response = await fetch(`/api/validations/compare/${id1}/${id2}`);
      const result = await response.json();

      if (result.success) {
        console.log("Comparison:", result.data);
        // result.data.changes.newIssues
        // result.data.changes.resolvedIssues
        // result.data.changes.changedIssues
      }
    } catch (error) {
      console.error("Error comparing validations:", error);
    }
  };

  /**
   * Obtener issues de una validación
   */
  const getIssues = async (validationId: string) => {
    try {
      const response = await fetch(
        `/api/validations/${validationId}/issues?status=OPEN`,
      );
      const result = await response.json();

      if (result.success) {
        console.log("Open Issues:", result.data);
        // Mostrar en tabla
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
    }
  };

  /**
   * Resolver una incidencia
   */
  const resolveIssue = async (issueId: string) => {
    try {
      const response = await fetch(`/api/validations/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          resolvedBy: user?.id,
          resolutionNotes: "Fixed in latest model update",
        }),
      });

      if (response.ok) {
        toast.success("Issue resolved");

        // Crear notificación de resolución
        await addNotification({
          type: "ISSUE_RESOLVED",
          title: "Issue Resolved",
          message: "An issue has been marked as resolved",
          priority: "NORMAL",
          issueId,
        });
      }
    } catch (error) {
      console.error("Error resolving issue:", error);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Structure Validation</h1>

      {/* La campana de notificaciones ya está visible globalmente */}

      <Button onClick={runValidation} disabled={loading} className="mb-4">
        {loading ? "Validating..." : "Run Validation"}
      </Button>

      <Button onClick={viewHistory} variant="outline" className="ml-4">
        View History
      </Button>

      {/* Resto de la UI... */}
    </div>
  );
}

// =====================================================
// RESUMEN DE FUNCIONALIDADES DISPONIBLES
// =====================================================

/*

🔔 NOTIFICACIONES AUTOMÁTICAS:
- Al completar validación
- Al detectar issues críticos
- Al detectar cambios entre versiones
- Todas visibles en la campana global

💾 PERSISTENCIA:
- Todas las validaciones guardadas
- Historial completo de issues
- Comparación entre versiones
- Notificaciones permanentes

🔄 DETECCIÓN AUTOMÁTICA:
- Sistema compara con validación anterior
- Identifica nuevos issues
- Identifica issues resueltos
- Crea notificación FILE_CHANGED automáticamente

📊 ESTADÍSTICAS:
- GET /api/validations/stats/summary
- Agregación por proyecto, archivo, usuario
- Métricas de mejora temporal

🎯 GESTIÓN DE ISSUES:
- Marcar como RESOLVED, ACKNOWLEDGED, IGNORED
- Asignar severidades
- Tracking de resolución
- Comentarios y notas

*/

// =====================================================
// TIPOS DISPONIBLES (ya importables desde Context)
// =====================================================

/*
import { 
  ValidationIssue, 
  ValidationRun, 
  Notification,
  useNotifications 
} from '@/context/NotificationContext'
*/

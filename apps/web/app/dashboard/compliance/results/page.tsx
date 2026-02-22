/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";
import { IssuesList } from "@/components/compliance/IssuesList";
import {
  SaveRunDialog,
  SaveRunData,
} from "@/components/compliance/SaveRunDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Settings,
  Download,
  FileSpreadsheet,
  FileText,
  Save,
  FolderOpen,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {} from "@/lib/utils";
import { API_CONFIG } from "@/lib/config";
import { logger } from "@/lib/logger";

const API_BASE = API_CONFIG.BASE_URL;

interface Project {
  id: string;
  name: string;
  description?: string;
  _count: {
    files: number;
  };
}

export default function ComplianceResultsPage() {
  // State
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("demo");

  // Loading & Status States
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch available projects
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      setProjectError(null);

      try {
        const res = await fetch(`${API_BASE}/api/compliance-v2/runs/projects`);
        if (!res.ok) {
          throw new Error("No se pudieron cargar los proyectos");
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setProjects(data);
          if (data.length > 0 && selectedProjectId === "demo") {
            setSelectedProjectId(data[0].id);
          }
        }
      } catch (error: any) {
        setProjectError(error.message || "Error de conexión");
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  // Handle saving run with model version
  const handleSaveRun = async (data: SaveRunData) => {
    if (!selectedRunId) return;

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/compliance-v2/export/${selectedRunId}/save`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        throw new Error("Error al guardar el resultado");
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error: any) {
      setSaveError(error.message || "Error al guardar");
      setSaveStatus("error");
    }
  };

  // Handle exports
  const handleExportExcel = () => {
    if (!selectedRunId) return;
    window.open(
      `${API_BASE}/api/compliance-v2/export/${selectedRunId}/excel`,
      "_blank",
    );
  };

  const handleExportPDF = () => {
    if (!selectedRunId) return;
    window.open(
      `${API_BASE}/api/compliance-v2/export/${selectedRunId}/pdf`,
      "_blank",
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Left Section: Navigation & Title */}
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>

              <div className="h-6 w-px bg-border" />

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {selectedRunId
                      ? "Detalle de Validación"
                      : "Validación de Compliance"}
                  </h1>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {selectedRunId
                      ? "Incidencias encontradas en la validación"
                      : "Verifica el cumplimiento de tus modelos"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-2">
              {/* Project Selector */}
              {!selectedRunId && (
                <div className="hidden md:flex items-center gap-2 mr-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  {loadingProjects ? (
                    <Skeleton className="h-9 w-[180px]" />
                  ) : (
                    <Select
                      value={selectedProjectId}
                      onValueChange={(value) => {
                        setSelectedProjectId(value);
                        setSelectedRunId(null);
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Proyecto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo">Modo Demostración</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Issue Detail Actions */}
              {selectedRunId && (
                <>
                  {/* Save Status Indicator */}
                  {saveStatus === "success" && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mr-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Guardado</span>
                    </div>
                  )}

                  {/* Save Button */}
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowSaveDialog(true)}
                    disabled={saveStatus === "saving"}
                  >
                    {saveStatus === "saving" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Guardar</span>
                  </Button>

                  {/* Export Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Exportar</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={handleExportExcel}
                        className="gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        Excel (CSV)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleExportPDF}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4 text-red-600" />
                        Reporte (PDF)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Back Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRunId(null)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Volver</span>
                  </Button>
                </>
              )}

              {/* Settings */}
              <Link href="/dashboard/compliance/rules">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden lg:inline">Configurar Reglas</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Mobile Project Selector */}
        {!selectedRunId && (
          <div className="md:hidden mb-6">
            <Card className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-2">Proyecto</p>
                    {loadingProjects ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={selectedProjectId}
                        onValueChange={(value) => {
                          setSelectedProjectId(value);
                          setSelectedRunId(null);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar proyecto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="demo">
                            Modo Demostración
                          </SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Project Error */}
        {projectError && !selectedRunId && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al cargar proyectos</AlertTitle>
            <AlertDescription>
              {projectError}. Puedes continuar usando el modo demostración.
            </AlertDescription>
          </Alert>
        )}

        {/* Save Error */}
        {saveError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error al guardar</AlertTitle>
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        {selectedRunId ? (
          <IssuesList
            runId={selectedRunId}
            onViewElement={(elementId) => {
              logger.info("View element", { elementId });
            }}
          />
        ) : (
          <ComplianceDashboard
            projectId={
              selectedProjectId === "demo" ? "test-project" : selectedProjectId
            }
            onViewIssues={(runId) => setSelectedRunId(runId)}
          />
        )}
      </main>

      {/* Save Run Dialog */}
      <SaveRunDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveRun}
        defaultModelVersion="v1.0"
      />
    </div>
  );
}

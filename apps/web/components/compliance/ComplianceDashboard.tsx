"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  FileCheck,
  Clock,
  Target,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

interface ComplianceRun {
  id: string;
  status: string;
  modelUrn: string;
  modelName?: string;
  totalElements: number;
  failedCount: number;
  complianceScore: number;
  startedAt: string;
  completedAt?: string;
  ruleset: {
    name: string;
    discipline: string;
  };
  _count: {
    issues: number;
  };
}

interface Ruleset {
  id: string;
  name: string;
  discipline: string;
  _count: {
    rules: number;
  };
}

interface Model {
  id: string;
  name: string;
  type: string;
  apsUrn: string;
}

interface ComplianceDashboardProps {
  projectId: string;
  onViewIssues?: (runId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

import { API_CONFIG } from "@/lib/config";
const API_BASE = API_CONFIG.BASE_URL;

const STATUS_CONFIG = {
  COMPLETED: {
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
    label: "Completado",
  },
  RUNNING: {
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: Loader2,
    label: "En proceso",
  },
  FAILED: {
    color: "bg-red-500/10 text-red-700 dark:text-red-400",
    icon: AlertTriangle,
    label: "Fallido",
  },
};

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  variant = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "danger";
  loading?: boolean;
}) {
  const variantStyles = {
    default: "bg-card border-border",
    success:
      "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
    warning:
      "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
    danger: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
  };

  const iconStyles = {
    default: "text-primary",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  const trendStyles = {
    up: "text-emerald-600 dark:text-emerald-400",
    down: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  };

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  if (loading) {
    return (
      <Card
        className={cn(
          "border transition-all duration-200",
          variantStyles[variant],
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-8 w-20 mt-4" />
          <Skeleton className="h-4 w-24 mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border transition-all duration-200 hover:shadow-xs",
        variantStyles[variant],
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "p-2.5 rounded-lg",
              variant === "default" ? "bg-primary/10" : "bg-current/10",
            )}
          >
            <Icon className={cn("h-5 w-5", iconStyles[variant])} />
          </div>
          {trend && trendValue && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                trendStyles[trend],
              )}
            >
              <TrendIcon className="h-4 w-4" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// RUN CARD COMPONENT
// ============================================================================

function RunCard({
  run,
  onViewIssues,
}: {
  run: ComplianceRun;
  onViewIssues?: (runId: string) => void;
}) {
  const statusConfig =
    STATUS_CONFIG[run.status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.COMPLETED;
  const StatusIcon = statusConfig.icon;

  const scoreVariant =
    run.complianceScore >= 80
      ? "success"
      : run.complianceScore >= 50
        ? "warning"
        : "danger";
  const scoreStyles = {
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card
      className="border border-border hover:border-primary/30 transition-all duration-200 hover:shadow-xs group cursor-pointer"
      onClick={() => onViewIssues?.(run.id)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", statusConfig.color)}
              >
                <StatusIcon
                  className={cn(
                    "h-3 w-3 mr-1",
                    run.status === "RUNNING" && "animate-spin",
                  )}
                />
                {statusConfig.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {run.ruleset.name}
              </Badge>
            </div>

            <h4
              className="font-semibold text-foreground truncate max-w-[300px]"
              title={run.modelName || run.modelUrn || "Modelo sin nombre"}
            >
              {run.modelName ||
                (run.modelUrn !== "demo" && run.modelUrn !== "demo-model"
                  ? run.modelUrn.split("/").pop()?.substring(0, 30) + "..."
                  : "Validación de prueba")}
            </h4>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(run.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5" />
                {run.totalElements} elementos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p
                className={cn("text-2xl font-bold", scoreStyles[scoreVariant])}
              >
                {run.complianceScore}%
              </p>
              <p className="text-xs text-muted-foreground">
                {run._count.issues}{" "}
                {run._count.issues === 1 ? "incidencia" : "incidencias"}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Card Skeleton */}
      <Card className="border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <StatCard key={i} label="" value="" icon={Target} loading />
        ))}
      </div>

      {/* Runs List Skeleton */}
      <Card className="border border-border">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ onRunDemo }: { onRunDemo: () => void }) {
  return (
    <Card className="border border-dashed border-border">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="p-4 rounded-full bg-primary/10 mb-4">
          <FileCheck className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Sin validaciones registradas
        </h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Ejecuta tu primera validación para verificar el cumplimiento de tu
          modelo contra las reglas configuradas en el sistema.
        </p>
        <Button onClick={onRunDemo} className="gap-2">
          <Play className="h-4 w-4" />
          Ejecutar primera validación
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ERROR STATE
// ============================================================================

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive" className="border-red-200 dark:border-red-900">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error al cargar datos</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ComplianceDashboard({
  projectId,
  onViewIssues,
}: ComplianceDashboardProps) {
  // State
  const [runs, setRuns] = useState<ComplianceRun[]>([]);
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedRuleset, setSelectedRuleset] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningMessage, setRunningMessage] = useState<string>("");

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [runsRes, rulesetsRes] = await Promise.all([
        fetch(`${API_BASE}/api/compliance-v2/runs?projectId=${projectId}`),
        fetch(`${API_BASE}/api/compliance-v2/rulesets`),
      ]);

      if (!runsRes.ok || !rulesetsRes.ok) {
        throw new Error("No se pudieron cargar los datos del servidor");
      }

      const runsData = await runsRes.json();
      const rulesetsData = await rulesetsRes.json();

      setRuns(Array.isArray(runsData) ? runsData : []);
      setRulesets(Array.isArray(rulesetsData) ? rulesetsData : []);

      if (
        Array.isArray(rulesetsData) &&
        rulesetsData.length > 0 &&
        !selectedRuleset
      ) {
        setSelectedRuleset(rulesetsData[0].id);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Error de conexión con el servidor");
      setRuns([]);
      setRulesets([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedRuleset]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/compliance-v2/runs/models?projectId=${projectId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0 && !selectedModel) {
          setSelectedModel(data[0].apsUrn);
        }
      }
    } catch (err) {
      logger.error("Failed to fetch models", {
        error: (err as Error)?.message,
      });
      setModels([]);
    }
  }, [projectId, selectedModel]);

  useEffect(() => {
    fetchData();
    fetchModels();
  }, [fetchData, fetchModels]);

  // Handle running validation
  const handleRunDemo = async () => {
    if (!selectedRuleset) return;

    setRunning(true);
    setRunningMessage("Generando datos de prueba...");
    setError(null);

    try {
      setRunningMessage("Ejecutando validación...");

      const res = await fetch(`${API_BASE}/api/compliance-v2/runs/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rulesetId: selectedRuleset,
          projectId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al ejecutar la validación");
      }

      const result = await res.json();
      setRunningMessage("Procesando resultados...");

      if (result.runId) {
        const newRun: ComplianceRun = {
          id: result.runId,
          status: result.status || "COMPLETED",
          modelUrn: "demo",
          modelName: "Validación de prueba",
          totalElements: result.totalElements || 0,
          failedCount: result.failedCount || 0,
          complianceScore: result.complianceScore || 0,
          startedAt: new Date().toISOString(),
          ruleset: {
            name:
              rulesets.find((r) => r.id === selectedRuleset)?.name || "Ruleset",
            discipline: "GENERAL",
          },
          _count: { issues: result.issues?.length || 0 },
        };
        setRuns((prev) => [newRun, ...prev]);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Error al ejecutar la validación");
    } finally {
      setRunning(false);
      setRunningMessage("");
    }
  };

  const handleRunModel = async () => {
    if (!selectedRuleset || !selectedModel) return;

    setRunning(true);
    setRunningMessage("Extrayendo propiedades del modelo...");
    setError(null);

    try {
      const model = models.find((m) => m.apsUrn === selectedModel);
      setRunningMessage(`Analizando ${model?.name || "modelo"}...`);

      const res = await fetch(`${API_BASE}/api/compliance-v2/runs/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rulesetId: selectedRuleset,
          projectId,
          modelUrn: selectedModel,
          modelName: model?.name,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error al validar el modelo");
      }

      const result = await res.json();
      setRunningMessage("Procesando resultados...");

      if (result.runId) {
        const newRun: ComplianceRun = {
          id: result.runId,
          status: result.status || "COMPLETED",
          modelUrn: selectedModel,
          modelName: model?.name,
          totalElements: result.totalElements || 0,
          failedCount: result.failedCount || 0,
          complianceScore: result.complianceScore || 0,
          startedAt: new Date().toISOString(),
          ruleset: {
            name:
              rulesets.find((r) => r.id === selectedRuleset)?.name || "Ruleset",
            discipline: "GENERAL",
          },
          _count: { issues: result.issues?.length || 0 },
        };
        setRuns((prev) => [newRun, ...prev]);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Error al validar el modelo");
    } finally {
      setRunning(false);
      setRunningMessage("");
    }
  };

  // Calculate statistics
  const latestRun = runs[0];
  const avgScore =
    runs.length > 0
      ? Math.round(
          runs.reduce((sum, r) => sum + (r.complianceScore || 0), 0) /
            runs.length,
        )
      : 0;
  const totalIssues = runs.reduce((sum, r) => sum + (r._count?.issues || 0), 0);
  const previousScore = runs[1]?.complianceScore;
  const scoreTrend =
    latestRun && previousScore
      ? latestRun.complianceScore > previousScore
        ? "up"
        : latestRun.complianceScore < previousScore
          ? "down"
          : "neutral"
      : undefined;

  // Loading state
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Action Card */}
      <Card className="border border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Ejecutar Validación</CardTitle>
          <CardDescription>
            Selecciona un conjunto de reglas y un modelo para verificar su
            cumplimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {/* Ruleset Selector */}
            <Select
              value={selectedRuleset}
              onValueChange={setSelectedRuleset}
              disabled={running}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Seleccionar reglas" />
              </SelectTrigger>
              <SelectContent>
                {rulesets.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay reglas configuradas
                  </SelectItem>
                ) : (
                  rulesets.map((rs) => (
                    <SelectItem key={rs.id} value={rs.id}>
                      {rs.name} ({rs._count.rules} reglas)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Model Selector */}
            {models.length > 0 && (
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={running}
              >
                <SelectTrigger
                  className="w-[260px]"
                  title={models.find((m) => m.apsUrn === selectedModel)?.name}
                >
                  <SelectValue placeholder="Seleccionar modelo" />
                </SelectTrigger>
                <SelectContent className="max-w-[350px]">
                  {models.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.apsUrn}
                      className="max-w-full"
                    >
                      <span className="flex items-center gap-2" title={m.name}>
                        <span className="truncate max-w-[200px]">
                          {m.name.length > 25
                            ? m.name.substring(0, 25) + "..."
                            : m.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({m.type})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {/* Demo Button */}
              <Button
                variant="outline"
                onClick={handleRunDemo}
                disabled={running || !selectedRuleset}
                className="gap-2"
              >
                {running && !selectedModel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Prueba Demo
              </Button>

              {/* Real Model Button */}
              {models.length > 0 && (
                <Button
                  onClick={handleRunModel}
                  disabled={running || !selectedRuleset || !selectedModel}
                  className="gap-2"
                >
                  {running && selectedModel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4" />
                  )}
                  Validar Modelo
                </Button>
              )}
            </div>
          </div>

          {/* Running Status */}
          {running && runningMessage && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{runningMessage}</span>
            </div>
          )}

          {/* No Models Message */}
          {models.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              No hay modelos disponibles en este proyecto. Puedes usar el modo
              de prueba para verificar la configuración de reglas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Última Puntuación"
          value={latestRun ? `${latestRun.complianceScore}%` : "--"}
          icon={Target}
          variant={
            latestRun
              ? latestRun.complianceScore >= 80
                ? "success"
                : latestRun.complianceScore >= 50
                  ? "warning"
                  : "danger"
              : "default"
          }
          trend={scoreTrend}
          trendValue={
            previousScore
              ? `${Math.abs(latestRun.complianceScore - previousScore)}%`
              : undefined
          }
        />
        <StatCard
          label="Promedio General"
          value={runs.length > 0 ? `${avgScore}%` : "--"}
          icon={TrendingUp}
        />
        <StatCard
          label="Total Validaciones"
          value={runs.length}
          icon={FileCheck}
        />
        <StatCard
          label="Incidencias Totales"
          value={totalIssues}
          icon={AlertTriangle}
          variant={totalIssues > 0 ? "warning" : "default"}
        />
      </div>

      {/* Runs List */}
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Validaciones Recientes</CardTitle>
            <CardDescription>
              Historial de validaciones ejecutadas en el proyecto
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <EmptyState onRunDemo={handleRunDemo} />
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} onViewIssues={onViewIssues} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

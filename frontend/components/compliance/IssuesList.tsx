"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertCircle,
    AlertTriangle,
    Info,
    MoreVertical,
    Check,
    X,
    Eye,
    Search,
    Filter,
    RefreshCw,
    XCircle,
    CheckCircle2,
    MinusCircle,
    Flag,
    Loader2,
    FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface ComplianceIssue {
    id: string;
    ruleName: string;
    elementId: string;
    elementName: string;
    elementCategory: string;
    propertyName: string;
    expectedValue: string;
    actualValue: string;
    deviation?: string;
    severity: "CRITICAL" | "WARNING" | "INFO";
    status: "OPEN" | "RESOLVED" | "IGNORED" | "FALSE_POSITIVE";
    createdAt: string;
}

interface IssuesListProps {
    runId: string;
    onViewElement?: (elementId: string) => void;
    onExport?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const SEVERITY_CONFIG = {
    CRITICAL: {
        icon: XCircle,
        badgeClass: "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
        pillClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
        iconClass: "text-red-600 dark:text-red-400",
        label: "Crítico",
        priority: 1,
    },
    WARNING: {
        icon: AlertTriangle,
        badgeClass: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900",
        pillClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
        iconClass: "text-amber-600 dark:text-amber-400",
        label: "Advertencia",
        priority: 2,
    },
    INFO: {
        icon: Info,
        badgeClass: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900",
        pillClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
        iconClass: "text-blue-600 dark:text-blue-400",
        label: "Información",
        priority: 3,
    },
};

const STATUS_CONFIG = {
    OPEN: {
        icon: AlertCircle,
        badgeClass: "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400",
        label: "Pendiente"
    },
    RESOLVED: {
        icon: CheckCircle2,
        badgeClass: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400",
        label: "Resuelto"
    },
    IGNORED: {
        icon: MinusCircle,
        badgeClass: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400",
        label: "Ignorado"
    },
    FALSE_POSITIVE: {
        icon: Flag,
        badgeClass: "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400",
        label: "Falso Positivo"
    },
};

// ============================================================================
// LOADING SKELETON
// ============================================================================

function IssuesListSkeleton() {
    return (
        <div className="space-y-4">
            {/* Summary Pills Skeleton */}
            <div className="flex gap-3">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-32 rounded-lg" />
                ))}
            </div>

            {/* Filters Skeleton */}
            <div className="flex gap-3">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 w-40 rounded-lg" />
                <Skeleton className="h-10 w-40 rounded-lg" />
            </div>

            {/* Table Skeleton */}
            <Card className="border border-border">
                <CardContent className="p-0">
                    <div className="p-4 space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-lg" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
                {filtered ? (
                    <Search className="h-10 w-10 text-muted-foreground" />
                ) : (
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                )}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
                {filtered
                    ? "Sin resultados"
                    : "Sin incidencias"}
            </h3>
            <p className="text-muted-foreground max-w-md">
                {filtered
                    ? "No se encontraron incidencias con los filtros aplicados. Intenta ajustar los criterios de búsqueda."
                    : "No se encontraron incidencias en esta validación. El modelo cumple con todas las reglas configuradas."}
            </p>
        </div>
    );
}

// ============================================================================
// SUMMARY PILL
// ============================================================================

function SummaryPill({
    severity,
    count,
    active,
    onClick
}: {
    severity: keyof typeof SEVERITY_CONFIG;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    const config = SEVERITY_CONFIG[severity];
    const Icon = config.icon;

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200",
                config.pillClass,
                active && "ring-2 ring-primary ring-offset-2 dark:ring-offset-background"
            )}
        >
            <Icon className={cn("h-5 w-5", config.iconClass)} />
            <div className="text-left">
                <p className={cn("text-xl font-bold", config.iconClass)}>{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
            </div>
        </button>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function IssuesList({ runId, onViewElement, onExport }: IssuesListProps) {
    // State
    const [issues, setIssues] = useState<ComplianceIssue[]>([]);
    const [filteredIssues, setFilteredIssues] = useState<ComplianceIssue[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Loading & Error States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null);

    // Fetch issues
    const fetchIssues = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/api/compliance-v2/runs/${runId}/issues`);
            if (!res.ok) {
                throw new Error("No se pudieron cargar las incidencias");
            }
            const data = await res.json();
            setIssues(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err.message || "Error de conexión");
            setIssues([]);
        } finally {
            setLoading(false);
        }
    }, [runId]);

    useEffect(() => {
        fetchIssues();
    }, [fetchIssues]);

    // Apply filters
    useEffect(() => {
        let result = [...issues];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (issue) =>
                    issue.ruleName.toLowerCase().includes(term) ||
                    issue.elementName.toLowerCase().includes(term) ||
                    issue.elementCategory.toLowerCase().includes(term) ||
                    issue.propertyName.toLowerCase().includes(term)
            );
        }

        if (severityFilter !== "all") {
            result = result.filter((issue) => issue.severity === severityFilter);
        }

        if (statusFilter !== "all") {
            result = result.filter((issue) => issue.status === statusFilter);
        }

        setFilteredIssues(result);
    }, [issues, searchTerm, severityFilter, statusFilter]);

    // Update issue status
    const handleUpdateStatus = async (issueId: string, newStatus: string) => {
        setUpdatingIssueId(issueId);

        try {
            const res = await fetch(`${API_BASE}/api/compliance-v2/runs/issues/${issueId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                throw new Error("Error al actualizar");
            }

            setIssues((prev) =>
                prev.map((issue) =>
                    issue.id === issueId
                        ? { ...issue, status: newStatus as ComplianceIssue["status"] }
                        : issue
                )
            );
        } catch (err: any) {
            console.error("Failed to update issue status:", err);
        } finally {
            setUpdatingIssueId(null);
        }
    };

    // Group issues by severity
    const counts = {
        CRITICAL: issues.filter((i) => i.severity === "CRITICAL").length,
        WARNING: issues.filter((i) => i.severity === "WARNING").length,
        INFO: issues.filter((i) => i.severity === "INFO").length,
    };

    // Loading state
    if (loading) {
        return <IssuesListSkeleton />;
    }

    // Error state
    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error al cargar incidencias</AlertTitle>
                <AlertDescription className="mt-2">
                    <p className="mb-3">{error}</p>
                    <Button variant="outline" size="sm" onClick={fetchIssues} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Reintentar
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Pills */}
            <div className="flex flex-wrap gap-3">
                <SummaryPill
                    severity="CRITICAL"
                    count={counts.CRITICAL}
                    active={severityFilter === "CRITICAL"}
                    onClick={() => setSeverityFilter(severityFilter === "CRITICAL" ? "all" : "CRITICAL")}
                />
                <SummaryPill
                    severity="WARNING"
                    count={counts.WARNING}
                    active={severityFilter === "WARNING"}
                    onClick={() => setSeverityFilter(severityFilter === "WARNING" ? "all" : "WARNING")}
                />
                <SummaryPill
                    severity="INFO"
                    count={counts.INFO}
                    active={severityFilter === "INFO"}
                    onClick={() => setSeverityFilter(severityFilter === "INFO" ? "all" : "INFO")}
                />
            </div>

            {/* Filters */}
            <Card className="border border-border">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por regla, elemento o propiedad..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={severityFilter} onValueChange={setSeverityFilter}>
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Severidad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las severidades</SelectItem>
                                <SelectItem value="CRITICAL">Crítico</SelectItem>
                                <SelectItem value="WARNING">Advertencia</SelectItem>
                                <SelectItem value="INFO">Información</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[160px]">
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="OPEN">Pendiente</SelectItem>
                                <SelectItem value="RESOLVED">Resuelto</SelectItem>
                                <SelectItem value="IGNORED">Ignorado</SelectItem>
                                <SelectItem value="FALSE_POSITIVE">Falso Positivo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Issues Table */}
            <Card className="border border-border overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Incidencias</CardTitle>
                            <CardDescription>
                                {filteredIssues.length} de {issues.length} incidencias
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchIssues}
                            className="gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Actualizar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredIssues.length === 0 ? (
                        <EmptyState filtered={searchTerm !== "" || severityFilter !== "all" || statusFilter !== "all"} />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/20">
                                        <TableHead className="w-[100px]">Severidad</TableHead>
                                        <TableHead>Regla</TableHead>
                                        <TableHead>Elemento</TableHead>
                                        <TableHead>Propiedad</TableHead>
                                        <TableHead>Esperado</TableHead>
                                        <TableHead>Encontrado</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredIssues.map((issue) => {
                                        const severity = SEVERITY_CONFIG[issue.severity];
                                        const status = STATUS_CONFIG[issue.status];
                                        const SeverityIcon = severity.icon;
                                        const StatusIcon = status.icon;
                                        const isUpdating = updatingIssueId === issue.id;

                                        return (
                                            <TableRow
                                                key={issue.id}
                                                className={cn(
                                                    "transition-colors",
                                                    isUpdating && "opacity-50"
                                                )}
                                            >
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn("gap-1 font-medium", severity.badgeClass)}
                                                    >
                                                        <SeverityIcon className="h-3 w-3" />
                                                        {severity.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-foreground">
                                                        {issue.ruleName}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-foreground">
                                                            {issue.elementName}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {issue.elementCategory}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                                                        {issue.propertyName}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                                                        {issue.expectedValue}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-red-600 dark:text-red-400 font-mono text-sm">
                                                        {issue.actualValue}
                                                    </span>
                                                    {issue.deviation && (
                                                        <span className="text-xs text-muted-foreground ml-1">
                                                            (Δ {issue.deviation})
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn("gap-1", status.badgeClass)}
                                                    >
                                                        {isUpdating ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <StatusIcon className="h-3 w-3" />
                                                        )}
                                                        {status.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                disabled={isUpdating}
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            {onViewElement && (
                                                                <>
                                                                    <DropdownMenuItem
                                                                        onClick={() => onViewElement(issue.elementId)}
                                                                        className="gap-2"
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                        Ver en modelo
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                </>
                                                            )}
                                                            <DropdownMenuItem
                                                                onClick={() => handleUpdateStatus(issue.id, "RESOLVED")}
                                                                className="gap-2"
                                                            >
                                                                <Check className="h-4 w-4 text-emerald-600" />
                                                                Marcar resuelto
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleUpdateStatus(issue.id, "IGNORED")}
                                                                className="gap-2"
                                                            >
                                                                <X className="h-4 w-4 text-gray-600" />
                                                                Ignorar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleUpdateStatus(issue.id, "FALSE_POSITIVE")}
                                                                className="gap-2"
                                                            >
                                                                <Flag className="h-4 w-4 text-purple-600" />
                                                                Falso positivo
                                                            </DropdownMenuItem>
                                                            {issue.status !== "OPEN" && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleUpdateStatus(issue.id, "OPEN")}
                                                                        className="gap-2"
                                                                    >
                                                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                                                        Reabrir
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertCircle,
    AlertTriangle,
    Info,
    MoreVertical,
    Plus,
    Edit2,
    Trash2,
    Power,
    PowerOff,
    FileText,
    Zap,
    Building,
    Wrench,
    Home,
} from "lucide-react";
import { RuleBuilder } from "./RuleBuilder";

interface Rule {
    id: string;
    name: string;
    description?: string;
    targetCategory: string;
    targetNamePattern?: string;
    propertyName: string;
    operator: string;
    expectedValue: string;
    unit?: string;
    tolerance?: number;
    severity: "CRITICAL" | "WARNING" | "INFO";
    sourceDocument?: string;
    sourcePage?: number;
    rulesetId: string;
    isActive: boolean;
}

interface Ruleset {
    id: string;
    name: string;
    description?: string;
    discipline: string;
    isDefault: boolean;
    rules: Rule[];
    _count: {
        rules: number;
        runs: number;
    };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const disciplineIcons: Record<string, React.ReactNode> = {
    ELECTRICAL: <Zap className="h-5 w-5 text-yellow-500" />,
    STRUCTURAL: <Building className="h-5 w-5 text-gray-600" />,
    MEP: <Wrench className="h-5 w-5 text-blue-500" />,
    ARCHITECTURAL: <Home className="h-5 w-5 text-green-500" />,
};

const severityConfig = {
    CRITICAL: {
        icon: AlertCircle,
        color: "text-red-600",
        bg: "bg-red-100",
        label: "Crítico",
    },
    WARNING: {
        icon: AlertTriangle,
        color: "text-yellow-600",
        bg: "bg-yellow-100",
        label: "Advertencia",
    },
    INFO: {
        icon: Info,
        color: "text-blue-600",
        bg: "bg-blue-100",
        label: "Info",
    },
};

export function RulesetManager() {
    const [rulesets, setRulesets] = useState<Ruleset[]>([]);
    const [selectedRuleset, setSelectedRuleset] = useState<Ruleset | null>(null);
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRuleBuilder, setShowRuleBuilder] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | undefined>(undefined);

    // Load rulesets
    useEffect(() => {
        const fetchRulesets = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/compliance-v2/rulesets`);
                const data = await res.json();
                setRulesets(data);
                if (data.length > 0 && !selectedRuleset) {
                    setSelectedRuleset(data[0]);
                }
            } catch (error) {
                console.error("Failed to load rulesets:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRulesets();
    }, []);

    // Load rules when ruleset changes
    useEffect(() => {
        if (!selectedRuleset) return;

        const fetchRules = async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/api/compliance-v2/rules?rulesetId=${selectedRuleset.id}`
                );
                const data = await res.json();
                setRules(data);
            } catch (error) {
                console.error("Failed to load rules:", error);
            }
        };
        fetchRules();
    }, [selectedRuleset]);

    const handleSaveRule = async (ruleData: Omit<Rule, "id" | "isActive">) => {
        try {
            const url = editingRule
                ? `${API_BASE}/api/compliance-v2/rules/${editingRule.id}`
                : `${API_BASE}/api/compliance-v2/rules`;

            const method = editingRule ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ruleData),
            });

            if (!res.ok) throw new Error("Failed to save rule");

            // Refresh rules
            const rulesRes = await fetch(
                `${API_BASE}/api/compliance-v2/rules?rulesetId=${selectedRuleset?.id}`
            );
            const rulesData = await rulesRes.json();
            setRules(rulesData);

            setShowRuleBuilder(false);
            setEditingRule(undefined);
        } catch (error) {
            console.error("Failed to save rule:", error);
            throw error;
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        if (!confirm("¿Estás seguro de eliminar esta regla?")) return;

        try {
            await fetch(`${API_BASE}/api/compliance-v2/rules/${ruleId}`, {
                method: "DELETE",
            });
            setRules((prev) => prev.filter((r) => r.id !== ruleId));
        } catch (error) {
            console.error("Failed to delete rule:", error);
        }
    };

    const handleToggleRule = async (rule: Rule) => {
        try {
            await fetch(`${API_BASE}/api/compliance-v2/rules/${rule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !rule.isActive }),
            });
            setRules((prev) =>
                prev.map((r) =>
                    r.id === rule.id ? { ...r, isActive: !r.isActive } : r
                )
            );
        } catch (error) {
            console.error("Failed to toggle rule:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Ruleset Selection */}
            <div className="flex gap-4 overflow-x-auto pb-2">
                {rulesets.map((rs) => (
                    <Card
                        key={rs.id}
                        className={`min-w-[250px] cursor-pointer transition-all ${selectedRuleset?.id === rs.id
                                ? "ring-2 ring-blue-500 shadow-lg"
                                : "hover:shadow-md"
                            }`}
                        onClick={() => setSelectedRuleset(rs)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                {disciplineIcons[rs.discipline] || (
                                    <FileText className="h-5 w-5" />
                                )}
                                <CardTitle className="text-base">{rs.name}</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                {rs.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 text-sm text-gray-500">
                                <span>{rs._count.rules} reglas</span>
                                <span>{rs._count.runs} ejecuciones</span>
                            </div>
                            {rs.isDefault && (
                                <Badge variant="secondary" className="mt-2 text-xs">
                                    Por defecto
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Rules Table */}
            {selectedRuleset && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>
                                Reglas de {selectedRuleset.name}
                            </CardTitle>
                            <CardDescription>
                                {rules.length} reglas configuradas
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => {
                                setEditingRule(undefined);
                                setShowRuleBuilder(true);
                            }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Regla
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Condición</TableHead>
                                    <TableHead>Severidad</TableHead>
                                    <TableHead>Fuente</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="text-center text-gray-500 py-8"
                                        >
                                            No hay reglas configuradas. Crea la primera regla.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rules.map((rule) => {
                                        const severity = severityConfig[rule.severity];
                                        const SeverityIcon = severity.icon;

                                        return (
                                            <TableRow
                                                key={rule.id}
                                                className={!rule.isActive ? "opacity-50" : ""}
                                            >
                                                <TableCell>
                                                    <div
                                                        className={`w-3 h-3 rounded-full ${rule.isActive ? "bg-green-500" : "bg-gray-300"
                                                            }`}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {rule.name}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-600">
                                                    {rule.targetCategory}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm">
                                                    {rule.propertyName} {rule.operator} {rule.expectedValue}
                                                    {rule.unit && ` ${rule.unit}`}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`${severity.color} ${severity.bg}`}
                                                    >
                                                        <SeverityIcon className="h-3 w-3 mr-1" />
                                                        {severity.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-500">
                                                    {rule.sourceDocument || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setEditingRule(rule);
                                                                    setShowRuleBuilder(true);
                                                                }}
                                                            >
                                                                <Edit2 className="h-4 w-4 mr-2" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleToggleRule(rule)}
                                                            >
                                                                {rule.isActive ? (
                                                                    <>
                                                                        <PowerOff className="h-4 w-4 mr-2" />
                                                                        Desactivar
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Power className="h-4 w-4 mr-2" />
                                                                        Activar
                                                                    </>
                                                                )}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-red-600"
                                                                onClick={() => handleDeleteRule(rule.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Eliminar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Rule Builder Modal */}
            {showRuleBuilder && selectedRuleset && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <RuleBuilder
                        rule={editingRule}
                        rulesetId={selectedRuleset.id}
                        onSave={handleSaveRule}
                        onCancel={() => {
                            setShowRuleBuilder(false);
                            setEditingRule(undefined);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

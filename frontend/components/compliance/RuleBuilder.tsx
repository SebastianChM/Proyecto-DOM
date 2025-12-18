"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { X, Save, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface Rule {
    id?: string;
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
    isActive?: boolean;
}

interface RuleBuilderProps {
    rule?: Rule;
    rulesetId: string;
    onSave: (rule: Rule) => Promise<void>;
    onCancel: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export function RuleBuilder({
    rule,
    rulesetId,
    onSave,
    onCancel,
}: RuleBuilderProps) {
    const [formData, setFormData] = useState<Rule>({
        name: "",
        description: "",
        targetCategory: "",
        targetNamePattern: "",
        propertyName: "",
        operator: ">=",
        expectedValue: "",
        unit: "",
        tolerance: undefined,
        severity: "WARNING",
        sourceDocument: "",
        sourcePage: undefined,
        rulesetId: rulesetId,
        isActive: true,
        ...rule,
    });

    const [categories, setCategories] = useState<Record<string, string[]>>({});
    const [operators, setOperators] = useState<
        Array<{ value: string; label: string; description: string }>
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load categories and operators
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, opRes] = await Promise.all([
                    fetch(`${API_BASE}/api/compliance-v2/categories`),
                    fetch(`${API_BASE}/api/compliance-v2/operators`),
                ]);
                const catData = await catRes.json();
                const opData = await opRes.json();
                setCategories(catData);
                setOperators(opData);
            } catch (err) {
                console.error("Failed to load form data:", err);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validation
            if (!formData.name.trim()) throw new Error("El nombre es requerido");
            if (!formData.targetCategory)
                throw new Error("La categoría es requerida");
            if (!formData.propertyName.trim())
                throw new Error("La propiedad es requerida");
            if (!formData.expectedValue.trim())
                throw new Error("El valor esperado es requerido");

            await onSave(formData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateField = <K extends keyof Rule>(field: K, value: Rule[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // Flatten categories for select
    const allCategories = Object.values(categories).flat();

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {rule?.id ? "Editar Regla" : "Nueva Regla"}
                </h2>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                    <Label htmlFor="name">Nombre de la Regla *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="Ej: Ancho Mínimo Bandeja Portacables"
                        className="mt-1"
                    />
                </div>

                {/* Description */}
                <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) => updateField("description", e.target.value)}
                        placeholder="Descripción opcional de la regla..."
                        className="mt-1"
                        rows={2}
                    />
                </div>

                {/* Scope Section */}
                <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Alcance
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="targetCategory">Categoría Revit *</Label>
                            <Select
                                value={formData.targetCategory}
                                onValueChange={(v) => updateField("targetCategory", v)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allCategories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="targetNamePattern">
                                Filtro de Nombre (regex)
                            </Label>
                            <Input
                                id="targetNamePattern"
                                value={formData.targetNamePattern || ""}
                                onChange={(e) => updateField("targetNamePattern", e.target.value)}
                                placeholder="Ej: ^CT-.*"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Condition Section */}
                <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Condición
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="propertyName">Propiedad *</Label>
                            <Input
                                id="propertyName"
                                value={formData.propertyName}
                                onChange={(e) => updateField("propertyName", e.target.value)}
                                placeholder="Ej: Width, Voltage, Power"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="operator">Operador *</Label>
                            <Select
                                value={formData.operator}
                                onValueChange={(v) => updateField("operator", v)}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Seleccionar operador" />
                                </SelectTrigger>
                                <SelectContent>
                                    {operators.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                            <Label htmlFor="expectedValue">Valor Esperado *</Label>
                            <Input
                                id="expectedValue"
                                value={formData.expectedValue}
                                onChange={(e) => updateField("expectedValue", e.target.value)}
                                placeholder="Ej: 300"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="unit">Unidad</Label>
                            <Input
                                id="unit"
                                value={formData.unit || ""}
                                onChange={(e) => updateField("unit", e.target.value)}
                                placeholder="Ej: mm, V, A"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="tolerance">Tolerancia (±)</Label>
                            <Input
                                id="tolerance"
                                type="number"
                                value={formData.tolerance || ""}
                                onChange={(e) =>
                                    updateField(
                                        "tolerance",
                                        e.target.value ? parseFloat(e.target.value) : undefined
                                    )
                                }
                                placeholder="Ej: 5"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Metadata Section */}
                <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Metadata
                    </h3>

                    {/* Severity */}
                    <div className="mb-4">
                        <Label>Severidad</Label>
                        <RadioGroup
                            value={formData.severity}
                            onValueChange={(v) =>
                                updateField("severity", v as "CRITICAL" | "WARNING" | "INFO")
                            }
                            className="flex gap-6 mt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="CRITICAL" id="critical" />
                                <Label
                                    htmlFor="critical"
                                    className="flex items-center gap-1 text-red-600"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    Crítico
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="WARNING" id="warning" />
                                <Label
                                    htmlFor="warning"
                                    className="flex items-center gap-1 text-yellow-600"
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    Advertencia
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="INFO" id="info" />
                                <Label
                                    htmlFor="info"
                                    className="flex items-center gap-1 text-blue-600"
                                >
                                    <Info className="h-4 w-4" />
                                    Info
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="sourceDocument">Documento Fuente</Label>
                            <Input
                                id="sourceDocument"
                                value={formData.sourceDocument || ""}
                                onChange={(e) => updateField("sourceDocument", e.target.value)}
                                placeholder="Ej: ET Eléctrico, Tabla 3.2"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label htmlFor="sourcePage">Página</Label>
                            <Input
                                id="sourcePage"
                                type="number"
                                value={formData.sourcePage || ""}
                                onChange={(e) =>
                                    updateField(
                                        "sourcePage",
                                        e.target.value ? parseInt(e.target.value) : undefined
                                    )
                                }
                                placeholder="Ej: 15"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        <Save className="h-4 w-4 mr-2" />
                        {loading
                            ? "Guardando..."
                            : rule?.id
                                ? "Actualizar Regla"
                                : "Crear Regla"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

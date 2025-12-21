"use client";

import { RulesetManager } from "@/components/compliance/RulesetManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Settings } from "lucide-react";
import Link from "next/link";

export default function ComplianceRulesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Reglas de Validación
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configura las reglas para validar modelos BIM contra
              especificaciones técnicas
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <BookOpen className="h-4 w-4 mr-2" />
            Documentación
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <QuickStat
          label="Rulesets Activos"
          value="2"
          trend="+0 esta semana"
          color="blue"
        />
        <QuickStat
          label="Reglas Totales"
          value="10"
          trend="+2 nuevas"
          color="green"
        />
        <QuickStat
          label="Validaciones Hoy"
          value="0"
          trend="Sin ejecuciones"
          color="gray"
        />
        <QuickStat
          label="Tasa de Cumplimiento"
          value="-"
          trend="Sin datos"
          color="gray"
        />
      </div>

      {/* Main Content */}
      <RulesetManager />
    </div>
  );
}

interface QuickStatProps {
  label: string;
  value: string;
  trend: string;
  color: "blue" | "green" | "red" | "yellow" | "gray";
}

function QuickStat({ label, value, trend, color }: QuickStatProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    gray: "bg-gray-50 border-gray-200 text-gray-500",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs mt-1 opacity-70">{trend}</p>
    </div>
  );
}

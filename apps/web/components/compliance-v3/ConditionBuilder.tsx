"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDictionaries } from "@/hooks/use-dictionaries";
import { OPERATORS, LOGIC_GROUPS } from "@/lib/api/compliance-v3.constants";
import type { Condition } from "@/lib/api/compliance-v3.types";

interface ConditionBuilderProps {
  value: Omit<Condition, "id">[];
  onChange: (conditions: Omit<Condition, "id">[]) => void;
}

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const { properties, units, loading } = useDictionaries();

  const uniqueFromUnits = Array.from(new Set(units.map((u) => u.fromUnit)));

  const addCondition = () => {
    onChange([
      ...value,
      {
        propertyRef: "",
        operator: ">=",
        value: "",
        unit: undefined,
        logicGroup: "AND",
        sortOrder: value.length,
      },
    ]);
  };

  const removeCondition = (index: number) => {
    onChange(
      value
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, sortOrder: i })),
    );
  };

  const updateCondition = (
    index: number,
    field: keyof Omit<Condition, "id">,
    fieldValue: string | number,
  ) => {
    onChange(
      value.map((c, i) => (i === index ? { ...c, [field]: fieldValue } : c)),
    );
  };

  return (
    <div className="space-y-2">
      {value.map((condition, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-2 border rounded-md bg-muted/30"
        >
          {loading ? (
            <div className="flex-1 h-8 bg-muted animate-pulse rounded" />
          ) : (
            <>
              <Input
                list={`properties-${index}`}
                placeholder="Property ref"
                value={condition.propertyRef}
                onChange={(e) =>
                  updateCondition(index, "propertyRef", e.target.value)
                }
                className="flex-1 min-w-0"
              />
              <datalist id={`properties-${index}`}>
                {properties.map((p) => (
                  <option key={p.id} value={p.canonicalName} />
                ))}
              </datalist>

              <Select
                value={condition.operator}
                onValueChange={(v) => updateCondition(index, "operator", v)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Value"
                value={condition.value}
                onChange={(e) =>
                  updateCondition(index, "value", e.target.value)
                }
                className="w-24"
              />

              <Select
                value={condition.unit ?? ""}
                onValueChange={(v) => updateCondition(index, "unit", v)}
              >
                <SelectTrigger className="w-20">
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {uniqueFromUnits.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={condition.logicGroup}
                onValueChange={(v) => updateCondition(index, "logicGroup", v)}
              >
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGIC_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeCondition(index)}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addCondition}>
        <Plus className="mr-1 h-4 w-4" />
        Add Condition
      </Button>
    </div>
  );
}

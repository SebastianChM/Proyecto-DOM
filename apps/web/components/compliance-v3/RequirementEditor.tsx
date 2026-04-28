"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConditionBuilder } from "./ConditionBuilder";
import { useRequirementMutations } from "@/hooks/use-requirements";
import { useDictionaries } from "@/hooks/use-dictionaries";
import { DISCIPLINES, SEVERITIES } from "@/lib/api/compliance-v3.constants";
import type { Requirement, Condition } from "@/lib/api/compliance-v3.types";

const conditionSchema = z.object({
  propertyRef: z.string().min(1, "Property is required"),
  operator: z.string().min(1, "Operator is required"),
  value: z.string().min(1, "Value is required"),
  unit: z.string().optional(),
  tolerance: z.number().optional(),
  logicGroup: z.enum(["AND", "OR"]),
  sortOrder: z.number(),
});

const requirementFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  description: z.string().min(1, "Description is required"),
  legalReference: z.string().min(1, "Legal reference is required"),
  discipline: z.string().min(1, "Discipline is required"),
  severity: z.enum(["MANDATORY", "RECOMMENDED", "INFO"]),
  tags: z.string().optional(),
  notes: z.string().optional(),
  conditions: z
    .array(conditionSchema)
    .min(1, "At least one condition is required"),
  targetCategories: z.string().optional(),
  scope: z.enum(["ALL", "FILTERED"]).optional(),
});

type RequirementFormValues = z.infer<typeof requirementFormSchema>;

interface RequirementEditorProps {
  packId: string;
  requirement?: Requirement;
  onSave: (req: Requirement) => void;
  onCancel: () => void;
}

export function RequirementEditor({
  packId,
  requirement,
  onSave,
  onCancel,
}: RequirementEditorProps) {
  const { categories } = useDictionaries();
  const { create, update } = useRequirementMutations(packId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementFormSchema),
    defaultValues: {
      code: "",
      description: "",
      legalReference: "",
      discipline: "",
      severity: "MANDATORY",
      tags: "",
      notes: "",
      conditions: [],
      targetCategories: "",
      scope: "ALL",
    },
  });

  useEffect(() => {
    if (requirement) {
      reset({
        code: requirement.code,
        description: requirement.description,
        legalReference: requirement.legalReference,
        discipline: requirement.discipline,
        severity: requirement.severity,
        tags: requirement.tags.join(", "),
        notes: requirement.notes ?? "",
        conditions: requirement.conditions.map((c: Condition) => ({
          propertyRef: c.propertyRef,
          operator: c.operator,
          value: c.value,
          unit: c.unit,
          tolerance: c.tolerance,
          logicGroup: c.logicGroup,
          sortOrder: c.sortOrder,
        })),
        targetCategories:
          requirement.applicability?.targetCategories.join(", ") ?? "",
        scope: requirement.applicability?.scope ?? "ALL",
      });
    }
  }, [requirement, reset]);

  const onSubmit = async (values: RequirementFormValues) => {
    try {
      const input = {
        code: values.code,
        description: values.description,
        legalReference: values.legalReference,
        discipline: values.discipline,
        severity: values.severity,
        tags: values.tags
          ? values.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        notes: values.notes || undefined,
        conditions: values.conditions,
        applicability:
          values.scope === "FILTERED" && values.targetCategories
            ? {
                targetCategories: values.targetCategories
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean),
                excludeCategories: [],
                scope: "FILTERED" as const,
              }
            : undefined,
      };

      let result: Requirement;
      if (requirement) {
        result = await update(requirement.id, input);
      } else {
        result = await create(input);
      }
      onSave(result);
    } catch (err) {
      setError("root", {
        message:
          err instanceof Error ? err.message : "Failed to save requirement",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="code">Code</Label>
          <Input id="code" placeholder="CL-OGUC-R001" {...register("code")} />
          {errors.code && (
            <p className="text-xs text-destructive">{errors.code.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="legalReference">Legal Reference</Label>
          <Input
            id="legalReference"
            placeholder="Art. 5.1.2"
            {...register("legalReference")}
          />
          {errors.legalReference && (
            <p className="text-xs text-destructive">
              {errors.legalReference.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
        {errors.description && (
          <p className="text-xs text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Discipline</Label>
          <Controller
            name="discipline"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {DISCIPLINES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.discipline && (
            <p className="text-xs text-destructive">
              {errors.discipline.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Severity</Label>
          <Controller
            name="severity"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" placeholder="tag1, tag2" {...register("tags")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            placeholder="Optional notes"
            {...register("notes")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Conditions</Label>
        <Controller
          name="conditions"
          control={control}
          render={({ field }) => (
            <ConditionBuilder value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.conditions && (
          <p className="text-xs text-destructive">
            {errors.conditions.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Applicability</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label
              htmlFor="targetCategories"
              className="text-xs text-muted-foreground"
            >
              Target Categories (comma-separated)
            </Label>
            <Input
              id="targetCategories"
              placeholder={
                categories
                  .slice(0, 2)
                  .map((c) => c.canonicalName)
                  .join(", ") || "walls, columns"
              }
              {...register("targetCategories")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Scope</Label>
            <Controller
              name="scope"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL</SelectItem>
                    <SelectItem value="FILTERED">FILTERED</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : requirement ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

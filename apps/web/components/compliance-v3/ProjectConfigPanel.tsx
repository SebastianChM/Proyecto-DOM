"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useComplianceConfig } from "@/hooks/use-compliance-config";
import { PackBrowser } from "./PackBrowser";
import { OVERRIDE_ACTIONS } from "@/lib/api/compliance-v3.constants";
import type { Pack } from "@/lib/api/compliance-v3.types";
import type { AddOverrideInput } from "@/lib/api/compliance-v3";

const addOverrideSchema = z.object({
  requirementId: z.string().min(1, "Requirement ID is required"),
  action: z.enum(["SKIP", "MODIFY_VALUE", "CHANGE_SEVERITY"]),
  newValue: z.string().optional(),
  newSeverity: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  approvedBy: z.string().min(1, "Approved by is required"),
});

type AddOverrideFormValues = z.infer<typeof addOverrideSchema>;

interface ProjectConfigPanelProps {
  projectId: string;
}

export function ProjectConfigPanel({ projectId }: ProjectConfigPanelProps) {
  const { config, loading, upsert, addConfigOverride, removeConfigOverride } =
    useComplianceConfig(projectId);

  const [isPackSelectorOpen, setIsPackSelectorOpen] = useState(false);
  const [isOverrideFormOpen, setIsOverrideFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [localPacks, setLocalPacks] = useState<Pack[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    const configPacks = (config as unknown as { packs?: Pack[] })?.packs;
    if (configPacks && configPacks.length > 0) {
      setLocalPacks(configPacks);
      setInitialized(true);
    } else if (config !== null && config !== undefined) {
      // config loaded but no packs assigned
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddOverrideFormValues>({
    resolver: zodResolver(addOverrideSchema),
    defaultValues: { action: "SKIP" },
  });

  const watchedAction = watch("action");

  const handleAddPack = (pack: Pack) => {
    if (!localPacks.find((p) => p.id === pack.id)) {
      setLocalPacks((prev) => [...prev, pack]);
    }
    setIsPackSelectorOpen(false);
  };

  const handleRemovePack = (packId: string) => {
    setLocalPacks((prev) => prev.filter((p) => p.id !== packId));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await upsert(localPacks.map((p) => p.id));
      toast.success("Configuration saved successfully.");
    } catch (err) {
      toast.error("Failed to save configuration.", {
        description: (err as Error)?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitOverride = async (values: AddOverrideFormValues) => {
    await addConfigOverride(values as AddOverrideInput);
    reset();
    setIsOverrideFormOpen(false);
  };

  const handleRemoveOverride = async (overrideId: string) => {
    await removeConfigOverride(overrideId);
  };

  if (loading && !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Compliance Configuration</h2>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Assigned Packs</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPackSelectorOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Pack
          </Button>
        </div>

        {localPacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No packs assigned.</p>
        ) : (
          <div className="space-y-2">
            {localPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{pack.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {pack.code}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {pack.status}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemovePack(pack.id)}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleSaveConfig} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Requirement Overrides</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOverrideFormOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Override
          </Button>
        </div>

        {(config?.overrides ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No overrides configured.
          </p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-3 py-2">Requirement ID</th>
                  <th className="text-left px-3 py-2">Action</th>
                  <th className="text-left px-3 py-2">Reason</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(config?.overrides ?? []).map((ov) => (
                  <tr key={ov.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">
                      {ov.requirementId}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">
                        {ov.action}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">{ov.reason}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleRemoveOverride(ov.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isPackSelectorOpen} onOpenChange={setIsPackSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select a Pack</DialogTitle>
          </DialogHeader>
          <PackBrowser selectable onSelectPack={handleAddPack} />
        </DialogContent>
      </Dialog>

      <Dialog open={isOverrideFormOpen} onOpenChange={setIsOverrideFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Override</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(handleSubmitOverride)}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="requirementId">Requirement ID</Label>
              <Input
                id="requirementId"
                placeholder="uuid of requirement"
                {...register("requirementId")}
              />
              {errors.requirementId && (
                <p className="text-xs text-destructive">
                  {errors.requirementId.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Action</Label>
              <Controller
                name="action"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERRIDE_ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {watchedAction === "MODIFY_VALUE" && (
              <div className="space-y-1">
                <Label htmlFor="newValue">New Value</Label>
                <Input id="newValue" {...register("newValue")} />
              </div>
            )}

            {watchedAction === "CHANGE_SEVERITY" && (
              <div className="space-y-1">
                <Label>New Severity</Label>
                <Controller
                  name="newSeverity"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANDATORY">MANDATORY</SelectItem>
                        <SelectItem value="RECOMMENDED">RECOMMENDED</SelectItem>
                        <SelectItem value="INFO">INFO</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" {...register("reason")} />
              {errors.reason && (
                <p className="text-xs text-destructive">
                  {errors.reason.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="approvedBy">Approved By</Label>
              <Input id="approvedBy" {...register("approvedBy")} />
              {errors.approvedBy && (
                <p className="text-xs text-destructive">
                  {errors.approvedBy.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOverrideFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Override"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

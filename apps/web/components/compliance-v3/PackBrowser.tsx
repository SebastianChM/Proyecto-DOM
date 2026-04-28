"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePackList, usePackMutations } from "@/hooks/use-packs";
import { PACK_STATUSES } from "@/lib/api/compliance-v3.constants";
import type { Pack } from "@/lib/api/compliance-v3.types";

const STATUS_OPTIONS = [
  { value: "all" as const, label: "All Statuses" },
  ...PACK_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0) + s.slice(1).toLowerCase(),
  })),
];

const STATUS_BADGE_VARIANT: Record<
  string,
  "outline" | "default" | "secondary" | "destructive"
> = {
  DRAFT: "outline",
  PUBLISHED: "default",
  DEPRECATED: "secondary",
};

const createPackSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  country: z.string().min(2, "Country is required"),
  version: z.string().min(1, "Version is required"),
  scope: z.string().min(1, "Scope is required"),
});

type CreatePackFormValues = z.infer<typeof createPackSchema>;

interface PackBrowserProps {
  onSelectPack?: (pack: Pack) => void;
  selectable?: boolean;
}

export function PackBrowser({
  onSelectPack,
  selectable = false,
}: PackBrowserProps) {
  const { packs, pagination, loading, error, refresh, setPage, fetchPacks } =
    usePackList();
  const { create } = usePackMutations();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isNewPackOpen, setIsNewPackOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePackFormValues>({
    resolver: zodResolver(createPackSchema),
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPacks({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
        page: 1,
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPacks({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: value || undefined,
        page: 1,
      });
    }, 300);
  };

  const onSubmitNewPack = async (values: CreatePackFormValues) => {
    await create({
      ...values,
      scope: values.scope
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    reset();
    setIsNewPackOpen(false);
    refresh();
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error.message}
          <Button variant="link" onClick={refresh} className="ml-2">
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Regulation Packs</h2>
        <Button onClick={() => setIsNewPackOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Pack
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => (
            <Card
              key={pack.id}
              className={
                selectable ? "cursor-pointer hover:border-primary" : ""
              }
              onClick={selectable ? () => onSelectPack?.(pack) : undefined}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{pack.name}</CardTitle>
                    <span className="text-sm text-muted-foreground font-mono">
                      {pack.code}
                    </span>
                  </div>
                  <Badge
                    variant={STATUS_BADGE_VARIANT[pack.status] ?? "outline"}
                  >
                    {pack.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{pack.country}</span>
                  <span>v{pack.version}</span>
                  {pack._count && (
                    <span>{pack._count.requirements} requirements</span>
                  )}
                </div>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {pack.scope.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {packs.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No packs found.
            </p>
          )}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={isNewPackOpen} onOpenChange={setIsNewPackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Regulation Pack</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitNewPack)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  placeholder="CL-OGUC-2024"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="text-xs text-destructive">
                    {errors.code.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  placeholder="1.0.0"
                  {...register("version")}
                />
                {errors.version && (
                  <p className="text-xs text-destructive">
                    {errors.version.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Normativa OGUC Arquitectura Chile"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                {...register("description")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="country">Country</Label>
                <Input id="country" placeholder="CL" {...register("country")} />
                {errors.country && (
                  <p className="text-xs text-destructive">
                    {errors.country.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="scope">Scope (comma-separated)</Label>
                <Input
                  id="scope"
                  placeholder="ARCHITECTURAL, STRUCTURAL"
                  {...register("scope")}
                />
                {errors.scope && (
                  <p className="text-xs text-destructive">
                    {errors.scope.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewPackOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Pack"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

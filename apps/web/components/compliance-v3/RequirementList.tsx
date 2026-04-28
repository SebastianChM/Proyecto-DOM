"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";
import {
  useRequirementList,
  useRequirementMutations,
} from "@/hooks/use-requirements";
import { RequirementEditor } from "./RequirementEditor";
import {
  DISCIPLINES,
  SEVERITIES,
  REQUIREMENT_STATUSES,
} from "@/lib/api/compliance-v3.constants";
import type { Requirement } from "@/lib/api/compliance-v3.types";

const STATUSES = REQUIREMENT_STATUSES;

const SEVERITY_VARIANT: Record<string, "destructive" | "default" | "outline"> =
  {
    MANDATORY: "destructive",
    RECOMMENDED: "default",
    INFO: "outline",
  };

interface RequirementListProps {
  packId: string;
  onSelectRequirement?: (req: Requirement) => void;
}

export function RequirementList({
  packId,
  onSelectRequirement,
}: RequirementListProps) {
  const { requirements, pagination, loading, refresh, setPage, setFilters } =
    useRequirementList(packId);

  const { verify, remove } = useRequirementMutations(packId);

  const [editingReq, setEditingReq] = useState<Requirement | undefined>(
    undefined,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingReq(undefined);
    setIsEditorOpen(true);
  };

  const openEdit = (req: Requirement) => {
    setEditingReq(req);
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    setIsEditorOpen(false);
    refresh();
  };

  const handleVerify = async (req: Requirement) => {
    await verify(req.id, "current-user");
    refresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await remove(deletingId);
    setDeletingId(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Select
            onValueChange={(v) =>
              setFilters({ discipline: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Discipline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {DISCIPLINES.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(v) =>
              setFilters({ severity: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            onValueChange={(v) =>
              setFilters({ status: v === "all" ? undefined : v })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add Requirement
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-left px-3 py-2">Discipline</th>
                <th className="text-left px-3 py-2">Severity</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Conds</th>
                <th className="text-left px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr
                  key={req.id}
                  className={`border-t hover:bg-muted/50 ${onSelectRequirement ? "cursor-pointer" : ""}`}
                  onClick={
                    onSelectRequirement
                      ? () => onSelectRequirement(req)
                      : undefined
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs">{req.code}</td>
                  <td className="px-3 py-2 max-w-xs truncate">
                    {req.description}
                  </td>
                  <td className="px-3 py-2 text-xs">{req.discipline}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={SEVERITY_VARIANT[req.severity] ?? "outline"}
                      className="text-xs"
                    >
                      {req.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">
                      {req.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {(req as Requirement).conditions?.length ?? 0}
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(req as Requirement)}
                      >
                        Edit
                      </Button>
                      {req.status === "DRAFT" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVerify(req as Requirement)}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeletingId(req.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {requirements.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No requirements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
          </Button>
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReq ? "Edit Requirement" : "Add Requirement"}
            </DialogTitle>
          </DialogHeader>
          <RequirementEditor
            packId={packId}
            requirement={editingReq}
            onSave={handleSave}
            onCancel={() => setIsEditorOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requirement</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The requirement will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Save } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { LocationPicker } from "@/components/LocationPicker";
import { format } from "date-fns";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface ProjectDetailsPanelProps {
  projectType: string;
  discipline: string;
  ownerName: string;
  location: string;
  startDate: string;
  endDate?: string;
  apsProjectId?: string;
  notes?: string;
  onSave?: (data: Record<string, string>) => Promise<void>;
}

export function ProjectDetailsPanel({
  projectType,
  discipline,
  ownerName,
  location,
  startDate,
  endDate,
  apsProjectId,
  notes,
  onSave,
}: ProjectDetailsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    projectType,
    discipline,
    ownerName,
    location,
    startDate,
    endDate: endDate || "",
    notes: notes || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      projectType,
      discipline,
      ownerName,
      location,
      startDate,
      endDate: endDate || "",
      notes: notes || "",
    });
  }, [projectType, discipline, ownerName, location, startDate, endDate, notes]);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(formData);
      setIsEditing(false);
    } catch (error) {
      logger.error("Failed to save project details", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      projectType,
      discipline,
      ownerName,
      location,
      startDate,
      endDate: endDate || "",
      notes: notes || "",
    });
    setIsEditing(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: string, date: Date | undefined) => {
    if (!date) {
      setFormData((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    const newDateStr = format(date, "yyyy-MM-dd");

    if (field === "startDate" && formData.endDate) {
      if (newDateStr > formData.endDate) {
        toast.error("Start date cannot be after end date");
        return;
      }
    }

    if (field === "endDate" && formData.startDate) {
      if (newDateStr < formData.startDate) {
        toast.error("End date cannot be before start date");
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [field]: newDateStr }));
  };

  return (
    <Card className="bg-white dark:glass-panel border-gray-200 dark:border-white/10 shadow-sm relative">
      {onSave && !isEditing && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8"
          >
            <Pencil className="h-3 w-3 mr-2" /> Edit Details
          </Button>
        </div>
      )}

      <CardContent className="p-6">
        {isEditing ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <EditItem label="Project Type">
                <Input
                  value={formData.projectType}
                  onChange={(e) => handleChange("projectType", e.target.value)}
                  className="h-8"
                />
              </EditItem>
              <EditItem label="Discipline">
                <Input
                  value={formData.discipline}
                  onChange={(e) => handleChange("discipline", e.target.value)}
                  className="h-8"
                />
              </EditItem>
              <EditItem label="Owner">
                <Input
                  value={formData.ownerName}
                  onChange={(e) => handleChange("ownerName", e.target.value)}
                  className="h-8"
                />
              </EditItem>
              <EditItem label="Location">
                <LocationPicker
                  value={formData.location}
                  onChange={(v) => handleChange("location", v)}
                  className="h-8"
                />
              </EditItem>
              <EditItem label="Start Date">
                <DatePicker
                  date={
                    formData.startDate
                      ? new Date(formData.startDate)
                      : undefined
                  }
                  setDate={(d) => handleDateChange("startDate", d)}
                  className="h-8"
                />
              </EditItem>
              <EditItem label="End Date">
                <DatePicker
                  date={
                    formData.endDate ? new Date(formData.endDate) : undefined
                  }
                  setDate={(d) => handleDateChange("endDate", d)}
                  className="h-8"
                />
              </EditItem>
              <div className="opacity-50 pointer-events-none">
                <DetailItem
                  label="Autodesk Project ID"
                  value={apsProjectId || "Not linked"}
                  mono
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-white/5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Notes
              </h4>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Add project notes..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <DetailItem label="Project Type" value={projectType} />
              <DetailItem label="Discipline" value={discipline} />
              <DetailItem label="Owner" value={ownerName} />
              <DetailItem label="Location" value={location} />
              <DetailItem label="Start Date" value={startDate} />
              <DetailItem label="End Date" value={endDate || "-"} />
              <DetailItem
                label="Autodesk Project ID"
                value={apsProjectId || "Not linked"}
                mono
              />
            </div>

            {notes && (
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Notes
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {notes}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </h4>
      <p
        className={`text-sm font-medium text-gray-900 dark:text-white ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function EditItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </h4>
      {children}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface ComplianceExportProps {
  runId: string;
  projectName: string;
}

async function downloadExport(
  runId: string,
  format: "pdf" | "xlsx",
  filename: string,
): Promise<void> {
  const response = await fetch(
    `/api/compliance-v3/compliance/runs/${runId}/export?format=${format}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ComplianceExport({
  runId,
  projectName,
}: ComplianceExportProps) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);

  async function handleExportPdf() {
    setPdfLoading(true);
    try {
      await downloadExport(
        runId,
        "pdf",
        `${projectName}-compliance-${runId}.pdf`,
      );
    } catch (err) {
      toast.error("Failed to export PDF", {
        description: (err as Error).message,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleExportExcel() {
    setXlsxLoading(true);
    try {
      await downloadExport(
        runId,
        "xlsx",
        `${projectName}-compliance-${runId}.xlsx`,
      );
    } catch (err) {
      toast.error("Failed to export Excel", {
        description: (err as Error).message,
      });
    } finally {
      setXlsxLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleExportPdf}
        disabled={pdfLoading}
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        <Download className="h-3 w-3" />
        {pdfLoading ? "Exporting..." : "Export PDF"}
      </Button>
      <Button
        variant="outline"
        onClick={handleExportExcel}
        disabled={xlsxLoading}
        className="flex items-center gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <Download className="h-3 w-3" />
        {xlsxLoading ? "Exporting..." : "Export Excel"}
      </Button>
    </div>
  );
}

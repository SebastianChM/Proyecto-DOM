"use client";

import { use } from "react";
import { ComplianceManager } from "@/components/compliance-v3/ComplianceManager";

interface ProjectCompliancePageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectCompliancePage({
  params,
}: ProjectCompliancePageProps) {
  const { id } = use(params);
  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">Compliance</h1>
      <ComplianceManager projectId={id} />
    </div>
  );
}

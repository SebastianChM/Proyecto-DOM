"use client";

import { useRouter } from "next/navigation";
import { PackBrowser } from "@/components/compliance-v3";
import type { Pack } from "@/lib/api/compliance-v3.types";

export default function PacksPage() {
  const router = useRouter();

  const handleSelectPack = (pack: Pack) => {
    router.push(`/dashboard/packs/${pack.id}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Regulation Pack Manager</h1>
        <p className="text-muted-foreground mt-1">
          Manage regulation packs and their requirements.
        </p>
      </div>
      <PackBrowser onSelectPack={handleSelectPack} />
    </div>
  );
}

"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { PackDetail } from "@/components/compliance-v3";
import { usePackDetail } from "@/hooks/use-packs";

interface PackDetailPageProps {
  params: Promise<{ id: string }>;
}

function Breadcrumb({ packName }: { packName?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      <button
        onClick={() => router.push("/dashboard/packs")}
        className="hover:text-foreground transition-colors"
      >
        Packs
      </button>
      <span>/</span>
      <span className="text-foreground">{packName ?? "..."}</span>
    </div>
  );
}

function PackDetailContent({ id }: { id: string }) {
  const { pack } = usePackDetail(id);
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4">
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        onClick={() => router.back()}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Packs
      </Button>
      <Breadcrumb packName={pack?.name} />
      <PackDetail packId={id} />
    </div>
  );
}

export default function PackDetailPage({ params }: PackDetailPageProps) {
  const { id } = use(params);
  return <PackDetailContent id={id} />;
}

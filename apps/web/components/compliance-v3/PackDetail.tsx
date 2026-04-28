"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePackDetail, usePackMutations } from "@/hooks/use-packs";
import { RequirementList } from "./RequirementList";
import { SuggestionReviewer } from "./SuggestionReviewer";

const STATUS_BADGE_VARIANT: Record<
  string,
  "outline" | "default" | "secondary" | "destructive"
> = {
  DRAFT: "outline",
  PUBLISHED: "default",
  DEPRECATED: "secondary",
};

const TABS = ["Requirements", "Suggestions"] as const;
type Tab = (typeof TABS)[number];

interface PackDetailProps {
  packId: string;
}

export function PackDetail({ packId }: PackDetailProps) {
  const { pack, loading, error, refresh } = usePackDetail(packId);
  const { publish, deprecate } = usePackMutations();
  const [activeTab, setActiveTab] = useState<Tab>("Requirements");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !pack) {
    return (
      <p className="text-destructive">{error?.message ?? "Pack not found."}</p>
    );
  }

  const canPublish = pack.status === "DRAFT";
  const canDeprecate = pack.status === "PUBLISHED";

  const handlePublish = async () => {
    await publish(packId);
    refresh();
  };

  const handleDeprecate = async () => {
    await deprecate(packId);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{pack.name}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[pack.status] ?? "outline"}>
              {pack.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-mono">{pack.code}</span>
            <span>{pack.country}</span>
            <span>v{pack.version}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canPublish && (
            <Button onClick={handlePublish} size="sm">
              Publish
            </Button>
          )}
          {canDeprecate && (
            <Button onClick={handleDeprecate} variant="outline" size="sm">
              Deprecate
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-1 border-b mb-4">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Requirements" && <RequirementList packId={packId} />}
          {activeTab === "Suggestions" && (
            <SuggestionReviewer packId={packId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

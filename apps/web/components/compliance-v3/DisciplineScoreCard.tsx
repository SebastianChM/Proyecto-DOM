"use client";

import {
  type LucideIcon,
  Building2,
  Zap,
  Flame,
  Ruler,
  Droplets,
  Wind,
  Mountain,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DisciplineScoreCardProps {
  discipline: string;
  totalIssues: number;
  mandatoryIssues: number;
  recommendedIssues: number;
  onClick?: () => void;
}

const DISCIPLINE_ICONS: Record<string, LucideIcon> = {
  STRUCTURAL: Building2,
  ELECTRICAL: Zap,
  FIRE_PROTECTION: Flame,
  ARCHITECTURAL: Ruler,
  PLUMBING: Droplets,
  HVAC: Wind,
  CIVIL: Mountain,
};

function borderColor(
  mandatoryIssues: number,
  recommendedIssues: number,
  totalIssues: number,
): string {
  if (totalIssues === 0) return "border-green-400";
  if (mandatoryIssues > 0) return "border-red-400";
  return "border-yellow-400";
}

export function DisciplineScoreCard({
  discipline,
  totalIssues,
  mandatoryIssues,
  recommendedIssues,
  onClick,
}: DisciplineScoreCardProps) {
  const Icon = DISCIPLINE_ICONS[discipline.toUpperCase()] ?? FileText;
  const border = borderColor(mandatoryIssues, recommendedIssues, totalIssues);

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${border}`}
      onClick={onClick}
    >
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{discipline}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalIssues === 0 ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              No issues
            </Badge>
          ) : (
            <>
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {mandatoryIssues} mandatory
              </Badge>
              <Badge
                variant="secondary"
                className="bg-yellow-100 text-yellow-700"
              >
                {recommendedIssues} recommended
              </Badge>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {totalIssues} total issue{totalIssues !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}

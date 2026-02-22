"use client";

/**
 * WorkflowTimeline Component
 *
 * Displays the complete history of workflow transitions with timestamps,
 * user information, and comments.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import apiClient from "@/lib/axios-config";
import { logger } from "@/lib/logger";
import {
  Clock,
  User,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ============================================
// TYPES
// ============================================

interface HistoryEntry {
  id: string;
  fromStateName: string;
  fromStateDisplay: string;
  toStateName: string;
  toStateDisplay: string;
  transitionName?: string;
  transitionDisplay?: string;
  performedById: string;
  performedByName: string;
  performedByEmail?: string;
  performedAt: string;
  comment?: string;
  durationInPreviousState?: number;
  metadata?: string;
}

interface WorkflowTimelineProps {
  entityType: "PROJECT" | "FILE" | "VALIDATION";
  entityId: string;
  maxItems?: number;
  compact?: boolean;
  className?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function getStateColorClass(stateName: string): string {
  const colorClasses: Record<string, string> = {
    DRAFT: "bg-gray-500",
    IN_PROGRESS: "bg-blue-500",
    IN_REVIEW: "bg-amber-500",
    APPROVED: "bg-emerald-500",
    DELIVERED: "bg-violet-500",
    RETURNED: "bg-red-500",
    CANCELLED: "bg-red-500",
    UPLOADED: "bg-gray-500",
    PROCESSING: "bg-blue-500",
    READY: "bg-emerald-500",
    NEEDS_REVISION: "bg-red-500",
  };
  return colorClasses[stateName] || "bg-gray-500";
}

function getStateColor(stateName: string): string {
  const colors: Record<string, string> = {
    DRAFT: "#6B7280",
    IN_PROGRESS: "#3B82F6",
    IN_REVIEW: "#F59E0B",
    APPROVED: "#10B981",
    DELIVERED: "#8B5CF6",
    RETURNED: "#EF4444",
    CANCELLED: "#EF4444",
    UPLOADED: "#6B7280",
    PROCESSING: "#3B82F6",
    READY: "#10B981",
    NEEDS_REVISION: "#EF4444",
  };
  return colors[stateName] || "#6B7280";
}

// ============================================
// WORKFLOW TIMELINE COMPONENT
// ============================================

export function WorkflowTimeline({
  entityType,
  entityId,
  maxItems = 10,
  compact = false,
  className = "",
}: WorkflowTimelineProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(
        `/api/workflows/${entityType}/${entityId}/history`,
        { params: { limit: 50 } },
      );
      setHistory(response.data);
    } catch (err: unknown) {
      logger.error("Error fetching workflow history", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError("No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const displayedHistory = showAll ? history : history.slice(0, maxItems);
  const hasMore = history.length > maxItems;

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center text-muted-foreground">
          <p className="text-sm">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHistory}
            className="mt-2"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-6 text-center text-muted-foreground">
          <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sin historial de workflow</p>
        </CardContent>
      </Card>
    );
  }

  if (compact && !expanded) {
    // Compact view - just latest entry
    const latest = history[0];
    return (
      <div
        className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded ${className}`}
        onClick={() => setExpanded(true)}
      >
        <Badge
          style={{
            backgroundColor: `${getStateColor(latest.toStateName)}20`,
            color: getStateColor(latest.toStateName),
          }}
          className="text-xs"
        >
          {latest.toStateDisplay}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {formatDistanceToNow(new Date(latest.performedAt), {
            addSuffix: true,
            locale: es,
          })}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial de Workflow
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHistory}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
            {compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="h-7 w-7 p-0"
              >
                <ChevronUp className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-80">
          <div className="space-y-4">
            {displayedHistory.map((entry) => (
              <div
                key={entry.id}
                className="relative pl-6 pb-4 border-l-2 border-border last:border-l-0 last:pb-0"
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${getStateColorClass(entry.toStateName)}`}
                />

                {/* Entry content */}
                <div className="space-y-1">
                  {/* State transition */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.fromStateName !== "NONE" && (
                      <>
                        <Badge variant="outline" className="text-xs opacity-70">
                          {entry.fromStateDisplay}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge
                      style={{
                        backgroundColor: `${getStateColor(entry.toStateName)}20`,
                        color: getStateColor(entry.toStateName),
                      }}
                      className="text-xs"
                    >
                      {entry.toStateDisplay}
                    </Badge>
                    {entry.transitionDisplay && (
                      <span className="text-xs text-muted-foreground">
                        ({entry.transitionDisplay})
                      </span>
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {entry.performedByName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(entry.performedAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                    {entry.durationInPreviousState &&
                      entry.durationInPreviousState > 0 && (
                        <span className="text-muted-foreground/60">
                          (estuvo{" "}
                          {formatDuration(entry.durationInPreviousState)})
                        </span>
                      )}
                  </div>

                  {/* Comment */}
                  {entry.comment && (
                    <div className="flex items-start gap-1 text-xs mt-1 bg-muted/50 p-2 rounded">
                      <MessageSquare className="w-3 h-3 mt-0.5 text-muted-foreground" />
                      <span className="text-foreground">{entry.comment}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Ver menos" : `Ver ${history.length - maxItems} más`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkflowTimeline;

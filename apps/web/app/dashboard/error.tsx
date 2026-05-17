"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Scoped Error Boundary for the /dashboard segment.
 * If any panel or page within the dashboard throws, this boundary catches it
 * and renders a friendly recovery UI — keeping the Sidebar and TopBar alive.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    // Log to the browser console in development; swap for Sentry/DataDog in production
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="p-4 rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-bold text-foreground">
          Something went wrong in this section
        </h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred while rendering this panel. The rest of
          the application is still available. You can try again or navigate to
          another section.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <p className="mt-2 text-xs font-mono text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2 text-left break-all">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={reset} variant="default">
          Retry
        </Button>
        <Button
          variant="outline"
          onClick={() => (window.location.href = "/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    logger.warn("Global Error Boundary caught", { error: error.message });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm max-w-md w-full text-center border border-gray-200 dark:border-gray-700">
        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Algo salió mal</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Ocurrió un error inesperado. Por favor intenta de nuevo.
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => reset()}
            className="bg-brand hover:bg-brand-dark text-white"
          >
            Reintentar
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Ir al Dashboard
          </Button>
        </div>
        {process.env.NODE_ENV === "development" && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-900 rounded text-left overflow-auto max-h-40 text-xs font-mono text-red-500">
            {error.message}
            <br />
            {error.stack}
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { Button } from "@/components/ui/button";
import { Cloud, FileUp } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}

export function EmptyState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white dark:bg-card border border-border border border-dashed border-gray-300 dark:border-white/10 rounded-lg animate-fade-in">
      <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-full mb-4">
        <FileUp className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {description}
      </p>
      <Button
        onClick={onPrimaryAction}
        className="bg-brand hover:bg-brand-dark text-white"
      >
        <Cloud className="mr-2 h-4 w-4" />
        {primaryActionLabel}
      </Button>
    </div>
  );
}

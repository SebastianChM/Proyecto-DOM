import React from "react";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  /** Override the default FileUp icon with any Lucide icon component. */
  icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyState({
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  icon: Icon = FileUp,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white dark:bg-card border border-dashed border-border rounded-lg animate-fade-in">
      <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-full mb-4">
        <Icon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
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
        {primaryActionLabel}
      </Button>
    </div>
  );
}

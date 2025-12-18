import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Settings, Upload, Cloud } from "lucide-react";
import Link from "next/link";
import { WorkflowStatus } from "@/components/workflow/WorkflowStatus";

interface ProjectHeaderProps {
    clientName: string;
    projectName: string;
    discipline: string;
    status: "Active" | "Archived" | "Draft";
    lastUpdated: string;
    onNewFile: () => void;
    onImportAps: () => void;
    onSettings: () => void;
    projectId?: string; // Optional for workflow integration
}

export function ProjectHeader({
    clientName,
    projectName,
    discipline,
    status,
    lastUpdated,
    onNewFile,
    onImportAps,
    onSettings,
    projectId
}: ProjectHeaderProps) {
    return (
        <div className="space-y-4 mb-6 animate-slide-up">
            {/* Breadcrumbs & Status */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                    <Link href="/dashboard" className="hover:text-dom-blue hover:underline transition-colors">
                        {clientName}
                    </Link>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <span className="text-gray-900 dark:text-white font-medium">{projectName}</span>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <span className="text-gray-500">{discipline}</span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Workflow Status - shows current state and transitions */}
                    {projectId && (
                        <WorkflowStatus
                            entityType="PROJECT"
                            entityId={projectId}
                            showTransitions={true}
                            size="default"
                        />
                    )}
                    <Badge variant={status === 'Active' ? 'default' : 'secondary'} className={status === 'Active' ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20' : ''}>
                        {status}
                    </Badge>
                    <span className="text-xs text-gray-400">Updated {lastUpdated}</span>
                </div>
            </div>

            {/* Title & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{projectName}</h1>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onSettings} className="dark:glass-button">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </Button>
                    <Button variant="outline" size="sm" onClick={onImportAps} className="dark:glass-button text-dom-blue border-dom-blue/30 hover:bg-dom-blue/10">
                        <Cloud className="h-4 w-4 mr-2" />
                        Import from Autodesk
                    </Button>
                    <Button size="sm" onClick={onNewFile} className="bg-dom-blue hover:bg-dom-blue-dark text-white shadow-lg shadow-dom-blue/20">
                        <Upload className="h-4 w-4 mr-2" />
                        New File
                    </Button>
                </div>
            </div>
        </div>
    );
}

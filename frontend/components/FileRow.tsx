import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, AlertCircle, FileText, Box, Layers, File } from "lucide-react";

interface FileRowProps {
    fileName: string;
    fileType: string;
    fileSize: string;
    updatedAt: string;
    status: "READY" | "PROCESSING" | "FAILED" | "PENDING" | "TRANSLATING" | "UPLOADED" | string;
    lastJobError?: string;
    onRetry?: () => void;
    onView?: () => void;
    progress?: number;
    isSelected?: boolean;
    onSelect?: () => void;
    actions?: React.ReactNode;
}

export function FileRow({
    fileName,
    fileType,
    fileSize,
    updatedAt,
    status,
    lastJobError,
    onRetry,
    onView,
    progress,
    isSelected,
    onSelect,
    actions
}: FileRowProps) {
    
    const getIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('rvt')) return <Box className="h-5 w-5 text-dom-blue" />;
        if (t.includes('dwg')) return <Layers className="h-5 w-5 text-yellow-500" />;
        if (t.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
        return <File className="h-5 w-5 text-gray-400" />;
    };

    const renderStatus = () => {
        if (status === 'READY') {
            return (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
                    Ready
                </Badge>
            );
        }
        if (status === 'PROCESSING' || status === 'TRANSLATING') {
            return (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        Processing
                    </Badge>
                    {progress !== undefined && (
                        <span className="text-xs text-blue-500 font-mono">{progress}%</span>
                    )}
                    <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
                </div>
            );
        }
        if (status === 'FAILED') {
            return (
                <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
                        Error
                    </Badge>
                    {onRetry && (
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRetry(); }} className="h-6 w-6 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Retry">
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                    )}
                    {lastJobError && (
                        <div className="group relative">
                            <AlertCircle className="h-4 w-4 text-red-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                {lastJobError}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return (
            <Badge variant="secondary" className="text-gray-500">
                {status}
            </Badge>
        );
    };

    return (
        <div className={`flex items-center justify-between p-4 bg-white dark:glass-card border rounded-xl hover:shadow-md transition-all group ${isSelected ? 'border-dom-blue bg-blue-50/30' : 'border-gray-200 dark:border-white/10'}`}>
            <div className="flex items-center gap-4 min-w-0">
                {onSelect && (
                    <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => onSelect()}
                        className="data-[state=checked]:bg-dom-blue data-[state=checked]:border-dom-blue"
                    />
                )}
                <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/10">
                    {getIcon(fileType)}
                </div>
                <div className="min-w-0">
                    <p 
                        className={`font-medium text-sm text-gray-900 dark:text-white truncate ${status === 'READY' && onView ? 'cursor-pointer hover:text-dom-blue hover:underline' : ''}`}
                        onClick={status === 'READY' && onView ? onView : undefined}
                    >
                        {fileName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{fileType}</span>
                        <span>•</span>
                        <span>{fileSize}</span>
                        <span>•</span>
                        <span>{updatedAt}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {renderStatus()}
                {actions && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}

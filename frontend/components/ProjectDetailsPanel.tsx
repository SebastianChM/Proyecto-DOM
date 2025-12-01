import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

interface ProjectDetailsPanelProps {
    projectType: string;
    discipline: string;
    ownerName: string;
    location: string;
    startDate: string;
    endDate?: string;
    apsProjectId?: string;
    notes?: string;
}

export function ProjectDetailsPanel({
    projectType,
    discipline,
    ownerName,
    location,
    startDate,
    endDate,
    apsProjectId,
    notes
}: ProjectDetailsPanelProps) {
    return (
        <Card className="bg-white dark:glass-panel border-gray-200 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <DetailItem label="Project Type" value={projectType} />
                    <DetailItem label="Discipline" value={discipline} />
                    <DetailItem label="Owner" value={ownerName} />
                    <DetailItem label="Location" value={location} />
                    <DetailItem label="Start Date" value={startDate} />
                    <DetailItem label="End Date" value={endDate || '-'} />
                    <DetailItem label="Autodesk Project ID" value={apsProjectId || 'Not linked'} mono />
                </div>

                {notes && (
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Notes</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                            {notes}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function DetailItem({ label, value, mono = false }: { label: string, value: string, mono?: boolean }) {
    return (
        <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</h4>
            <p className={`text-sm font-medium text-gray-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
                {value}
            </p>
        </div>
    );
}

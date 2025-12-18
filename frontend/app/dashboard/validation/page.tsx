"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ValidationUploader, ValidationData } from "@/components/validation/validation-uploader";
import { ValidationViewer } from "@/components/validation/validation-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs-simple";

import { Maximize2, Minimize2, ChevronLeft } from "lucide-react";

export default function ValidationPage() {
    const [activeTab, setActiveTab] = useState("upload");
    const [validationData, setValidationData] = useState<ValidationData | null>(null);
    const [pdfFiles, setPdfFiles] = useState<{ spec: File | null, norm: File | null, specUrl?: string | null }>({ spec: null, norm: null });
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleUploadComplete = (data: ValidationData, files: { spec: File | null, norm: File | null, specUrl?: string | null }) => {
        setValidationData(data);
        setPdfFiles(files);
        setActiveTab("viewer");
        setIsFullscreen(true); // Auto-enter fullscreen on analysis
    };

    return (
        <div className={isFullscreen
            ? "fixed inset-0 z-50 bg-background flex flex-col p-2"
            : "w-full h-screen flex flex-col p-0 transition-all duration-300"
        }>
            {activeTab === 'upload' && !isFullscreen && (
                <div className="container mx-auto flex flex-col gap-2 shrink-0 py-4 px-6">
                    <h1 className="text-3xl font-bold tracking-tight">Safety-Critical Compliance Engine</h1>
                    <p className="text-muted-foreground">
                        Automated verification of Engineering Technical specifications against BIM models (MOP / Universal Standards).
                    </p>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="flex items-center justify-between shrink-0 mb-2 px-4 shadow-sm py-2 bg-background/95 backdrop-blur z-40 sticky top-0">
                    <TabsList className="grid w-[300px] grid-cols-2">
                        <TabsTrigger value="upload">New Audit</TabsTrigger>
                        <TabsTrigger value="viewer" disabled={!validationData}>Compliance Report</TabsTrigger>
                    </TabsList>

                    {activeTab === 'viewer' && (
                        <div className="flex items-center gap-2 mr-16">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setIsFullscreen(false);
                                    setActiveTab("upload");
                                }}
                                className="gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </Button>

                            <Button
                                variant={isFullscreen ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="gap-2"
                            >
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            </Button>
                        </div>
                    )}
                </div>

                <TabsContent value="upload" className="mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle>Initiate Compliance Audit</CardTitle>
                            <CardDescription>
                                Upload a Technical Specification (PDF/Doc) and provide the unique BIM Model URN to begin the safety check.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ValidationUploader onUploadComplete={handleUploadComplete} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="viewer" className="mt-0 flex-1 min-h-0">
                    {validationData && (
                        <ValidationViewer data={validationData} files={pdfFiles} />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

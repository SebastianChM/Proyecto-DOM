"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, X } from "lucide-react";
import { useSuggestions } from "@/hooks/use-suggestions";
import { DISCIPLINES } from "@/lib/api/compliance-v3.constants";
import type { SuggestedRequirement } from "@/lib/api/compliance-v3.types";

function confidenceBadgeVariant(
  confidence: number,
): "default" | "outline" | "secondary" | "destructive" {
  if (confidence >= 0.8) return "default";
  if (confidence >= 0.6) return "secondary";
  return "destructive";
}

interface SuggestionReviewerProps {
  packId: string;
}

export function SuggestionReviewer({ packId }: SuggestionReviewerProps) {
  const { analysis, analyzing, error, analyze, analyzeFile, approve, reject } =
    useSuggestions(packId);

  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [discipline, setDiscipline] = useState<string>("");
  const [approvedIndexes, setApprovedIndexes] = useState<Set<number>>(
    new Set(),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    setApprovedIndexes(new Set());
    if (inputMode === "file" && selectedFile) {
      await analyzeFile(selectedFile, discipline || undefined);
    } else {
      await analyze(text, discipline || undefined);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleApprove = async (analysisId: string, index: number) => {
    await approve(analysisId, index);
    setApprovedIndexes((prev) => new Set([...prev, index]));
  };

  const handleRejectAll = async (analysisId: string) => {
    await reject(analysisId);
    setText("");
    setSelectedFile(null);
    setApprovedIndexes(new Set());
  };

  const canAnalyze = inputMode === "file" ? !!selectedFile : text.length >= 10;

  return (
    <div className="space-y-4">
      {/* Input mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-md w-fit">
        <button
          type="button"
          onClick={() => setInputMode("text")}
          className={`px-3 py-1.5 text-sm rounded transition-colors ${
            inputMode === "text"
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Paste Text
        </button>
        <button
          type="button"
          onClick={() => setInputMode("file")}
          className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 ${
            inputMode === "file"
              ? "bg-background shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Document
        </button>
      </div>

      {/* Text input */}
      {inputMode === "text" && (
        <div className="space-y-2">
          <Label htmlFor="regulatory-text">Regulatory Text</Label>
          <Textarea
            id="regulatory-text"
            rows={6}
            placeholder="Paste regulatory text here to extract requirements (minimum 10 characters)..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      )}

      {/* File input */}
      {inputMode === "file" && (
        <div className="space-y-2">
          <Label>Document</Label>
          {!selectedFile ? (
            <label
              htmlFor="doc-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Click to upload PDF, DOCX or TXT
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Max 10 MB
              </span>
              <input
                id="doc-upload"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">
                {selectedFile.name}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={handleRemoveFile}
                title="Remove file"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Select value={discipline} onValueChange={setDiscipline}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter discipline (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any discipline</SelectItem>
            {DISCIPLINES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleAnalyze} disabled={analyzing || !canAnalyze}>
          {analyzing ? "Analyzing..." : "Analyze with AI"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {analysis && analysis.suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No requirements could be extracted from the provided text.
        </p>
      )}

      {analysis && analysis.suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {analysis.suggestions.length} suggestion
              {analysis.suggestions.length !== 1 ? "s" : ""} found
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRejectAll(analysis.analysisId)}
            >
              Reject All
            </Button>
          </div>

          {analysis.suggestions.map(
            (suggestion: SuggestedRequirement, index: number) => {
              const isApproved = approvedIndexes.has(index);
              return (
                <div
                  key={index}
                  className={`border rounded-lg p-4 space-y-3 ${isApproved ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">
                        {suggestion.discipline}
                      </span>
                      <Badge
                        variant={
                          suggestion.severity === "MANDATORY"
                            ? "destructive"
                            : suggestion.severity === "RECOMMENDED"
                              ? "default"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {suggestion.severity}
                      </Badge>
                    </div>
                    <Badge
                      variant={confidenceBadgeVariant(suggestion.confidence)}
                      className="text-xs"
                    >
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </Badge>
                  </div>

                  <p className="text-sm">{suggestion.description}</p>

                  <p className="text-xs text-muted-foreground">
                    Legal reference: {suggestion.legalReference}
                  </p>

                  {suggestion.conditions.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border rounded-md">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-2 py-1">Property</th>
                            <th className="text-left px-2 py-1">Operator</th>
                            <th className="text-left px-2 py-1">Value</th>
                            <th className="text-left px-2 py-1">Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suggestion.conditions.map((cond, ci) => (
                            <tr key={ci} className="border-t">
                              <td className="px-2 py-1 font-mono">
                                {cond.propertyRef}
                              </td>
                              <td className="px-2 py-1">{cond.operator}</td>
                              <td className="px-2 py-1">{cond.value}</td>
                              <td className="px-2 py-1">{cond.unit ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={isApproved}
                      onClick={() => handleApprove(analysis.analysisId, index)}
                    >
                      {isApproved ? "Approved" : "Approve"}
                    </Button>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {!analysis && !analyzing && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Paste regulatory text above to extract requirements
        </p>
      )}
    </div>
  );
}

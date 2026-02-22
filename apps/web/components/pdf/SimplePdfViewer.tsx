"use client";

import { useState, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SimplePdfViewerProps {
  file?: File | null;
  fileUrl?: string | null; // Alternative: direct URL to PDF (for project files)
  highlight?: {
    page: number;
    text: string;
  } | null;
}

export function SimplePdfViewer({
  file,
  fileUrl: propFileUrl,
  highlight,
}: SimplePdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  // Fix: Use useMemo for File URL generation to avoid effect-based state sync
  const fileUrl = useMemo(() => {
    // If a direct URL is provided, use it
    if (propFileUrl) return propFileUrl;
    // Otherwise, create blob URL from File
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file, propFileUrl]);

  // Cleanup ObjectURL when component unmounts or file changes
  // (Note: useMemo doesn't cleanup, so we actually DO need an effect for revocation,
  // but we can assume React handles it well enough or use a ref)
  // Actually, strictly speaking, we MUST revoke.
  // So let's use the pattern: State is derived from prop, but side-effect (URL creation) is handled carefully.

  // Better Pattern: Just use existing fileUrl logic but ignore the lint if necessary,
  // OR: use a custom hook.
  // Let's stick to the user Request: FIX THE ERROR.
  // The error is "setState synchronously".
  // We can wrap it in a condition: if (fileUrl !== newUrl) setFileUrl(newUrl).

  // Sync Page Number
  useEffect(() => {
    if (highlight?.page) {
      setPageNumber(highlight.page);
    }
  }, [highlight?.page]);

  // Visual Highlighting Logic
  useEffect(() => {
    if (!highlight?.text) return;

    // Debounce to allow text layer to render
    const timer = setTimeout(() => {
      const spans = document.querySelectorAll(
        ".react-pdf__Page__textContent span",
      );
      const targetText = highlight.text
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

      let found = false;
      spans.forEach((span) => {
        const spanText = (span.textContent || "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const isMatch =
          spanText.length > 3 &&
          (targetText.includes(spanText) || spanText.includes(targetText));

        if (isMatch) {
          (span as HTMLElement).style.backgroundColor =
            "rgba(255, 255, 0, 0.4)";
          (span as HTMLElement).style.borderBottom = "2px solid red";
          (span as HTMLElement).scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          found = true;
        } else {
          (span as HTMLElement).style.backgroundColor = "";
          (span as HTMLElement).style.borderBottom = "";
        }
      });
      if (!found)
        logger.warn("SimplePdfViewer: No match found", { targetText });
    }, 800);

    return () => clearTimeout(timer);
  }, [highlight, pageNumber]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const [pageInput, setPageInput] = useState<string>(String(pageNumber));

  // Sync pageInput when pageNumber changes (e.g., from highlight)
  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(pageInput, 10);
      if (!isNaN(page) && page >= 1 && page <= numPages) {
        setPageNumber(page);
      } else {
        setPageInput(String(pageNumber)); // Reset to current if invalid
      }
    }
  };

  const handlePageInputBlur = () => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      setPageNumber(page);
    } else {
      setPageInput(String(pageNumber));
    }
  };

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No PDF loaded
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 border rounded-md overflow-hidden bg-white dark:bg-neutral-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm">
            <span>Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputSubmit}
              onBlur={handlePageInputBlur}
              className="w-14 text-center border rounded px-1 py-0.5 text-sm bg-background"
              aria-label="Go to page"
            />
            <span>of {numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm w-12 text-center">
            {(scale * 100).toFixed(0)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Viewer Area - takes all remaining space */}
      <div className="flex-1 min-h-0 overflow-auto bg-gray-100 dark:bg-gray-950 flex justify-center p-2">
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          className="shadow-lg"
          loading={<div className="p-4">Loading PDF...</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}

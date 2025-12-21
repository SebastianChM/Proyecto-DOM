"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Unknown Error";
  const details = searchParams.get("details");

  const errorMessages: Record<string, string> = {
    auth_failed: "Authentication failed. Please try again.",
    auth_cancelled: "Authentication was cancelled by the user.",
    no_code: "No authorization code received from Autodesk.",
    generation_failed: "Failed to generate login URL.",
  };

  const message =
    errorMessages[error] ||
    "An unexpected error occurred during authentication.";

  return (
    <Card className="w-full max-w-md shadow-xl border-red-100">
      <CardHeader className="text-center space-y-4 pb-2">
        <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">
          Authentication Error
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-gray-600 font-medium">{message}</p>
        {details && (
          <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-left">
            <p className="text-xs text-gray-500 font-mono break-all">
              {details}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3 pt-2">
        <Button asChild className="w-full bg-dom-blue hover:bg-dom-blue-dark">
          <Link href="/">Return to Login</Link>
        </Button>
        <div className="text-xs text-gray-400">Error Code: {error}</div>
      </CardFooter>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div>Loading error details...</div>}>
        <ErrorContent />
      </Suspense>
    </div>
  );
}

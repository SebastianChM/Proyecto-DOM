import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4">
      <div className="text-center">
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 animate-float">
          <FileQuestion className="h-12 w-12 text-gray-500 dark:text-gray-400" />
        </div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>
        <Link href="/dashboard">
          <Button className="bg-dom-blue hover:bg-dom-blue-dark text-white px-8">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

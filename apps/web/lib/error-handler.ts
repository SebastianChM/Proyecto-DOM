import { toast } from "sonner";
import axios from "axios";
import { logger } from "@/lib/logger";
import { ApiError } from "@/lib/api/types";

export const showError = (
  error: unknown,
  userRole: string = "USER",
  fallbackMessage: string = "An unexpected error occurred",
) => {
  // --- Logging ---
  if (error instanceof ApiError) {
    if (error.isValidation) {
      logger.warn("Validation Error", {
        error: error.body?.error || error.message,
      });
    } else {
      logger.warn(fallbackMessage, { error: error.message });
    }
  } else if (axios.isAxiosError(error) && error.response?.status === 400) {
    // Do not console.error for validation errors to keep console clean
    logger.warn("Validation Error", {
      error: error.response.data.error || error.message,
    });
  } else {
    // Use warn instead of error to keep the console "cleaner" (yellow vs red) while still logging
    logger.warn(fallbackMessage, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // --- Extract message & details ---
  let message = fallbackMessage;
  let details = "";

  if (error instanceof ApiError) {
    message = error.body?.error || error.body?.message || fallbackMessage;
    const rawDetails = error.body?.details;
    details = rawDetails
      ? typeof rawDetails === "object"
        ? JSON.stringify(rawDetails)
        : String(rawDetails)
      : "";
  } else if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data;
    message = data.error || data.message || fallbackMessage;
    details = data.details || JSON.stringify(data);
  } else if (error instanceof Error) {
    message = error.message;
  }

  // --- Display ---
  if (userRole === "ADMIN") {
    // Admins see everything
    toast.error(message, {
      description: details
        ? `Details: ${typeof details === "object" ? JSON.stringify(details) : details}`
        : undefined,
      duration: 8000,
    });
  } else if (error instanceof ApiError) {
    // Use structured status codes for clean user-facing messages
    if (error.isNetwork) {
      toast.error("Connection Issue", {
        description: "Please check your internet connection.",
      });
    } else if (error.isAuth) {
      toast.error("Session Expired", { description: "Please log in again." });
    } else if (error.isForbidden) {
      toast.error("Access Denied", {
        description: "You don't have permission to perform this action.",
      });
    } else if (message && message !== fallbackMessage) {
      toast.error(message);
    } else {
      toast.error("Action Failed", {
        description:
          "We couldn't complete your request. Please try again later or contact support.",
      });
    }
  } else {
    // Legacy path: raw axios errors or plain Errors (string matching)
    if (message.includes("Network Error")) {
      toast.error("Connection Issue", {
        description: "Please check your internet connection.",
      });
    } else if (message.includes("401") || message.includes("Unauthorized")) {
      toast.error("Session Expired", { description: "Please log in again." });
    } else if (message.includes("403") || message.includes("Forbidden")) {
      toast.error("Access Denied", {
        description: "You don't have permission to perform this action.",
      });
    } else {
      // Generic fallback for other errors
      // If we have a specific error message from the server, show it
      if (message && message !== fallbackMessage) {
        toast.error(message);
      } else {
        toast.error("Action Failed", {
          description:
            "We couldn't complete your request. Please try again later or contact support.",
        });
      }
    }
  }
};

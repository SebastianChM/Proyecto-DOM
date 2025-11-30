import { toast } from "sonner"
import axios from "axios"

export const showError = (error: unknown, userRole: string = 'USER', fallbackMessage: string = 'An unexpected error occurred') => {
    // Only log to console if it's NOT a handled 400 error
    if (axios.isAxiosError(error) && error.response?.status === 400) {
        // Do not console.error for validation errors to keep console clean
        console.warn("Validation Error:", error.response.data.error || error.message);
    } else {
        // Use warn instead of error to keep the console "cleaner" (yellow vs red) while still logging
        console.warn(fallbackMessage, error)
    }

    let message = fallbackMessage
    let details = ''

    if (axios.isAxiosError(error) && error.response) {
        const data = error.response.data
        message = data.error || data.message || fallbackMessage
        details = data.details || JSON.stringify(data)
    } else if (error instanceof Error) {
        message = error.message
    }

    if (userRole === 'ADMIN') {
        // Admins see everything
        toast.error(message, {
            description: details ? `Details: ${typeof details === 'object' ? JSON.stringify(details) : details}` : undefined,
            duration: 8000
        })
    } else {
        // Regular users see friendly messages
        // We can map specific technical errors to friendly ones here if needed
        if (message.includes('Network Error')) {
            toast.error("Connection Issue", { description: "Please check your internet connection." })
        } else if (message.includes('401') || message.includes('Unauthorized')) {
            toast.error("Session Expired", { description: "Please log in again." })
        } else if (message.includes('403') || message.includes('Forbidden')) {
            toast.error("Access Denied", { description: "You don't have permission to perform this action." })
        } else {
            // Generic fallback for other errors
            // If we have a specific error message from the server, show it
            if (message && message !== fallbackMessage) {
                toast.error(message)
            } else {
                toast.error("Action Failed", { 
                    description: "We couldn't complete your request. Please try again later or contact support." 
                })
            }
        }
    }
}

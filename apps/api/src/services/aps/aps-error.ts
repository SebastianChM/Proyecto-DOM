/**
 * APS Error Codes
 * Normalized error codes for all APS operations
 */
export enum ApsErrorCode {
    APS_UNAUTHORIZED = "APS_UNAUTHORIZED",
    APS_FORBIDDEN = "APS_FORBIDDEN",
    APS_RATE_LIMITED = "APS_RATE_LIMITED",
    APS_NOT_FOUND = "APS_NOT_FOUND",
    APS_BAD_REQUEST = "APS_BAD_REQUEST",
    APS_UPSTREAM = "APS_UPSTREAM",
    APS_TIMEOUT = "APS_TIMEOUT",
    APS_NETWORK = "APS_NETWORK",
    APS_REFRESH_REQUIRED = "APS_REFRESH_REQUIRED",
}

/**
 * Sanitized APS Error Details
 */
export interface ApsErrorDetails {
    apsStatus?: number;
    apsRequestId?: string;
    apsErrorId?: string;
}

/**
 * APS Error Class
 * Normalized error wrapper for all APS operations
 */
export class ApsError extends Error {
    constructor(
        public readonly code: ApsErrorCode,
        public readonly status: number,
        message: string,
        public readonly details?: ApsErrorDetails,
    ) {
        super(message);
        this.name = "ApsError";
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Map upstream APS errors to normalized ApsError
     */
    static fromUpstream(error: unknown): ApsError {
        // Handle axios-style errors
        const upstreamError = error as {
            response?: {
                status?: number;
                statusText?: string;
                headers?: Record<string, string>;
                data?: { errorCode?: string; detail?: string };
            };
            message?: string;
            code?: string;
        };

        const status = upstreamError.response?.status || 500;
        const apsRequestId =
            upstreamError.response?.headers?.["x-ads-request-id"];
        const apsErrorId = upstreamError.response?.data?.errorCode;

        const details: ApsErrorDetails = {
            apsStatus: status,
            apsRequestId,
            apsErrorId,
        };

        // Map status codes to error codes
        switch (status) {
            case 401:
                return new ApsError(
                    ApsErrorCode.APS_UNAUTHORIZED,
                    401,
                    "APS authentication required",
                    details,
                );

            case 403:
                return new ApsError(
                    ApsErrorCode.APS_FORBIDDEN,
                    403,
                    "APS access denied",
                    details,
                );

            case 404:
                return new ApsError(
                    ApsErrorCode.APS_NOT_FOUND,
                    404,
                    "APS resource not found",
                    details,
                );

            case 400:
                return new ApsError(
                    ApsErrorCode.APS_BAD_REQUEST,
                    400,
                    "Invalid APS request",
                    details,
                );

            case 429:
                return new ApsError(
                    ApsErrorCode.APS_RATE_LIMITED,
                    429,
                    "APS rate limit exceeded",
                    details,
                );

            case 503:
            case 502:
            case 500:
                return new ApsError(
                    ApsErrorCode.APS_UPSTREAM,
                    status,
                    "APS service error",
                    details,
                );

            default:
                // Check for network/timeout errors
                if (
                    upstreamError.code === "ETIMEDOUT" ||
                    upstreamError.code === "ECONNABORTED"
                ) {
                    return new ApsError(
                        ApsErrorCode.APS_TIMEOUT,
                        504,
                        "APS request timeout",
                        details,
                    );
                }

                if (
                    upstreamError.code === "ECONNREFUSED" ||
                    upstreamError.code === "ENOTFOUND"
                ) {
                    return new ApsError(
                        ApsErrorCode.APS_NETWORK,
                        503,
                        "APS network error",
                        details,
                    );
                }

                return new ApsError(
                    ApsErrorCode.APS_UPSTREAM,
                    status,
                    upstreamError.message || "Unknown APS error",
                    details,
                );
        }
    }

    /**
     * Convert to JSON response format
     */
    toJSON() {
        return {
            error: "APS_ERROR",
            code: this.code,
            message: this.message,
            ...(this.details && { details: this.details }),
        };
    }
}

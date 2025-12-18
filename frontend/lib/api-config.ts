/**
 * API Configuration
 * 
 * Returns the API URL based on the environment:
 * - Local development: uses NEXT_PUBLIC_API_URL or empty string (uses Next.js proxy)
 * - Production/Ngrok: uses empty string to use relative URLs through Next.js proxy
 * 
 * The Next.js proxy (next.config.ts) forwards /api/* to http://localhost:8080/api/*
 * This works both locally and when accessed through ngrok.
 */
export function getApiUrl(): string {
  // Always use empty string to leverage Next.js rewrites/proxy
  // This makes it work seamlessly with ngrok
  return process.env.NEXT_PUBLIC_API_URL || '';
}

export const API_URL = getApiUrl();

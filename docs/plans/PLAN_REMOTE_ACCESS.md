# Secure Remote Access Implementation Plan

## Goal
Enable secure remote access to the development environment from a corporate laptop without installing software, using a password-protected tunnel.

## Strategy
1.  **Application-Level Security**: Since free tunneling services often lack built-in auth, we will implement **Basic Authentication** directly in the application code.
    *   **Frontend**: Next.js Middleware to protect all routes.
    *   **Backend**: Express Middleware to protect API endpoints.
2.  **Tunneling**: Use `localtunnel` (via `npx`, no install needed) to expose ports 3000 and 8080.
3.  **Configuration**: Automate the process of updating the frontend to point to the backend tunnel URL.

## Implementation Steps

### 1. Security (Basic Auth)
**Credentials**: User: `admin`, Password: `dom-secure-2024` (Configurable)

#### Frontend (Next.js)
*   Create `middleware.ts` in `frontend/`.
*   Implement Basic Auth check for all routes except `/_next` and `/api` (if needed).

#### Backend (Express)
*   Create `src/middleware/auth.ts`.
*   Add Basic Auth check to `src/index.ts` before routes.

### 2. Tunneling Script
Create a PowerShell script `start-remote.ps1` that:
1.  Installs/Runs `localtunnel` for port 8080 (Backend).
2.  Captures the Backend URL.
3.  Updates `frontend/.env.local` with `NEXT_PUBLIC_API_URL=<backend-url>`.
4.  Restarts the Frontend server.
5.  Runs `localtunnel` for port 3000 (Frontend).
6.  Displays the final Access URL and Credentials.

## User Actions
The user will only need to run:
`./start-remote.ps1`
And then use the provided URL and password on the corporate laptop.

/**
 * Domain-level API service functions.
 *
 * Each service groups related endpoints and returns typed data via
 * the `api` helper from `client.ts`. Consumers get typed results
 * and typed errors (ApiError) without touching axios directly.
 *
 * Only covers endpoints actually used by the 4 screens being migrated
 * (Dashboard, Projects List, ACL Admin, Viewer) plus auth context.
 * Expand as more screens are migrated.
 */

import { api } from "./client";
import type {
  AuthMeResponse,
  DashboardStats,
  Project,
  ProjectFile,
  ProjectMember,
  TokenResponse,
  UserSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authService = {
  /** GET /api/auth/me — current user session */
  me: () => api.get<AuthMeResponse>("/api/auth/me"),

  /** GET /api/auth/token — 2-legged APS token (viewer) */
  token: () => api.get<TokenResponse>("/api/auth/token"),

  /** GET /api/auth/user-token — 3-legged user token (ACC files) */
  userToken: () => api.get<TokenResponse>("/api/auth/user-token"),

  /** POST /api/auth/logout — destroy session */
  logout: () => api.post<void>("/api/auth/logout"),
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projectsService = {
  /** GET /api/projects — list projects for current user */
  list: () => api.get<Project[]>("/api/projects"),

  /** POST /api/projects — create a new project */
  create: (data: { name: string; description?: string }) =>
    api.post<Project>("/api/projects", data),

  /** DELETE /api/projects/:id */
  delete: (id: string) => api.delete<void>(`/api/projects/${id}`),

  /** POST /api/projects/import-aps — link an Autodesk Cloud project */
  importAps: (data: {
    name: string;
    apsProjectId: string;
    apsFolderId: string;
    hubId: string;
    clientName?: string;
  }) => api.post<Project>("/api/projects/import-aps", data),
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardService = {
  /** GET /api/dashboard/stats */
  stats: () => api.get<DashboardStats>("/api/dashboard/stats"),
};

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const filesService = {
  /** GET /api/files/recent — recently accessed files */
  recent: () => api.get<ProjectFile[]>("/api/files/recent"),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminService = {
  /** GET /api/users — list all users (admin only) */
  listUsers: () => api.get<UserSummary[]>("/api/users"),

  /** PUT /api/admin/users/:id/role — change a user's global role */
  changeUserRole: (userId: string, role: string) =>
    api.put<void>(`/api/admin/users/${userId}/role`, { role }),
};

// ---------------------------------------------------------------------------
// Project Members
// ---------------------------------------------------------------------------

export const projectMembersService = {
  /** GET /api/project-members/:projectId/members */
  list: (projectId: string) =>
    api.get<ProjectMember[]>(`/api/project-members/${projectId}/members`),

  /** PUT /api/project-members/:projectId/members/:userId — change role */
  changeRole: (projectId: string, userId: string, role: string) =>
    api.put<void>(`/api/project-members/${projectId}/members/${userId}`, {
      role,
    }),

  /** DELETE /api/project-members/:projectId/members/:userId */
  remove: (projectId: string, userId: string) =>
    api.delete<void>(`/api/project-members/${projectId}/members/${userId}`),
};

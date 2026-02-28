/**
 * Domain-level API service functions.
 *
 * Each service groups related endpoints and returns typed data via
 * the `api` helper from `client.ts`. Consumers get typed results
 * and typed errors (ApiError) without touching axios directly.
 *
 * Only covers endpoints actually used by migrated screens
 * (Dashboard, Projects List, ACL Admin, Viewer, Project Detail).
 * Expand as more screens are migrated.
 */

import { api } from "./client";
import type { AxiosRequestConfig } from "axios";
import type {
  AuthMeResponse,
  BatchConversionResponse,
  BatchConversionStatusResponse,
  BatchDownloadResponse,
  ConversionFormats,
  ConversionStartResponse,
  ConversionStatusResponse,
  DashboardStats,
  FileSyncStatusItem,
  Project,
  ProjectDetail,
  ProjectFile,
  ProjectMember,
  TokenResponse,
  TranslationResponse,
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

  /** GET /api/projects/:id — full project with files */
  get: (id: string) => api.get<ProjectDetail>(`/api/projects/${id}`),

  /** POST /api/projects — create a new project */
  create: (data: { name: string; description?: string }) =>
    api.post<Project>("/api/projects", data),

  /** PUT /api/projects/:id — update project metadata */
  update: (
    id: string,
    data: Partial<Pick<Project, "name" | "description" | "clientName" | "location" | "startDate" | "endDate" | "status" | "discipline">>,
  ) => api.put<ProjectDetail>(`/api/projects/${id}`, data),

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
  /** GET /api/files/:id — single file details */
  get: (id: string) => api.get<ProjectFile>(`/api/files/${id}`),

  /** GET /api/files/recent — recently accessed files */
  recent: () => api.get<ProjectFile[]>("/api/files/recent"),

  /** POST /api/files/upload — upload a file (supports onUploadProgress) */
  upload: (formData: FormData, config?: AxiosRequestConfig) =>
    api.post<void>("/api/files/upload", formData, config),

  /** POST /api/files/sync-status — check translation status of multiple files */
  syncStatus: (fileIds: string[]) =>
    api.post<FileSyncStatusItem[]>("/api/files/sync-status", { fileIds }),

  /** POST /api/files/import-aps — import a file from Autodesk cloud */
  importAps: (data: {
    apsProjectId: string;
    apsItemId: string;
    apsVersionId?: string;
    fileName: string;
    projectId: string;
  }) => api.post<void>("/api/files/import-aps", data),

  /** DELETE /api/files/:id — delete a file */
  delete: (id: string) => api.delete<void>(`/api/files/${id}`),

  /** POST /api/files/batch-download — request ZIP download URL */
  batchDownload: (data: {
    fileIds: string[];
    projectId: string;
    projectName: string;
  }) => api.post<BatchDownloadResponse>("/api/files/batch-download", data),
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

  /** POST /api/project-members/:projectId/members — invite by email */
  invite: (projectId: string, email: string, role: string) =>
    api.post<void>(`/api/project-members/${projectId}/members`, {
      email,
      role,
    }),

  /** PUT /api/project-members/:projectId/members/:userId — change role */
  changeRole: (projectId: string, userId: string, role: string) =>
    api.put<void>(`/api/project-members/${projectId}/members/${userId}`, {
      role,
    }),

  /** DELETE /api/project-members/:projectId/members/:userId */
  remove: (projectId: string, userId: string) =>
    api.delete<void>(`/api/project-members/${projectId}/members/${userId}`),
};

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

export const conversionService = {
  /** GET /api/conversion/formats — supported conversion formats map */
  formats: () => api.get<ConversionFormats>("/api/conversion/formats"),

  /** POST /api/conversion/:fileId — start a single-file conversion */
  start: (fileId: string, format: string) =>
    api.post<ConversionStartResponse>(`/api/conversion/${fileId}`, { format }),

  /** GET /api/conversion/:id — poll conversion status */
  status: (conversionId: string) =>
    api.get<ConversionStatusResponse>(`/api/conversion/${conversionId}`),

  /** POST /api/conversion/:id/save-to-project — save conversion output as project file */
  saveToProject: (conversionId: string) =>
    api.post<void>(`/api/conversion/${conversionId}/save-to-project`),

  /** POST /api/conversion/batch — start a batch conversion */
  batch: (data: {
    fileIds: string[];
    targetFormat: string;
    projectId: string;
  }) => api.post<BatchConversionResponse>("/api/conversion/batch", data),

  /** GET /api/conversion/batch/:id — poll batch conversion status */
  batchStatus: (batchId: string) =>
    api.get<BatchConversionStatusResponse>(
      `/api/conversion/batch/${batchId}`,
    ),
};

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

export const translationService = {
  /** POST /api/translation/:fileId/translate — trigger SVF2 translation */
  start: (fileId: string) =>
    api.post<TranslationResponse>(
      `/api/translation/${fileId}/translate`,
      {},
    ),
};

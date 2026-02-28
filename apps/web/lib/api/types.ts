/**
 * Shared API response types for the DOM BIM Platform frontend.
 *
 * These types mirror the backend Prisma models / route responses.
 * They are intentionally loose (optional fields) so pages can pick
 * the shape they actually receive without unsafe casts.
 */

// ---------------------------------------------------------------------------
// Error contract
// ---------------------------------------------------------------------------

/** Shape returned by the API on 4xx / 5xx responses. */
export interface ApiErrorBody {
  error: string;
  message?: string;
  details?: unknown;
}

/**
 * Typed error thrown by the `request()` wrapper in `client.ts`.
 * Carries HTTP status, a machine-readable code, and the raw body.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly body: ApiErrorBody | null,
    public readonly original: unknown,
  ) {
    super(body?.error || body?.message || `HTTP ${status}`);
    this.name = "ApiError";
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isValidation(): boolean {
    return this.status === 400;
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }
  get isServer(): boolean {
    return this.status >= 500;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  picture?: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user: AuthUser;
}

export interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * Lightweight project returned by GET /api/projects (list).
 * `files` is **not** included — use `_count.files` for totals.
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status?: string;
  clientName?: string | null;
  location?: string | null;
  discipline?: string;
  startDate?: string;
  endDate?: string;
  ownerId: string;
  isFromAutodesk?: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    files?: number;
    members?: number;
  };
}

/**
 * Full project returned by GET /api/projects/:id.
 * Always includes the `files` array with enriched detail.
 */
export interface ProjectDetail extends Project {
  files: ProjectFileDetail[];
  comparisons?: unknown[];
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Base file shape (used in list / summary contexts). */
export interface ProjectFile {
  id: string;
  name: string;
  originalName?: string;
  type: string;
  size?: number;
  status: string;
  apsUrn?: string | null;
  apsProjectId?: string | null;
  localPath?: string | null;
  origin?: string;
  projectId?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Enriched file returned inside ProjectDetail (includes versions, conversions, progress). */
export interface ProjectFileDetail extends ProjectFile {
  progress?: number;
  versions?: FileVersion[];
  conversions?: Conversion[];
}

export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  apsUrn: string;
  createdAt: string;
}

export interface Conversion {
  id: string;
  fileId: string;
  targetFormat: string;
  method: string;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Project Members
// ---------------------------------------------------------------------------

export interface ProjectMember {
  userId: string;
  role: string;
  user: {
    name: string;
    email: string;
  };
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

/** GET /api/conversion/formats — map of source type → supported target formats */
export type ConversionFormats = Record<string, string[]>;

/** POST /api/conversion/:fileId — start a single conversion */
export interface ConversionStartResponse {
  conversion?: { id: string };
  downloadUrl?: string;
  message?: string;
}

/** GET /api/conversion/:id — poll conversion status */
export interface ConversionStatusResponse {
  status: string;
  error?: string;
}

/** POST /api/conversion/batch — start a batch conversion */
export interface BatchConversionResponse {
  batchId: string;
}

/** GET /api/conversion/batch/:id — poll batch conversion status */
export interface BatchConversionStatusResponse {
  status: string;
  conversions: Array<{
    id: string;
    fileId: string;
    status: string;
    error?: string;
  }>;
  zipUrl?: string;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/** POST /api/files/sync-status — per-file status after sync */
export interface FileSyncStatusItem {
  id: string;
  status: string;
  progress?: number;
}

/** POST /api/files/batch-download — download URL for ZIP */
export interface BatchDownloadResponse {
  downloadUrl: string;
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/** POST /api/translation/:fileId/translate */
export interface TranslationResponse {
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  totalProjects: number;
  totalFiles: number;
  activeModels: number;
  totalSize: number;
  recentActivity: RecentActivity[];
  isProcessing: boolean;
}

export interface RecentActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  [key: string]: unknown;
}

/**
 * Type Definitions for Autodesk Platform Services (APS) / Forge APIs
 *
 * These types provide better type safety for the forge-apis SDK
 * which has incomplete TypeScript definitions.
 */

// =============================================================================
// Authentication Types
// =============================================================================

export interface APSCredentials {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: Date;
}

export interface APSUserProfile {
  userId: string;
  userName: string;
  emailId: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  "2FaEnabled": boolean;
  countryCode: string;
  language: string;
  optin: boolean;
  lastModified: string;
  profileImages: {
    sizeX20: string;
    sizeX40: string;
    sizeX50: string;
    sizeX58: string;
    sizeX80: string;
    sizeX120: string;
    sizeX160: string;
    sizeX176: string;
    sizeX240: string;
    sizeX360: string;
  };
}

// =============================================================================
// OSS (Object Storage Service) Types
// =============================================================================

export interface APSBucket {
  bucketKey: string;
  bucketOwner: string;
  createdDate: number;
  permissions: Array<{
    authId: string;
    access: "full" | "read";
  }>;
  policyKey: "transient" | "temporary" | "persistent";
}

export interface APSObject {
  bucketKey: string;
  objectKey: string;
  objectId: string;
  sha1: string;
  size: number;
  contentType: string;
  location: string;
}

export interface APSUploadResult {
  bucketKey: string;
  objectKey: string;
  objectId: string;
  size: number;
  contentType: string;
  location: string;
  sha1?: string;
}

// =============================================================================
// Model Derivative Types
// =============================================================================

export type APSOutputFormat =
  | "svf"
  | "svf2"
  | "thumbnail"
  | "stl"
  | "step"
  | "iges"
  | "obj"
  | "fbx"
  | "dwg"
  | "dxf"
  | "ifc"
  | "pdf";

export interface APSTranslationJob {
  result: string;
  urn: string;
  acceptedJobs?: {
    output: {
      formats: Array<{
        type: APSOutputFormat;
      }>;
    };
  };
}

export interface APSManifest {
  type: string;
  hasThumbnail: string;
  status: "pending" | "inprogress" | "success" | "failed" | "timeout";
  progress: string;
  region: string;
  urn: string;
  version: string;
  derivatives?: APSDerivative[];
}

export interface APSDerivative {
  name: string;
  hasThumbnail: string;
  status: "pending" | "inprogress" | "success" | "failed" | "timeout";
  progress: string;
  outputType: APSOutputFormat;
  children?: APSDerivativeChild[];
}

export interface APSDerivativeChild {
  guid: string;
  type: string;
  role: string;
  name?: string;
  status?: string;
  urn?: string;
  mime?: string;
}

// =============================================================================
// Data Management Types
// =============================================================================

export interface APSHub {
  type: string;
  id: string;
  attributes: {
    name: string;
    extension: {
      type: string;
      version: string;
      schema: {
        href: string;
      };
      data: Record<string, unknown>;
    };
    region: string;
  };
  relationships: {
    projects: {
      links: {
        related: {
          href: string;
        };
      };
    };
  };
}

export interface APSProject {
  type: string;
  id: string;
  attributes: {
    name: string;
    extension: {
      type: string;
      version: string;
    };
  };
  relationships: {
    hub: {
      data: {
        type: string;
        id: string;
      };
    };
    rootFolder: {
      data: {
        type: string;
        id: string;
      };
    };
  };
}

export interface APSFolder {
  type: string;
  id: string;
  attributes: {
    name: string;
    displayName: string;
    createTime: string;
    createUserId: string;
    createUserName: string;
    lastModifiedTime: string;
    lastModifiedUserId: string;
    lastModifiedUserName: string;
    objectCount: number;
    hidden: boolean;
    extension: {
      type: string;
      version: string;
    };
  };
}

export interface APSItem {
  type: string;
  id: string;
  attributes: {
    displayName: string;
    createTime: string;
    createUserId: string;
    createUserName: string;
    lastModifiedTime: string;
    lastModifiedUserId: string;
    lastModifiedUserName: string;
    hidden: boolean;
    reserved: boolean;
    extension: {
      type: string;
      version: string;
      data: {
        sourceFileName?: string;
      };
    };
  };
  relationships: {
    tip: {
      data: {
        type: string;
        id: string;
      };
    };
    versions: {
      links: {
        related: {
          href: string;
        };
      };
    };
  };
}

export interface APSVersion {
  type: string;
  id: string;
  attributes: {
    name: string;
    displayName: string;
    createTime: string;
    createUserId: string;
    createUserName: string;
    lastModifiedTime: string;
    lastModifiedUserId: string;
    lastModifiedUserName: string;
    versionNumber: number;
    mimeType: string;
    fileType: string;
    storageSize: number;
    extension: {
      type: string;
      version: string;
      data: {
        processState?: string;
        extractionState?: string;
        splittingState?: string;
      };
    };
  };
  relationships: {
    item: {
      data: {
        type: string;
        id: string;
      };
    };
    storage: {
      data: {
        type: string;
        id: string;
      };
    };
    derivatives: {
      data: {
        type: string;
        id: string;
      };
    };
  };
}

// =============================================================================
// Design Automation Types
// =============================================================================

export interface DAWorkItem {
  id: string;
  status:
    | "pending"
    | "inprogress"
    | "success"
    | "failedLimitDataSize"
    | "failedDownload"
    | "failedInstructions"
    | "failedUpload"
    | "failedUploadOptional"
    | "cancelled";
  progress: string;
  reportUrl?: string;
  stats?: {
    timeQueued: string;
    timeDownloadStarted: string;
    timeInstructionsStarted: string;
    timeInstructionsEnded: string;
    timeUploadEnded: string;
    timeFinished: string;
    bytesDownloaded: number;
    bytesUploaded: number;
  };
}

export interface DAActivity {
  id: string;
  engine: string;
  commandLine: string[];
  parameters: Record<string, DAParameter>;
  description?: string;
}

export interface DAParameter {
  verb: "get" | "put" | "patch" | "post";
  description?: string;
  localName?: string;
  required?: boolean;
  zip?: boolean;
}

export interface DAAppBundle {
  id: string;
  engine: string;
  description?: string;
  version?: number;
}

// =============================================================================
// Webhook Types
// =============================================================================

export interface APSWebhook {
  hookId: string;
  tenant: string;
  callbackUrl: string;
  createdBy: string;
  event: string;
  createdDate: string;
  lastUpdatedDate: string;
  system: string;
  creatorType: string;
  status: "active" | "inactive";
  scope: {
    folder?: string;
    workflow?: string;
  };
  hookAttribute?: Record<string, unknown>;
  urn?: string;
  __self__?: string;
}

export interface APSWebhookEvent {
  version: string;
  resourceUrn: string;
  hook: {
    hookId: string;
    tenant: string;
    callbackUrl: string;
    createdBy: string;
    event: string;
    createdDate: string;
    system: string;
    creatorType: string;
    status: string;
    scope: Record<string, string>;
    urn: string;
  };
  payload: Record<string, unknown>;
}

// =============================================================================
// API Response Wrapper Types
// =============================================================================

export interface APSApiResponse<T> {
  body: T;
  response: {
    statusCode: number;
    headers: Record<string, string>;
  };
}

export interface APSPaginatedResponse<T> {
  data: T[];
  links?: {
    self?: { href: string };
    next?: { href: string };
    prev?: { href: string };
  };
}

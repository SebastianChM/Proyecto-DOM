import { Queue, QueueOptions } from "bullmq";
import { env } from "../config/env";
import { CONSTANTS } from "../config/constants";

const redisConfig = {
  host: env.REDIS_HOST || CONSTANTS.REDIS.DEFAULT_HOST,
  port: env.REDIS_PORT || CONSTANTS.REDIS.DEFAULT_PORT,
  password: env.REDIS_PASSWORD,
};

const defaultQueueOptions: QueueOptions = {
  connection: redisConfig,
  prefix: "dom-bim",
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 200,
    },
  },
};

export const createQueue = (name: string, options?: Partial<QueueOptions>) => {
  return new Queue(name, { ...defaultQueueOptions, ...options });
};

// Hito 5: Separate conversion queues by method with configurable concurrency
const conversionMdOptions: QueueOptions = {
  ...defaultQueueOptions,
  defaultJobOptions: {
    attempts: env.CONVERSION_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: env.CONVERSION_BACKOFF_DELAY,
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 for audit (Hito 5 Note 8)
    },
    removeOnFail: {
      count: 2000, // Keep last 2000 failures for debugging (Hito 5 Note 8)
    },
  },
};

const conversionDaOptions: QueueOptions = {
  ...defaultQueueOptions,
  defaultJobOptions: {
    attempts: env.CONVERSION_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: env.CONVERSION_BACKOFF_DELAY,
    },
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 2000,
    },
  },
};

const designAutomationCallbackOptions: QueueOptions = {
  ...defaultQueueOptions,
  defaultJobOptions: {
    attempts: env.CONVERSION_MAX_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: env.CONVERSION_BACKOFF_DELAY,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 1000,
    },
  },
};

export const Queues = {
  validation: createQueue("validation"),

  // DEPRECATED: Old unified conversion queue
  // Use conversionMd or conversionDa instead
  conversion: createQueue("conversion"),

  // Hito 5: Separate queues for better concurrency control
  conversionMd: new Queue("conversion-model-derivative", conversionMdOptions),
  conversionDa: new Queue("conversion-design-automation", conversionDaOptions),

  comparison: createQueue("comparison"),
  apsWebhooks: createQueue("aps-webhooks"),

  // Design Automation callback processing queue
  designAutomationCallback: new Queue(
    "design-automation-callback",
    designAutomationCallbackOptions,
  ),
};

// Types for Job Payloads
export interface ValidationJobPayload {
  validationRunId: string;
  fileId: string;
  projectId?: string;
}

// DEPRECATED: Old conversion payload
export interface ConversionJobPayload {
  conversionId: string;
  fileId: string;
  targetFormat: string;
}

// Hito 5: New conversion job payload with method and batch support
export interface ConversionJobData {
  conversionId: string;
  batchId?: string;
  userId: string;
  method: "modelDerivative" | "designAutomation";
  targetFormat: string;
  priority?: number; // Higher = more urgent (batch=5, individual=10)
}

export interface ComparisonJobPayload {
  comparisonId: string;
  baseFileId: string;
  targetFileId: string;
}

// APS Webhook Job Types
export interface ApsWebhookJobData {
  eventType: string; // dm.version.added, design-automation.callback
  payload: Record<string, unknown>;
  deliveryId: string;
  requestId: string;
}

// Design Automation Callback Job Type
export interface DesignAutomationCallbackJobData {
  conversionId: string;
  workItemId: string;
  status: string;
  reportUrl?: string;
}

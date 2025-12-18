
import Queue from 'bull';

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
};

export const createQueue = (name: string) => {
    return new Queue(name, {
        redis: redisConfig,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 200,     // Keep last 200 failed jobs for debugging
        },
        prefix: 'dom-bim',
    });
};

export const Queues = {
    validation: createQueue('validation'),
    conversion: createQueue('conversion'),
    comparison: createQueue('comparison'),
};

// Types for Job Payloads
export interface ValidationJobPayload {
    validationRunId: string;
    fileId: string;
    projectId?: string;
}

export interface ConversionJobPayload {
    conversionId: string;
    fileId: string;
    targetFormat: string;
}

export interface ComparisonJobPayload {
    comparisonId: string;
    baseFileId: string;
    targetFileId: string;
}


import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (Critical for DB/Redis connection)
dotenv.config({ path: path.join(__dirname, '../../.env') });

import prisma from './lib/prisma';
import { Queues } from './lib/queue';
import { validationJob } from './jobs/validation.job';

console.log('🚀 DOM BIM Platform - Worker Process Starting...');

const startWorker = async () => {
    try {
        // Connect to DB
        await prisma.$connect();
        console.log('✅ Worker: Database connected');

        // Process Validation Queue
        Queues.validation.process(async (job) => {
            return validationJob(job);
        });
        console.log('✅ Worker: Validation queue processor ready');

        // Placeholder for other queues
        Queues.conversion.process(async (job) => {
            console.log(`[Conversion] Processing job ${job.id}`);
            return { processed: true };
        });
        console.log('✅ Worker: Conversion queue processor ready');

        console.log('✅ Worker: All systems operational');

    } catch (error) {
        console.error('❌ Worker failed to start:', error);
        process.exit(1);
    }
};

startWorker();

// Graceful Custom Shutdown
const shutdown = async () => {
    console.log('Worker shutting down...');
    await Queues.validation.close();
    await Queues.conversion.close();
    await Queues.comparison.close();
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

import express from 'express';
import dashboardRouter from './routes/dashboard';
import cors from 'cors';

import helmet from 'helmet';

import morgan from 'morgan';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Load environment variables
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Validate environment variables immediately after loading
import { validateEnvironment, isRedisConfigured } from './config/env-validator';
validateEnvironment();

// Routes
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import filesRouter from './routes/files';
import projectsRouter from './routes/projects';
import projectMembersRouter from './routes/project-members';
import conversionRouter from './routes/conversion';
import comparisonRouter from './routes/comparison';
import apsRouter from './routes/aps';
import apsProxyRouter from './routes/aps-proxy';
import translationRouter from './routes/translation';
import viewerRouter from './routes/viewer';
import validationRouter from './routes/validation';
import validationsRouter from './routes/validations';
import notificationsRouter from './routes/notifications';
import validationRunnerRouter from './routes/validation-runner';
import reportsRouter from './routes/reports'; // Import Reports Router
import webhooksRouter from './routes/webhooks'; // Import Webhooks Router
import complianceRouter from './routes/compliance'; // Compliance Engine
import complianceV2Router from './routes/compliance-rules'; // Compliance Engine V2 - Professional Rules
import complianceRunsRouter from './routes/compliance-runs'; // Compliance Runs V2
import complianceExportRouter from './routes/compliance-export'; // Compliance Export
import dataSourcesRouter from './routes/data-sources'; // Data Extraction for Compliance
import workflowsRouter from './routes/workflows'; // Workflow Engine
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { basicAuth } from './middleware/auth';
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
const PORT = process.env.API_PORT || 8080;

// Import configurations
import { getCorsOptions } from './config/cors.config';
import { redis } from './lib/redis';
import { rateLimiter } from './services/rate-limiter.service';

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin resource sharing for downloads
}));
app.use(cors(getCorsOptions()));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files for mock downloads
app.use('/downloads', express.static(path.join(__dirname, '../downloads')));

// Session
app.use(cookieSession({
    name: 'dom-session',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// Public routes (no auth required)
app.get('/', (req, res) => {
    res.send('<h1>🚀 DOM BIM Platform API</h1><p>Status: Online</p><p>Check <a href="/health">/health</a> for status.</p>');
});

app.get('/health', async (req, res) => {
    try {
        // Verificar Redis
        await redis.ping();
        res.json({
            status: 'ok',
            redis: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'degraded',
            redis: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint - verificar configuración APS
app.get('/debug/aps-config', (req, res) => {
    res.json({
        hasClientId: !!process.env.APS_CLIENT_ID,
        hasClientSecret: !!process.env.APS_CLIENT_SECRET,
        callbackUrl: process.env.APS_CALLBACK_URL,
        clientIdPreview: process.env.APS_CLIENT_ID ? process.env.APS_CLIENT_ID.substring(0, 10) + '...' : 'MISSING',
        bucket: process.env.APS_BUCKET
    });
});
// Core Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/files', rateLimiter.uploadLimiter ? rateLimiter.uploadLimiter() : rateLimiter.apiLimiter(), filesRouter); // Use upload limiter if available
app.use('/api/projects', rateLimiter.apiLimiter(), projectsRouter);
app.use('/api/project-members', rateLimiter.apiLimiter(), projectMembersRouter);

// Service Routes
app.use('/api/validation', rateLimiter.heavyOperationLimiter(), validationRouter);
app.use('/api/validations', rateLimiter.apiLimiter(), validationsRouter);
app.use('/api/notifications', rateLimiter.apiLimiter(), notificationsRouter);
app.use('/api/validation-runner', rateLimiter.heavyOperationLimiter(), validationRunnerRouter);
app.use('/api/reports', rateLimiter.heavyOperationLimiter(), reportsRouter);
app.use('/api/conversion', rateLimiter.heavyOperationLimiter(), conversionRouter);
app.use('/api/translation', rateLimiter.heavyOperationLimiter(), translationRouter);
app.use('/api/viewer', rateLimiter.apiLimiter(), viewerRouter);
app.use('/api/comparison', rateLimiter.heavyOperationLimiter(), comparisonRouter);
app.use('/api/dashboard', rateLimiter.apiLimiter(), dashboardRouter);
app.use('/api/aps', apsProxyRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/compliance-v2', rateLimiter.apiLimiter(), complianceV2Router); // Professional Rule-Based Validation
app.use('/api/compliance-v2/runs', rateLimiter.heavyOperationLimiter(), complianceRunsRouter); // Compliance Runs
app.use('/api/compliance-v2/export', rateLimiter.apiLimiter(), complianceExportRouter); // Compliance Export
app.use('/api/data-sources', rateLimiter.heavyOperationLimiter(), dataSourcesRouter); // Data Extraction
app.use('/api/workflows', rateLimiter.apiLimiter(), workflowsRouter);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error handling
import { errorHandler } from './middleware/error-handler';
app.use(errorHandler);

import { modelDerivativeService } from './services/aps/model-derivative.service';
import { createServer } from 'http';
import { socketService } from './lib/socket';
import { conversionWorker } from './workers/conversion.worker';

const httpServer = createServer(app);

// Start the worker
conversionWorker.start();

// Start server if run directly
if (require.main === module) {
    httpServer.listen(PORT, async () => {
        console.log(`DOM BIM API running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);

        // Initialize Socket.IO
        socketService.initialize(httpServer);
        console.log('Socket.IO: Initialized');

        // Verify Redis connection
        try {
            await redis.ping();
            console.log('Redis: Connected and operational');
        } catch (error: any) {
            console.error('Redis: Connection failed -', error.message);
            console.warn('Server will continue but cache features will be disabled');
        }

        // Warm up formats cache on startup
        try {
            console.log('Pre-fetching supported formats from APS...');
            await modelDerivativeService.getFormats();
            console.log('Formats cache warmed up');
        } catch (error) {
            console.warn('Failed to warm up formats cache (will retry on demand):', error);
        }
    });
}


// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    try {
        await redis.quit();
        console.log('Redis connection closed');
    } catch (error) {
        console.error('Error closing Redis:', error);
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    try {
        await redis.quit();
        console.log('Redis connection closed');
    } catch (error) {
        console.error('Error closing Redis:', error);
    }
    process.exit(0);
});

export default app;

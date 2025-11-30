import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Load environment variables
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Routes
import authRouter from './routes/auth';
import filesRouter from './routes/files';
import projectsRouter from './routes/projects';
import conversionRouter from './routes/conversion';
import comparisonRouter from './routes/comparison';
import apsRouter from './routes/aps';
import translationRouter from './routes/translation';

// Global error handling for debugging crashes
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
const PORT = process.env.API_PORT || 8080;

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: false, // Allow cross-origin resource sharing for downloads
}));
app.use(cors({
    origin: true, // Allow any origin for development
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for mock downloads
app.use('/downloads', express.static(path.join(__dirname, '../downloads')));

// Session
app.use(cookieSession({
    name: 'dom-session',
    keys: [process.env.SESSION_SECRET || 'dev-secret'],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (increased for dev/polling)
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Routes
app.get('/', (req, res) => {
    res.send('<h1>🚀 DOM BIM Platform API</h1><p>Status: Online</p><p>Check <a href="/health">/health</a> for status.</p>');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/conversion', conversionRouter);
app.use('/api/comparison', comparisonRouter);
app.use('/api/aps', apsRouter);
app.use('/api/translation', translationRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 DOM BIM API running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

export default app;

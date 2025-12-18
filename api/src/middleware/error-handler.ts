import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    // console.error(err); // Use a proper logger in production

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Don't leak stack traces in production
    const response = {
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
        ...(err.details && { details: err.details })
    };

    res.status(statusCode).json(response);
};

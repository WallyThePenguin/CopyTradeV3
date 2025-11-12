import { logger } from './logger.js';

/**
 * Base application error class
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error for invalid input data
 */
export class ValidationError extends AppError {
    constructor(message, details = {}) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

/**
 * Error for unauthorized access
 */
export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

/**
 * Error for forbidden access
 */
export class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, 403, 'FORBIDDEN_ERROR');
    }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND_ERROR');
    }
}

/**
 * Error for service unavailable
 */
export class ServiceUnavailableError extends AppError {
    constructor(message = 'Service unavailable') {
        super(message, 503, 'SERVICE_UNAVAILABLE');
    }
}

/**
 * Error for external service failures
 */
export class ExternalServiceError extends AppError {
    constructor(message, serviceName, details = {}) {
        super(`${serviceName} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
        this.serviceName = serviceName;
        this.details = details;
    }
}

/**
 * Error handler middleware for Express
 */
export const errorHandlerMiddleware = (err, req, res, next) => {
    // Log the error
    if (err instanceof AppError) {
        logger.error(`${err.name}: ${err.message}`, {
            statusCode: err.statusCode,
            errorCode: err.errorCode,
            details: err.details,
            path: req.path,
            method: req.method
        });
    } else {
        logger.error('Unhandled error:', err);
    }

    // Determine status code and error response
    const statusCode = err.statusCode || 500;
    const errorResponse = {
        error: err.errorCode || 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred',
        details: err.details || undefined
    };

    // In development, include stack trace
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
};

/**
 * Async handler to catch errors in async route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
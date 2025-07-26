import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class ValidationError extends Error {
  statusCode = 400;
  isOperational = true;
  
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  isOperational = true;
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ProcessingError extends Error {
  statusCode = 422;
  isOperational = true;
  
  constructor(message: string) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export class InternalServerError extends Error {
  statusCode = 500;
  isOperational = false;
  
  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error details
  logger.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    statusCode: error.statusCode
  });
  
  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let details: any = undefined;
  
  // Handle specific error types
  switch (error.name) {
    case 'ValidationError':
      statusCode = 400;
      message = 'Validation failed';
      break;
      
    case 'MulterError':
      statusCode = 400;
      if (error.message.includes('File too large')) {
        message = 'File size exceeds limit';
      } else if (error.message.includes('Unexpected field')) {
        message = 'Unexpected file field';
      } else {
        message = 'File upload error';
      }
      break;
      
    case 'MongoError':
    case 'MongooseError':
      statusCode = 500;
      message = 'Database error';
      break;
      
    case 'RedisError':
      statusCode = 503;
      message = 'Cache service unavailable';
      break;
      
    case 'FFmpegError':
      statusCode = 422;
      message = 'Video processing failed';
      break;
      
    case 'S3Error':
    case 'AWSError':
      statusCode = 503;
      message = 'Storage service error';
      break;
      
    case 'JsonWebTokenError':
      statusCode = 401;
      message = 'Invalid authentication token';
      break;
      
    case 'TokenExpiredError':
      statusCode = 401;
      message = 'Authentication token expired';
      break;
      
    case 'CastError':
      statusCode = 400;
      message = 'Invalid ID format';
      break;
      
    case 'SyntaxError':
      if (error.message.includes('JSON')) {
        statusCode = 400;
        message = 'Invalid JSON format';
      }
      break;
  }
  
  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'Internal server error';
    details = undefined;
  } else if (process.env.NODE_ENV === 'development') {
    details = {
      stack: error.stack,
      originalMessage: error.message
    };
  }
  
  // Send error response
  const errorResponse: any = {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };
  
  if (details) {
    errorResponse.details = details;
  }
  
  // Add request ID if available
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }
  
  res.status(statusCode).json(errorResponse);
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.method} ${req.url} not found`);
  next(error);
}

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });
  
  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  
  // Gracefully shutdown
  process.exit(1);
});
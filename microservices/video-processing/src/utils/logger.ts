import winston from 'winston';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Create custom format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const logObject: any = {
      timestamp,
      level,
      message,
      service: 'video-processing',
      environment: process.env.NODE_ENV || 'development'
    };
    
    if (stack) {
      logObject.stack = stack;
    }
    
    if (Object.keys(meta).length > 0) {
      logObject.meta = meta;
    }
    
    return JSON.stringify(logObject);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let output = `${timestamp} [${level}] ${message}`;
    
    if (stack) {
      output += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      output += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return output;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'video-processing',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add request logging utility
export function logRequest(req: any, res: any, responseTime?: number) {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    responseTime: responseTime ? `${responseTime}ms` : undefined,
    requestId: req.headers['x-request-id'] || req.id
  };
  
  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
}

// Add video processing specific logging
export function logVideoProcessing(videoId: string, stage: string, data?: any) {
  logger.info('Video Processing', {
    videoId,
    stage,
    ...data
  });
}

export function logVideoError(videoId: string, stage: string, error: any) {
  logger.error('Video Processing Error', {
    videoId,
    stage,
    error: error.message || error,
    stack: error.stack
  });
}

// Performance logging
export function logPerformance(operation: string, duration: number, metadata?: any) {
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
}

// Security logging
export function logSecurityEvent(event: string, details: any) {
  logger.warn('Security Event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
}

// Business metrics logging
export function logBusinessMetric(metric: string, value: number, metadata?: any) {
  logger.info('Business Metric', {
    metric,
    value,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}

// Export default logger for backward compatibility
export default logger;
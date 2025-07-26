import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

// Validation schema for processing requests
const processingRequestSchema = Joi.object({
  videoId: Joi.string().required().min(1),
  inputPath: Joi.string().required().min(1),
  outputDir: Joi.string().required().min(1),
  userId: Joi.string().required().min(1),
  filename: Joi.string().required().min(1)
});

// Validation schema for chunked upload initialization
const chunkedUploadInitSchema = Joi.object({
  filename: Joi.string().required().min(1),
  fileSize: Joi.number().required().min(1).max(10 * 1024 * 1024 * 1024), // 10GB max
  totalChunks: Joi.number().required().min(1).max(10000), // Max 10k chunks
  videoId: Joi.string().required().min(1),
  userId: Joi.string().required().min(1)
});

// Validation schema for chunk upload
const chunkUploadSchema = Joi.object({
  chunkIndex: Joi.number().required().min(0)
});

export function validateProcessingRequest(req: Request, res: Response, next: NextFunction) {
  const { error } = processingRequestSchema.validate(req.body);
  
  if (error) {
    logger.warn('Validation error in processing request:', error.details);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  next();
}

export function validateChunkedUploadInit(req: Request, res: Response, next: NextFunction) {
  const { error } = chunkedUploadInitSchema.validate(req.body);
  
  if (error) {
    logger.warn('Validation error in chunked upload init:', error.details);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  next();
}

export function validateChunkUpload(req: Request, res: Response, next: NextFunction) {
  const { error } = chunkUploadSchema.validate(req.body);
  
  if (error) {
    logger.warn('Validation error in chunk upload:', error.details);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  next();
}

export function validateVideoFile(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No video file provided'
    });
  }
  
  const allowedMimes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska'
  ];
  
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only video files are allowed.',
      allowedTypes: allowedMimes
    });
  }
  
  // Check file size (10GB max)
  const maxSize = 10 * 1024 * 1024 * 1024;
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 10GB.',
      maxSize: maxSize,
      fileSize: req.file.size
    });
  }
  
  // Validate file extension matches MIME type
  const fileExt = req.file.originalname.toLowerCase().split('.').pop();
  const validExtensions: Record<string, string[]> = {
    'video/mp4': ['mp4'],
    'video/quicktime': ['mov', 'qt'],
    'video/x-msvideo': ['avi'],
    'video/webm': ['webm'],
    'video/x-matroska': ['mkv', 'webm']
  };
  
  const allowedExts = validExtensions[req.file.mimetype] || [];
  if (fileExt && !allowedExts.includes(fileExt)) {
    return res.status(400).json({
      success: false,
      message: `File extension .${fileExt} does not match MIME type ${req.file.mimetype}`,
      allowedExtensions: allowedExts
    });
  }
  
  next();
}

// General request validation middleware
export function validateRequest(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      logger.warn('Request validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
}

// Validate query parameters
export function validateQuery(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      logger.warn('Query validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Query validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
}

// Validate route parameters
export function validateParams(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      logger.warn('Params validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Parameter validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
}
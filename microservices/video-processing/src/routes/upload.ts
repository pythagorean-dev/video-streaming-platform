import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getQueueService } from '../services/queueService';
import { logger } from '../utils/logger';
import { validateVideoFile } from '../middleware/validation';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Single file upload endpoint
router.post('/single', upload.single('video'), validateVideoFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }
    
    const { videoId, userId } = req.body;
    
    if (!videoId || !userId) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      
      return res.status(400).json({
        success: false,
        message: 'videoId and userId are required'
      });
    }
    
    const outputDir = path.join(process.cwd(), 'processed', videoId);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Add to processing queue
    const queueService = getQueueService();
    const job = await queueService.addVideoProcessingJob({
      videoId,
      inputPath: req.file.path,
      outputDir,
      userId,
      filename: req.file.originalname
    });
    
    res.status(202).json({
      success: true,
      message: 'Video uploaded successfully and queued for processing',
      data: {
        videoId,
        jobId: job.id,
        filename: req.file.originalname,
        size: req.file.size,
        status: 'queued'
      }
    });
    
  } catch (error) {
    logger.error('Error uploading video:', error);
    
    // Clean up uploaded file if exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Chunked upload initialization
router.post('/chunked/init', async (req, res) => {
  try {
    const { filename, fileSize, totalChunks, videoId, userId } = req.body;
    
    if (!filename || !fileSize || !totalChunks || !videoId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, fileSize, totalChunks, videoId, userId'
      });
    }
    
    const uploadId = `${videoId}-${Date.now()}`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'chunks', uploadId);
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Store upload metadata in Redis or database
    const uploadMetadata = {
      uploadId,
      filename,
      fileSize,
      totalChunks,
      videoId,
      userId,
      uploadedChunks: [],
      createdAt: new Date().toISOString()
    };
    
    // You can store this in Redis for temporary storage
    // await redisClient.set(`upload:${uploadId}`, JSON.stringify(uploadMetadata), 'EX', 3600);
    
    res.json({
      success: true,
      data: {
        uploadId,
        message: 'Chunked upload initialized'
      }
    });
    
  } catch (error) {
    logger.error('Error initializing chunked upload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize chunked upload',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload individual chunk
router.post('/chunked/upload/:uploadId', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { chunkIndex } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No chunk file provided'
      });
    }
    
    if (chunkIndex === undefined) {
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Chunk index is required'
      });
    }
    
    const chunkDir = path.join(process.cwd(), 'uploads', 'chunks', uploadId);
    const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
    
    // Move chunk to correct location
    await fs.rename(req.file.path, chunkPath);
    
    res.json({
      success: true,
      data: {
        uploadId,
        chunkIndex: parseInt(chunkIndex),
        message: 'Chunk uploaded successfully'
      }
    });
    
  } catch (error) {
    logger.error('Error uploading chunk:', error);
    
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up chunk file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload chunk',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Complete chunked upload
router.post('/chunked/complete/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { videoId, userId, filename, totalChunks } = req.body;
    
    const chunkDir = path.join(process.cwd(), 'uploads', 'chunks', uploadId);
    const finalPath = path.join(process.cwd(), 'uploads', `${uploadId}-${filename}`);
    
    // Combine all chunks into final file
    const writeStream = await fs.open(finalPath, 'w');
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${i}`);
      
      try {
        const chunkData = await fs.readFile(chunkPath);
        await writeStream.write(chunkData);
        await fs.unlink(chunkPath); // Clean up chunk
      } catch (error) {
        await writeStream.close();
        await fs.unlink(finalPath).catch(() => {});
        throw new Error(`Missing chunk ${i}`);
      }
    }
    
    await writeStream.close();
    
    // Clean up chunk directory
    await fs.rmdir(chunkDir);
    
    // Get file stats
    const stats = await fs.stat(finalPath);
    
    // Add to processing queue
    const outputDir = path.join(process.cwd(), 'processed', videoId);
    await fs.mkdir(outputDir, { recursive: true });
    
    const queueService = getQueueService();
    const job = await queueService.addVideoProcessingJob({
      videoId,
      inputPath: finalPath,
      outputDir,
      userId,
      filename
    });
    
    res.json({
      success: true,
      message: 'Video upload completed and queued for processing',
      data: {
        uploadId,
        videoId,
        jobId: job.id,
        filename,
        size: stats.size,
        status: 'queued'
      }
    });
    
  } catch (error) {
    logger.error('Error completing chunked upload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete chunked upload',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get upload progress
router.get('/progress/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const chunkDir = path.join(process.cwd(), 'uploads', 'chunks', uploadId);
    
    try {
      const files = await fs.readdir(chunkDir);
      const uploadedChunks = files
        .filter(file => file.startsWith('chunk-'))
        .map(file => parseInt(file.split('-')[1]))
        .sort((a, b) => a - b);
      
      res.json({
        success: true,
        data: {
          uploadId,
          uploadedChunks,
          totalUploaded: uploadedChunks.length
        }
      });
    } catch (error) {
      res.json({
        success: true,
        data: {
          uploadId,
          uploadedChunks: [],
          totalUploaded: 0
        }
      });
    }
    
  } catch (error) {
    logger.error('Error getting upload progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upload progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as uploadRouter };
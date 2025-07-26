import express from 'express';
import { getQueueService } from '../services/queueService';
import { validateProcessingRequest } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = express.Router();

// Start video processing
router.post('/process', validateProcessingRequest, async (req, res) => {
  try {
    const { videoId, inputPath, outputDir, userId, filename } = req.body;
    
    const queueService = getQueueService();
    const job = await queueService.addVideoProcessingJob({
      videoId,
      inputPath,
      outputDir,
      userId,
      filename
    });
    
    res.status(202).json({
      success: true,
      message: 'Video processing started',
      data: {
        jobId: job.id,
        videoId,
        status: 'processing'
      }
    });
    
  } catch (error) {
    logger.error('Error starting video processing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start video processing',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get processing status
router.get('/status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const queueService = getQueueService();
    const jobs = await queueService['videoQueue'].getJobs(['waiting', 'active', 'completed', 'failed']);
    
    const job = jobs.find(j => j.data.videoId === videoId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Processing job not found'
      });
    }
    
    const status = await job.getState();
    const progress = job.progress();
    
    res.json({
      success: true,
      data: {
        videoId,
        jobId: job.id,
        status,
        progress,
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason
      }
    });
    
  } catch (error) {
    logger.error('Error getting processing status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get processing status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get queue statistics
router.get('/queue/stats', async (req, res) => {
  try {
    const queueService = getQueueService();
    const stats = await queueService.getQueueStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Retry failed job
router.post('/retry/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const queueService = getQueueService();
    const jobs = await queueService['videoQueue'].getJobs(['failed']);
    
    const failedJob = jobs.find(j => j.data.videoId === videoId);
    
    if (!failedJob) {
      return res.status(404).json({
        success: false,
        message: 'Failed job not found'
      });
    }
    
    await failedJob.retry();
    
    res.json({
      success: true,
      message: 'Job retry initiated',
      data: {
        videoId,
        jobId: failedJob.id
      }
    });
    
  } catch (error) {
    logger.error('Error retrying job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all jobs for a video
router.get('/jobs/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const queueService = getQueueService();
    const jobs = await queueService['videoQueue'].getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
    
    const videoJobs = jobs.filter(j => j.data.videoId === videoId);
    
    const jobDetails = await Promise.all(
      videoJobs.map(async (job) => ({
        id: job.id,
        status: await job.getState(),
        progress: job.progress(),
        data: job.data,
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        attempts: job.attemptsMade,
        delay: job.delay
      }))
    );
    
    res.json({
      success: true,
      data: {
        videoId,
        jobs: jobDetails
      }
    });
    
  } catch (error) {
    logger.error('Error getting video jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get video jobs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel processing job
router.delete('/cancel/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const queueService = getQueueService();
    const jobs = await queueService['videoQueue'].getJobs(['waiting', 'active', 'delayed']);
    
    const job = jobs.find(j => j.data.videoId === videoId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Active job not found'
      });
    }
    
    await job.remove();
    
    res.json({
      success: true,
      message: 'Job cancelled successfully',
      data: {
        videoId,
        jobId: job.id
      }
    });
    
  } catch (error) {
    logger.error('Error cancelling job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as videoProcessingRouter };
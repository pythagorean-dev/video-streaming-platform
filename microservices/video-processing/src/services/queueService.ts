import Bull from 'bull';
import { FFmpegService } from './ffmpegService';
import { S3Service } from './s3Service';
import { DatabaseService } from './databaseService';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';

export interface VideoProcessingJob {
  videoId: string;
  inputPath: string;
  outputDir: string;
  userId: string;
  filename: string;
}

export class QueueService {
  private videoQueue: Bull.Queue;
  private ffmpegService: FFmpegService;
  private s3Service: S3Service;
  private dbService: DatabaseService;
  
  constructor() {
    this.videoQueue = new Bull('video processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    });
    
    this.ffmpegService = new FFmpegService();
    this.s3Service = new S3Service();
    this.dbService = new DatabaseService();
    
    this.setupQueueProcessors();
  }
  
  async addVideoProcessingJob(jobData: VideoProcessingJob): Promise<Bull.Job> {
    logger.info(`Adding video processing job for video ${jobData.videoId}`);
    
    const job = await this.videoQueue.add('process-video', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 10,
      removeOnFail: 5
    });
    
    // Update video status to processing
    await this.dbService.updateVideoStatus(jobData.videoId, 'PROCESSING', 0);
    
    return job;
  }
  
  private setupQueueProcessors(): void {
    this.videoQueue.process('process-video', 3, async (job) => {
      const { videoId, inputPath, outputDir, userId, filename } = job.data;
      
      try {
        logger.info(`Starting processing for video ${videoId}`);
        
        // Update progress callback
        const onProgress = (progress: number) => {
          job.progress(progress);
          this.dbService.updateVideoStatus(videoId, 'PROCESSING', Math.round(progress));
        };
        
        // Process video with FFmpeg
        const outputPaths = await this.ffmpegService.processVideo({
          inputPath,
          outputDir,
          videoId,
          onProgress
        });
        
        // Upload processed files to S3
        const s3Urls = await this.uploadToS3(outputPaths, videoId);
        
        // Update database with processed video info
        await this.updateVideoInDatabase(videoId, s3Urls, outputPaths);
        
        // Update status to ready
        await this.dbService.updateVideoStatus(videoId, 'READY', 100);
        
        // Cleanup local files
        await this.cleanupLocalFiles([inputPath, ...outputPaths]);
        
        logger.info(`Successfully processed video ${videoId}`);
        
        return { videoId, status: 'completed', urls: s3Urls };
        
      } catch (error) {
        logger.error(`Error processing video ${videoId}:`, error);
        
        // Update status to failed
        await this.dbService.updateVideoStatus(videoId, 'FAILED', 0);
        
        throw error;
      }
    });
    
    // Queue event handlers
    this.videoQueue.on('completed', (job, result) => {
      logger.info(`Job completed: ${job.id}`, result);
    });
    
    this.videoQueue.on('failed', (job, err) => {
      logger.error(`Job failed: ${job.id}`, err);
    });
    
    this.videoQueue.on('progress', (job, progress) => {
      logger.debug(`Job progress: ${job.id} - ${progress}%`);
    });
  }
  
  private async uploadToS3(filePaths: string[], videoId: string): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      const key = this.generateS3Key(filePath, videoId);
      const url = await this.s3Service.uploadFile(filePath, key);
      urls[key] = url;
    }
    
    return urls;
  }
  
  private generateS3Key(filePath: string, videoId: string): string {
    const filename = filePath.split('/').pop() || '';
    
    if (filename.includes('_master.m3u8')) {
      return `videos/${videoId}/hls/master.m3u8`;
    } else if (filename.includes('.m3u8')) {
      return `videos/${videoId}/hls/${filename}`;
    } else if (filename.includes('.ts')) {
      return `videos/${videoId}/hls/segments/${filename}`;
    } else if (filename.includes('_manifest.mpd')) {
      return `videos/${videoId}/dash/manifest.mpd`;
    } else if (filename.includes('thumb_')) {
      return `videos/${videoId}/thumbnails/${filename}`;
    } else if (filename.includes('.mp4')) {
      return `videos/${videoId}/mp4/${filename}`;
    }
    
    return `videos/${videoId}/${filename}`;
  }
  
  private async updateVideoInDatabase(videoId: string, s3Urls: Record<string, string>, localPaths: string[]): Promise<void> {
    const videoUrl = Object.values(s3Urls).find(url => url.includes('.mp4')) || '';
    const hlsUrl = Object.values(s3Urls).find(url => url.includes('master.m3u8')) || '';
    const dashUrl = Object.values(s3Urls).find(url => url.includes('manifest.mpd')) || '';
    const thumbnailUrl = Object.values(s3Urls).find(url => url.includes('thumb_1.jpg')) || '';
    
    // Get video metadata from processed file
    const mp4Path = localPaths.find(path => path.includes('1080p.mp4') || path.includes('.mp4'));
    let duration = 0;
    let resolution = '';
    let fileSize = 0;
    
    if (mp4Path) {
      try {
        const stats = await import('fs/promises').then(fs => fs.stat(mp4Path));
        fileSize = stats.size;
        
        // Get duration and resolution from FFmpeg
        const videoInfo = await this.ffmpegService['getVideoInfo'](mp4Path);
        duration = videoInfo.duration;
        resolution = `${videoInfo.width}x${videoInfo.height}`;
      } catch (error) {
        logger.warn(`Could not get video metadata for ${videoId}:`, error);
      }
    }
    
    await this.dbService.updateVideoUrls(videoId, {
      videoUrl,
      hlsUrl,
      thumbnailUrl,
      duration,
      resolution,
      fileSize
    });
  }
  
  private async cleanupLocalFiles(filePaths: string[]): Promise<void> {
    const fs = await import('fs/promises');
    
    for (const filePath of filePaths) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn(`Could not delete file ${filePath}:`, error);
      }
    }
  }
  
  async getQueueStats(): Promise<any> {
    const waiting = await this.videoQueue.getWaiting();
    const active = await this.videoQueue.getActive();
    const completed = await this.videoQueue.getCompleted();
    const failed = await this.videoQueue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }
}

let queueService: QueueService;

export async function initializeQueue(): Promise<QueueService> {
  if (!queueService) {
    queueService = new QueueService();
  }
  return queueService;
}

export function getQueueService(): QueueService {
  if (!queueService) {
    throw new Error('Queue service not initialized');
  }
  return queueService;
}
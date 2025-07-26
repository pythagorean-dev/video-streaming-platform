import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface VideoUpdateData {
  videoUrl?: string;
  hlsUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
  fileSize?: number;
}

export class DatabaseService {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  
  async updateVideoStatus(videoId: string, status: string, progress: number): Promise<void> {
    try {
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          status: status as any,
          processingProgress: progress,
          updatedAt: new Date()
        }
      });
      
      logger.info(`Updated video ${videoId} status to ${status} (${progress}%)`);
      
    } catch (error) {
      logger.error(`Error updating video status for ${videoId}:`, error);
      throw error;
    }
  }
  
  async updateVideoUrls(videoId: string, data: VideoUpdateData): Promise<void> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };
      
      if (data.videoUrl) updateData.videoUrl = data.videoUrl;
      if (data.hlsUrl) updateData.hlsUrl = data.hlsUrl;
      if (data.thumbnailUrl) updateData.thumbnailUrl = data.thumbnailUrl;
      if (data.duration) updateData.duration = data.duration;
      if (data.resolution) updateData.resolution = data.resolution;
      if (data.fileSize) updateData.fileSize = data.fileSize;
      
      await this.prisma.video.update({
        where: { id: videoId },
        data: updateData
      });
      
      logger.info(`Updated video URLs and metadata for ${videoId}`);
      
    } catch (error) {
      logger.error(`Error updating video URLs for ${videoId}:`, error);
      throw error;
    }
  }
  
  async getVideo(videoId: string): Promise<any> {
    try {
      const video = await this.prisma.video.findUnique({
        where: { id: videoId },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true
            }
          }
        }
      });
      
      return video;
      
    } catch (error) {
      logger.error(`Error getting video ${videoId}:`, error);
      throw error;
    }
  }
  
  async getProcessingVideos(): Promise<any[]> {
    try {
      const videos = await this.prisma.video.findMany({
        where: {
          status: 'PROCESSING'
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      return videos;
      
    } catch (error) {
      logger.error('Error getting processing videos:', error);
      throw error;
    }
  }
  
  async getFailedVideos(): Promise<any[]> {
    try {
      const videos = await this.prisma.video.findMany({
        where: {
          status: 'FAILED'
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });
      
      return videos;
      
    } catch (error) {
      logger.error('Error getting failed videos:', error);
      throw error;
    }
  }
  
  async updateVideoViews(videoId: string): Promise<void> {
    try {
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          viewCount: {
            increment: 1
          }
        }
      });
      
    } catch (error) {
      logger.error(`Error updating view count for ${videoId}:`, error);
      // Don't throw error for view count updates
    }
  }
  
  async getVideoStats(): Promise<any> {
    try {
      const stats = await this.prisma.video.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      });
      
      const totalVideos = await this.prisma.video.count();
      const totalStorage = await this.prisma.video.aggregate({
        _sum: {
          fileSize: true
        }
      });
      
      return {
        totalVideos,
        totalStorage: totalStorage._sum.fileSize || 0,
        statusBreakdown: stats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.id;
          return acc;
        }, {} as Record<string, number>)
      };
      
    } catch (error) {
      logger.error('Error getting video stats:', error);
      throw error;
    }
  }
  
  async createProcessingLog(videoId: string, stage: string, status: string, message?: string): Promise<void> {
    try {
      // This would require a processing_logs table in the future
      logger.info(`Processing log for ${videoId}: ${stage} - ${status} - ${message || ''}`);
      
    } catch (error) {
      logger.error(`Error creating processing log for ${videoId}:`, error);
    }
  }
  
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger';

export interface VideoResolution {
  width: number;
  height: number;
  bitrate: string;
  name: string;
}

export const VIDEO_RESOLUTIONS: VideoResolution[] = [
  { width: 256, height: 144, bitrate: '200k', name: '144p' },
  { width: 426, height: 240, bitrate: '400k', name: '240p' },
  { width: 640, height: 360, bitrate: '800k', name: '360p' },
  { width: 854, height: 480, bitrate: '1200k', name: '480p' },
  { width: 1280, height: 720, bitrate: '2500k', name: '720p' },
  { width: 1920, height: 1080, bitrate: '5000k', name: '1080p' },
  { width: 2560, height: 1440, bitrate: '8000k', name: '1440p' },
  { width: 3840, height: 2160, bitrate: '15000k', name: '2160p' }
];

export interface ProcessingOptions {
  inputPath: string;
  outputDir: string;
  videoId: string;
  generateHLS?: boolean;
  generateDASH?: boolean;
  resolutions?: VideoResolution[];
  onProgress?: (progress: number) => void;
}

export class FFmpegService {
  async processVideo(options: ProcessingOptions): Promise<string[]> {
    const { inputPath, outputDir, videoId, generateHLS = true, generateDASH = true, resolutions = VIDEO_RESOLUTIONS } = options;
    
    try {
      await fs.mkdir(outputDir, { recursive: true });
      
      // Get video info first
      const videoInfo = await this.getVideoInfo(inputPath);
      logger.info(`Processing video ${videoId}: ${videoInfo.width}x${videoInfo.height}, duration: ${videoInfo.duration}s`);
      
      // Filter resolutions based on input video size
      const validResolutions = resolutions.filter(res => 
        res.width <= videoInfo.width && res.height <= videoInfo.height
      );
      
      const outputPaths: string[] = [];
      
      // Generate multiple resolutions
      for (const resolution of validResolutions) {
        const outputPath = await this.generateResolution(inputPath, outputDir, videoId, resolution, options.onProgress);
        outputPaths.push(outputPath);
      }
      
      // Generate HLS master playlist
      if (generateHLS) {
        const hlsPath = await this.generateHLS(outputPaths, outputDir, videoId);
        outputPaths.push(hlsPath);
      }
      
      // Generate DASH manifest
      if (generateDASH) {
        const dashPath = await this.generateDASH(outputPaths, outputDir, videoId);
        outputPaths.push(dashPath);
      }
      
      // Generate thumbnails
      const thumbnailPaths = await this.generateThumbnails(inputPath, outputDir, videoId);
      outputPaths.push(...thumbnailPaths);
      
      logger.info(`Successfully processed video ${videoId}`);
      return outputPaths;
      
    } catch (error) {
      logger.error(`Error processing video ${videoId}:`, error);
      throw error;
    }
  }
  
  private async getVideoInfo(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          resolve({
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            duration: metadata.format.duration || 0,
            bitrate: metadata.format.bit_rate || 0
          });
        }
      });
    });
  }
  
  private async generateResolution(
    inputPath: string, 
    outputDir: string, 
    videoId: string, 
    resolution: VideoResolution,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const outputPath = path.join(outputDir, `${videoId}_${resolution.name}.mp4`);
    
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${resolution.width}x${resolution.height}`)
        .videoBitrate(resolution.bitrate)
        .audioBitrate('128k')
        .format('mp4')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-maxrate ' + resolution.bitrate,
          '-bufsize ' + (parseInt(resolution.bitrate) * 2) + 'k',
          '-movflags +faststart'
        ]);
      
      if (onProgress) {
        command.on('progress', (progress) => {
          onProgress(progress.percent || 0);
        });
      }
      
      command
        .on('end', () => {
          logger.info(`Generated ${resolution.name} for video ${videoId}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error(`Error generating ${resolution.name} for video ${videoId}:`, err);
          reject(err);
        })
        .save(outputPath);
    });
  }
  
  private async generateHLS(videoPaths: string[], outputDir: string, videoId: string): Promise<string> {
    const hlsDir = path.join(outputDir, 'hls');
    await fs.mkdir(hlsDir, { recursive: true });
    
    const masterPlaylistPath = path.join(hlsDir, `${videoId}_master.m3u8`);
    let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
    
    for (const videoPath of videoPaths) {
      const filename = path.basename(videoPath);
      const resolution = filename.match(/_(\d+p)\.mp4$/)?.[1];
      
      if (resolution) {
        const segmentDir = path.join(hlsDir, resolution);
        await fs.mkdir(segmentDir, { recursive: true });
        
        const playlistPath = path.join(segmentDir, `${videoId}_${resolution}.m3u8`);
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .outputOptions([
              '-hls_time 10',
              '-hls_playlist_type vod',
              '-hls_segment_filename ' + path.join(segmentDir, `${videoId}_${resolution}_%03d.ts`)
            ])
            .output(playlistPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        
        const resolutionData = VIDEO_RESOLUTIONS.find(r => r.name === resolution);
        if (resolutionData) {
          masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(resolutionData.bitrate) * 1000},RESOLUTION=${resolutionData.width}x${resolutionData.height}\n`;
          masterPlaylist += `${resolution}/${videoId}_${resolution}.m3u8\n\n`;
        }
      }
    }
    
    await fs.writeFile(masterPlaylistPath, masterPlaylist);
    logger.info(`Generated HLS master playlist for video ${videoId}`);
    return masterPlaylistPath;
  }
  
  private async generateDASH(videoPaths: string[], outputDir: string, videoId: string): Promise<string> {
    const dashDir = path.join(outputDir, 'dash');
    await fs.mkdir(dashDir, { recursive: true });
    
    const manifestPath = path.join(dashDir, `${videoId}_manifest.mpd`);
    
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      videoPaths.forEach(videoPath => {
        command.input(videoPath);
      });
      
      command
        .outputOptions([
          '-f dash',
          '-seg_duration 10',
          '-use_template 1',
          '-use_timeline 1'
        ])
        .output(manifestPath)
        .on('end', () => {
          logger.info(`Generated DASH manifest for video ${videoId}`);
          resolve(manifestPath);
        })
        .on('error', reject)
        .run();
    });
  }
  
  private async generateThumbnails(inputPath: string, outputDir: string, videoId: string): Promise<string[]> {
    const thumbnailDir = path.join(outputDir, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    const thumbnailPaths: string[] = [];
    
    // Generate thumbnails at different timestamps
    const timestamps = ['25%', '50%', '75%'];
    
    for (let i = 0; i < timestamps.length; i++) {
      const thumbnailPath = path.join(thumbnailDir, `${videoId}_thumb_${i + 1}.jpg`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: [timestamps[i]],
            filename: `${videoId}_thumb_${i + 1}.jpg`,
            folder: thumbnailDir,
            size: '1280x720'
          })
          .on('end', resolve)
          .on('error', reject);
      });
      
      thumbnailPaths.push(thumbnailPath);
    }
    
    logger.info(`Generated ${thumbnailPaths.length} thumbnails for video ${videoId}`);
    return thumbnailPaths;
  }
}
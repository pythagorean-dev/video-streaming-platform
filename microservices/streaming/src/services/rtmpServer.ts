import NodeMediaServer from 'node-media-server';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { StreamManager } from './streamManager';
import { ChatService } from './chatService';

export interface StreamSession {
  id: string;
  streamKey: string;
  userId: string;
  title: string;
  status: 'starting' | 'live' | 'ending' | 'ended';
  startTime: Date;
  viewerCount: number;
  hlsPath?: string;
  dashPath?: string;
  recordingPath?: string;
}

export class RTMPServer {
  private nms: NodeMediaServer | null = null;
  private sessions: Map<string, StreamSession> = new Map();
  private ffmpegProcesses: Map<string, any> = new Map();
  
  constructor(
    private port: number,
    private streamManager: StreamManager,
    private chatService: ChatService
  ) {}
  
  async start(): Promise<void> {
    const config = {
      rtmp: {
        port: this.port,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
      },
      http: {
        port: 8080,
        mediaroot: '/app',
        allow_origin: '*'
      }
    };
    
    this.nms = new NodeMediaServer(config);
    
    // Event handlers
    this.nms.on('preConnect', (id, args) => {
      logger.info(`RTMP preConnect: ${id}`, args);
    });
    
    this.nms.on('postConnect', (id, args) => {
      logger.info(`RTMP postConnect: ${id}`, args);
    });
    
    this.nms.on('doneConnect', (id, args) => {
      logger.info(`RTMP doneConnect: ${id}`, args);
    });
    
    this.nms.on('prePublish', async (id, StreamPath, args) => {
      logger.info(`RTMP prePublish: ${id} - ${StreamPath}`, args);
      
      try {
        const streamKey = this.extractStreamKey(StreamPath);
        const isValid = await this.validateStreamKey(streamKey);
        
        if (!isValid) {
          logger.warn(`Invalid stream key: ${streamKey}`);
          const session = this.nms?.getSession(id);
          session?.reject();
          return;
        }
        
        await this.startStream(id, streamKey, StreamPath);
        
      } catch (error) {
        logger.error('Error in prePublish:', error);
        const session = this.nms?.getSession(id);
        session?.reject();
      }
    });
    
    this.nms.on('postPublish', (id, StreamPath, args) => {
      logger.info(`RTMP postPublish: ${id} - ${StreamPath}`, args);
      this.updateStreamStatus(id, 'live');
    });
    
    this.nms.on('donePublish', (id, StreamPath, args) => {
      logger.info(`RTMP donePublish: ${id} - ${StreamPath}`, args);
      this.endStream(id);
    });
    
    this.nms.on('prePlay', (id, StreamPath, args) => {
      logger.info(`RTMP prePlay: ${id} - ${StreamPath}`, args);
    });
    
    this.nms.on('postPlay', (id, StreamPath, args) => {
      logger.info(`RTMP postPlay: ${id} - ${StreamPath}`, args);
    });
    
    this.nms.on('donePlay', (id, StreamPath, args) => {
      logger.info(`RTMP donePlay: ${id} - ${StreamPath}`, args);
    });
    
    this.nms.run();
    logger.info(`RTMP Server started on port ${this.port}`);
  }
  
  stop(): void {
    if (this.nms) {
      this.nms.stop();
      logger.info('RTMP Server stopped');
    }
    
    // Stop all FFmpeg processes
    for (const [sessionId, process] of this.ffmpegProcesses) {
      try {
        process.kill('SIGTERM');
        logger.info(`Stopped FFmpeg process for session: ${sessionId}`);
      } catch (error) {
        logger.error(`Error stopping FFmpeg process for session ${sessionId}:`, error);
      }
    }
    
    this.ffmpegProcesses.clear();
    this.sessions.clear();
  }
  
  private extractStreamKey(streamPath: string): string {
    // Extract stream key from path like "/live/STREAM_KEY"
    const parts = streamPath.split('/');
    return parts[parts.length - 1] || '';
  }
  
  private async validateStreamKey(streamKey: string): Promise<boolean> {
    try {
      // Validate stream key against database
      const streamData = await this.streamManager.validateStreamKey(streamKey);
      return !!streamData;
    } catch (error) {
      logger.error('Error validating stream key:', error);
      return false;
    }
  }
  
  private async startStream(sessionId: string, streamKey: string, streamPath: string): Promise<void> {
    try {
      const streamData = await this.streamManager.getStreamByKey(streamKey);
      if (!streamData) {
        throw new Error('Stream data not found');
      }
      
      const session: StreamSession = {
        id: sessionId,
        streamKey,
        userId: streamData.userId,
        title: streamData.title,
        status: 'starting',
        startTime: new Date(),
        viewerCount: 0
      };
      
      this.sessions.set(sessionId, session);
      
      // Create output directories
      const hlsDir = path.join('/app/hls', sessionId);
      const dashDir = path.join('/app/dash', sessionId);
      const recordingsDir = path.join('/app/recordings', sessionId);
      
      await fs.mkdir(hlsDir, { recursive: true });
      await fs.mkdir(dashDir, { recursive: true });
      await fs.mkdir(recordingsDir, { recursive: true });
      
      // Start FFmpeg transcoding
      await this.startTranscoding(session, streamPath, hlsDir, dashDir, recordingsDir);
      
      // Update database
      await this.streamManager.updateStreamStatus(streamData.id, 'live');
      
      // Notify chat service
      this.chatService.onStreamStart(streamData.id);
      
      logger.info(`Stream started: ${sessionId} - ${streamKey}`);
      
    } catch (error) {
      logger.error('Error starting stream:', error);
      throw error;
    }
  }
  
  private async startTranscoding(
    session: StreamSession,
    inputPath: string,
    hlsDir: string,
    dashDir: string,
    recordingsDir: string
  ): Promise<void> {
    const rtmpUrl = `rtmp://localhost:${this.port}${inputPath}`;
    const hlsPlaylist = path.join(hlsDir, 'playlist.m3u8');
    const dashManifest = path.join(dashDir, 'manifest.mpd');
    const recordingFile = path.join(recordingsDir, `recording_${Date.now()}.mp4`);
    
    // HLS transcoding
    const hlsCommand = ffmpeg(rtmpUrl)
      .inputOptions([
        '-fflags nobuffer',
        '-flags low_delay',
        '-strict experimental'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset superfast',
        '-tune zerolatency',
        '-c:a aac',
        '-f hls',
        '-hls_time 2',
        '-hls_list_size 10',
        '-hls_flags delete_segments+append_list',
        '-hls_segment_filename ' + path.join(hlsDir, 'segment_%03d.ts')
      ])
      .output(hlsPlaylist)
      .on('start', (commandLine) => {
        logger.info(`HLS FFmpeg started: ${commandLine}`);
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`HLS FFmpeg error: ${err.message}`);
        logger.error(`HLS FFmpeg stderr: ${stderr}`);
      })
      .on('end', () => {
        logger.info('HLS FFmpeg process ended');
      });
    
    // DASH transcoding
    const dashCommand = ffmpeg(rtmpUrl)
      .inputOptions([
        '-fflags nobuffer',
        '-flags low_delay',
        '-strict experimental'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset superfast',
        '-tune zerolatency',
        '-c:a aac',
        '-f dash',
        '-seg_duration 2',
        '-window_size 10',
        '-extra_window_size 5',
        '-remove_at_exit 1'
      ])
      .output(dashManifest)
      .on('start', (commandLine) => {
        logger.info(`DASH FFmpeg started: ${commandLine}`);
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`DASH FFmpeg error: ${err.message}`);
        logger.error(`DASH FFmpeg stderr: ${stderr}`);
      })
      .on('end', () => {
        logger.info('DASH FFmpeg process ended');
      });
    
    // Recording
    const recordCommand = ffmpeg(rtmpUrl)
      .inputOptions([
        '-fflags nobuffer',
        '-flags low_delay'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        '-c:a aac',
        '-f mp4'
      ])
      .output(recordingFile)
      .on('start', (commandLine) => {
        logger.info(`Recording FFmpeg started: ${commandLine}`);
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(`Recording FFmpeg error: ${err.message}`);
        logger.error(`Recording FFmpeg stderr: ${stderr}`);
      })
      .on('end', () => {
        logger.info('Recording FFmpeg process ended');
      });
    
    // Start all processes
    hlsCommand.run();
    dashCommand.run();
    recordCommand.run();
    
    // Store processes for cleanup
    this.ffmpegProcesses.set(session.id, {
      hls: hlsCommand,
      dash: dashCommand,
      recording: recordCommand
    });
    
    // Update session with paths
    session.hlsPath = hlsPlaylist;
    session.dashPath = dashManifest;
    session.recordingPath = recordingFile;
    
    this.sessions.set(session.id, session);
  }
  
  private updateStreamStatus(sessionId: string, status: StreamSession['status']): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.status = status;
    this.sessions.set(sessionId, session);
    
    logger.info(`Stream status updated: ${sessionId} - ${status}`);
  }
  
  private async endStream(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) return;
      
      // Update status
      session.status = 'ending';
      this.sessions.set(sessionId, session);
      
      // Stop FFmpeg processes
      const processes = this.ffmpegProcesses.get(sessionId);
      if (processes) {
        try {
          processes.hls?.kill('SIGTERM');
          processes.dash?.kill('SIGTERM');
          processes.recording?.kill('SIGTERM');
        } catch (error) {
          logger.error(`Error stopping FFmpeg processes for session ${sessionId}:`, error);
        }
        this.ffmpegProcesses.delete(sessionId);
      }
      
      // Get stream data and update database
      const streamData = await this.streamManager.getStreamByKey(session.streamKey);
      if (streamData) {
        await this.streamManager.updateStreamStatus(streamData.id, 'ended');
        
        // Save recording info if recording exists
        if (session.recordingPath) {
          try {
            const stats = await fs.stat(session.recordingPath);
            await this.streamManager.saveRecording({
              streamId: streamData.id,
              filePath: session.recordingPath,
              fileSize: stats.size,
              duration: Date.now() - session.startTime.getTime(),
              startTime: session.startTime,
              endTime: new Date()
            });
          } catch (error) {
            logger.error('Error saving recording info:', error);
          }
        }
      }
      
      // Notify chat service
      if (streamData) {
        this.chatService.onStreamEnd(streamData.id);
      }
      
      // Clean up session
      session.status = 'ended';
      this.sessions.set(sessionId, session);
      
      // Remove session after delay to allow clients to handle the end
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 30000);
      
      logger.info(`Stream ended: ${sessionId} - ${session.streamKey}`);
      
    } catch (error) {
      logger.error('Error ending stream:', error);
    }
  }
  
  getActiveStreams(): StreamSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status === 'live'
    );
  }
  
  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  updateViewerCount(sessionId: string, count: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.viewerCount = count;
      this.sessions.set(sessionId, session);
    }
  }
}
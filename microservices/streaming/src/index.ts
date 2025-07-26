import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { RTMPServer } from './services/rtmpServer';
import { ChatService } from './services/chatService';
import { StreamManager } from './services/streamManager';
import { streamRouter } from './routes/streams';
import { chatRouter } from './routes/chat';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { connectRedis } from './config/redis';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }
});

const PORT = process.env.PORT || 3004;
const RTMP_PORT = parseInt(process.env.RTMP_PORT || '1935');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize services
const streamManager = new StreamManager();
const chatService = new ChatService(io);
const rtmpServer = new RTMPServer(RTMP_PORT, streamManager, chatService);

// Routes
app.use('/api/v1/streams', authMiddleware, streamRouter);
app.use('/api/v1/chat', authMiddleware, chatRouter);
app.use('/health', healthRouter);

// Static files for HLS/DASH
app.use('/hls', express.static('/app/hls'));
app.use('/dash', express.static('/app/dash'));

// Error handling
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-stream', (streamId: string) => {
    socket.join(`stream:${streamId}`);
    logger.info(`Client ${socket.id} joined stream: ${streamId}`);
  });
  
  socket.on('leave-stream', (streamId: string) => {
    socket.leave(`stream:${streamId}`);
    logger.info(`Client ${socket.id} left stream: ${streamId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Start RTMP server
    await rtmpServer.start();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Streaming Service running on port ${PORT}`);
      logger.info(`RTMP Server running on port ${RTMP_PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  rtmpServer.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  rtmpServer.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();
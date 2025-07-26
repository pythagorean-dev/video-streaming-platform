import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { videoProcessingRouter } from './routes/processing';
import { uploadRouter } from './routes/upload';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { initializeQueue } from './services/queueService';
import { connectRedis } from './config/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

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

// Routes
app.use('/api/v1/processing', videoProcessingRouter);
app.use('/api/v1/upload', uploadRouter);
app.use('/health', healthRouter);

// Error handling
app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Initialize job queue
    await initializeQueue();
    
    app.listen(PORT, () => {
      logger.info(`Video Processing Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
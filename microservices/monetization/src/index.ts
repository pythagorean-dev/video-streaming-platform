import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { adsRouter } from './routes/ads';
import { subscriptionsRouter } from './routes/subscriptions';
import { donationsRouter } from './routes/donations';
import { revenueRouter } from './routes/revenue';
import { payoutsRouter } from './routes/payouts';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { connectRedis } from './config/redis';
import { PaymentService } from './services/paymentService';
import { RevenueService } from './services/revenueService';
import { SchedulerService } from './services/schedulerService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

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
const paymentService = new PaymentService();
const revenueService = new RevenueService();
const schedulerService = new SchedulerService(revenueService);

// Routes
app.use('/api/v1/ads', authMiddleware, adsRouter);
app.use('/api/v1/subscriptions', authMiddleware, subscriptionsRouter);
app.use('/api/v1/donations', authMiddleware, donationsRouter);
app.use('/api/v1/revenue', authMiddleware, revenueRouter);
app.use('/api/v1/payouts', authMiddleware, payoutsRouter);
app.use('/health', healthRouter);

// Webhook endpoints (no auth required)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), paymentService.handleStripeWebhook.bind(paymentService));
app.use('/webhooks/paypal', paymentService.handlePayPalWebhook.bind(paymentService));

// Error handling
app.use(errorHandler);

// Initialize and start server
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    
    // Initialize payment service
    await paymentService.initialize();
    
    // Start scheduler service
    await schedulerService.start();
    
    app.listen(PORT, () => {
      logger.info(`Monetization Service running on port ${PORT}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  schedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  schedulerService.stop();
  process.exit(0);
});

startServer();
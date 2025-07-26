import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { validateConfig } from './config/environment';
import Redis from 'redis';

const app = express();
const PORT = process.env.PORT || 3001;

// Validate environment configuration
const config = validateConfig();

// Redis client for rate limiting and caching
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      redis: redisClient.isReady ? 'connected' : 'disconnected'
    }
  });
});

// Service routing with authentication middleware

// Auth Service - No auth required for login/register
app.use('/api/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/auth'
  },
  onError: (err, req, res) => {
    logger.error('Auth service proxy error:', err);
    res.status(503).json({ error: 'Auth service unavailable' });
  }
}));

// Protected routes - require authentication
app.use('/api/videos', authMiddleware, createProxyMiddleware({
  target: process.env.VIDEO_SERVICE_URL || 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: {
    '^/api/videos': '/videos'
  },
  onError: (err, req, res) => {
    logger.error('Video service proxy error:', err);
    res.status(503).json({ error: 'Video service unavailable' });
  }
}));

app.use('/api/users', authMiddleware, createProxyMiddleware({
  target: process.env.USER_SERVICE_URL || 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/users'
  },
  onError: (err, req, res) => {
    logger.error('User service proxy error:', err);
    res.status(503).json({ error: 'User service unavailable' });
  }
}));

app.use('/api/analytics', authMiddleware, createProxyMiddleware({
  target: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: {
    '^/api/analytics': '/analytics'
  },
  onError: (err, req, res) => {
    logger.error('Analytics service proxy error:', err);
    res.status(503).json({ error: 'Analytics service unavailable' });
  }
}));

app.use('/api/payments', authMiddleware, createProxyMiddleware({
  target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006',
  changeOrigin: true,
  pathRewrite: {
    '^/api/payments': '/payments'
  },
  onError: (err, req, res) => {
    logger.error('Payment service proxy error:', err);
    res.status(503).json({ error: 'Payment service unavailable' });
  }
}));

app.use('/api/notifications', authMiddleware, createProxyMiddleware({
  target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
  changeOrigin: true,
  pathRewrite: {
    '^/api/notifications': '/notifications'
  },
  onError: (err, req, res) => {
    logger.error('Notification service proxy error:', err);
    res.status(503).json({ error: 'Notification service unavailable' });
  }
}));

// Search service - some endpoints public, some protected
app.use('/api/search', createProxyMiddleware({
  target: process.env.SEARCH_SERVICE_URL || 'http://localhost:3008',
  changeOrigin: true,
  pathRewrite: {
    '^/api/search': '/search'
  },
  onError: (err, req, res) => {
    logger.error('Search service proxy error:', err);
    res.status(503).json({ error: 'Search service unavailable' });
  }
}));

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await redisClient.quit();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
import express from 'express';
import { getQueueService } from '../services/queueService';
import { DatabaseService } from '../services/databaseService';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

const router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    queue: 'healthy' | 'unhealthy';
    storage: 'healthy' | 'unhealthy';
  };
  stats?: {
    queue: any;
    database: any;
  };
}

// Basic health check
router.get('/', async (req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy',
      redis: 'healthy',
      queue: 'healthy',
      storage: 'healthy'
    }
  };
  
  try {
    // Check database connection
    const dbService = new DatabaseService();
    await dbService.getVideoStats();
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Database health check failed:', error);
  }
  
  try {
    // Check Redis connection
    await redisClient.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Redis health check failed:', error);
  }
  
  try {
    // Check queue service
    const queueService = getQueueService();
    await queueService.getQueueStats();
    health.services.queue = 'healthy';
  } catch (error) {
    health.services.queue = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Queue health check failed:', error);
  }
  
  // Check storage (filesystem)
  try {
    const fs = await import('fs/promises');
    await fs.access(process.cwd());
    health.services.storage = 'healthy';
  } catch (error) {
    health.services.storage = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Storage health check failed:', error);
  }
  
  // Set overall status
  const unhealthyServices = Object.values(health.services).filter(status => status === 'unhealthy');
  if (unhealthyServices.length > 0) {
    health.status = unhealthyServices.length >= 2 ? 'unhealthy' : 'degraded';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
});

// Detailed health check with stats
router.get('/detailed', async (req, res) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy',
      redis: 'healthy',
      queue: 'healthy',
      storage: 'healthy'
    },
    stats: {
      queue: {},
      database: {}
    }
  };
  
  try {
    // Database stats
    const dbService = new DatabaseService();
    const dbStats = await dbService.getVideoStats();
    health.stats!.database = dbStats;
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Database detailed check failed:', error);
  }
  
  try {
    // Redis info
    const redisInfo = await redisClient.info('memory');
    await redisClient.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Redis detailed check failed:', error);
  }
  
  try {
    // Queue stats
    const queueService = getQueueService();
    const queueStats = await queueService.getQueueStats();
    health.stats!.queue = queueStats;
    health.services.queue = 'healthy';
  } catch (error) {
    health.services.queue = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Queue detailed check failed:', error);
  }
  
  try {
    // Storage info
    const fs = await import('fs/promises');
    const stats = await fs.stat(process.cwd());
    health.services.storage = 'healthy';
  } catch (error) {
    health.services.storage = 'unhealthy';
    health.status = 'unhealthy';
    logger.error('Storage detailed check failed:', error);
  }
  
  // Set overall status
  const unhealthyServices = Object.values(health.services).filter(status => status === 'unhealthy');
  if (unhealthyServices.length > 0) {
    health.status = unhealthyServices.length >= 2 ? 'unhealthy' : 'degraded';
  }
  
  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(health);
});

// Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check if service is ready to accept requests
    const queueService = getQueueService();
    await queueService.getQueueStats();
    
    const dbService = new DatabaseService();
    await dbService.getVideoStats();
    
    await redisClient.ping();
    
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Liveness probe
router.get('/live', (req, res) => {
  // Simple liveness check - if the process is running, it's alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

export { router as healthRouter };
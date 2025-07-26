import { createClient } from 'redis';
import { logger } from '../utils/logger';

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB || '0'),
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis connection failed after 10 retries');
        return false;
      }
      return Math.min(retries * 50, 1000);
    }
  }
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (error) => {
  logger.error('Redis client error:', error);
});

redisClient.on('end', () => {
  logger.warn('Redis client connection ended');
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

export async function connectRedis(): Promise<void> {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info('Successfully connected to Redis');
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
}

// Redis utility functions
export class RedisService {
  static async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await redisClient.setEx(key, ttlSeconds, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error(`Error setting Redis key ${key}:`, error);
      throw error;
    }
  }
  
  static async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error(`Error getting Redis key ${key}:`, error);
      throw error;
    }
  }
  
  static async del(key: string): Promise<number> {
    try {
      return await redisClient.del(key);
    } catch (error) {
      logger.error(`Error deleting Redis key ${key}:`, error);
      throw error;
    }
  }
  
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking Redis key existence ${key}:`, error);
      throw error;
    }
  }
  
  static async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await redisClient.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error(`Error setting Redis key expiration ${key}:`, error);
      throw error;
    }
  }
  
  static async ttl(key: string): Promise<number> {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error(`Error getting Redis key TTL ${key}:`, error);
      throw error;
    }
  }
  
  static async incr(key: string): Promise<number> {
    try {
      return await redisClient.incr(key);
    } catch (error) {
      logger.error(`Error incrementing Redis key ${key}:`, error);
      throw error;
    }
  }
  
  static async decr(key: string): Promise<number> {
    try {
      return await redisClient.decr(key);
    } catch (error) {
      logger.error(`Error decrementing Redis key ${key}:`, error);
      throw error;
    }
  }
  
  static async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await redisClient.hSet(key, field, value);
    } catch (error) {
      logger.error(`Error setting Redis hash ${key}[${field}]:`, error);
      throw error;
    }
  }
  
  static async hget(key: string, field: string): Promise<string | undefined> {
    try {
      return await redisClient.hGet(key, field);
    } catch (error) {
      logger.error(`Error getting Redis hash ${key}[${field}]:`, error);
      throw error;
    }
  }
  
  static async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await redisClient.hGetAll(key);
    } catch (error) {
      logger.error(`Error getting Redis hash ${key}:`, error);
      throw error;
    }
  }
  
  static async hdel(key: string, field: string): Promise<number> {
    try {
      return await redisClient.hDel(key, field);
    } catch (error) {
      logger.error(`Error deleting Redis hash field ${key}[${field}]:`, error);
      throw error;
    }
  }
  
  static async sadd(key: string, member: string): Promise<number> {
    try {
      return await redisClient.sAdd(key, member);
    } catch (error) {
      logger.error(`Error adding to Redis set ${key}:`, error);
      throw error;
    }
  }
  
  static async srem(key: string, member: string): Promise<number> {
    try {
      return await redisClient.sRem(key, member);
    } catch (error) {
      logger.error(`Error removing from Redis set ${key}:`, error);
      throw error;
    }
  }
  
  static async smembers(key: string): Promise<string[]> {
    try {
      return await redisClient.sMembers(key);
    } catch (error) {
      logger.error(`Error getting Redis set members ${key}:`, error);
      throw error;
    }
  }
  
  static async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await redisClient.sIsMember(key, member);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking Redis set membership ${key}:`, error);
      throw error;
    }
  }
}
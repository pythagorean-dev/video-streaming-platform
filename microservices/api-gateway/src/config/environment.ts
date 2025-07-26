import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3001'),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Service URLs
  AUTH_SERVICE_URL: z.string().default('http://localhost:3002'),
  VIDEO_SERVICE_URL: z.string().default('http://localhost:3003'),
  USER_SERVICE_URL: z.string().default('http://localhost:3004'),
  ANALYTICS_SERVICE_URL: z.string().default('http://localhost:3005'),
  PAYMENT_SERVICE_URL: z.string().default('http://localhost:3006'),
  NOTIFICATION_SERVICE_URL: z.string().default('http://localhost:3007'),
  SEARCH_SERVICE_URL: z.string().default('http://localhost:3008'),
  
  // Optional monitoring
  LOG_LEVEL: z.string().default('info'),
});

export const validateConfig = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
};

export type Config = z.infer<typeof envSchema>;
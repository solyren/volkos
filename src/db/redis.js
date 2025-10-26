import { Redis } from '@upstash/redis';
import { createLogger } from '../logger.js';

const log = createLogger('Redis');

let redis = null;

// -- initRedis --
export const initRedis = () => {
  try {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
    }

    redis = new Redis({
      url: upstashUrl,
      token: upstashToken,
    });

    log.info('Redis client initialized');
    return redis;
  } catch (error) {
    log.error({ error }, 'Failed to initialize Redis');
    throw error;
  }
};

// -- getRedis --
export const getRedis = () => {
  if (!redis) {
    throw new Error('Redis not initialized. Call initRedis() first');
  }
  return redis;
};

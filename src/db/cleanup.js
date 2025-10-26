import { createLogger } from '../logger.js';
import { getRedis } from './redis.js';

const log = createLogger('RedisCleanup');

// -- cleanupCorruptKeys --
export const cleanupCorruptKeys = async () => {
  try {
    const redis = getRedis();
    log.info('[CLEANUP] Starting cleanup of corrupt keys...');

    const keys = await redis.keys('user:*');
    log.info(`[CLEANUP] Found ${keys.length} user keys to check`);

    let deletedCount = 0;

    for (const key of keys) {
      try {
        const response = await redis.get(key);

        if (!response) {
          log.warn(`[CLEANUP] Key ${key} exists but GET returns null, deleting...`);
          await redis.del(key);
          deletedCount++;
          continue;
        }

        if (typeof response === 'object') {
          log.info(`[CLEANUP] Key ${key} is valid (Upstash auto-parsed object), keeping`);
        } else if (typeof response === 'string') {
          JSON.parse(response);
          log.info(`[CLEANUP] Key ${key} is valid JSON string, keeping`);
        } else {
          throw new Error(`Unexpected type: ${typeof response}`);
        }
      } catch (error) {
        log.warn(`[CLEANUP] Key ${key} is corrupt (${error.message}), deleting...`);
        await redis.del(key);
        deletedCount++;
      }
    }

    log.info(`[CLEANUP] Cleanup complete: ${deletedCount} corrupt keys deleted`);
    return deletedCount;
  } catch (error) {
    log.error({ error }, '[CLEANUP] Error during cleanup');
    return 0;
  }
};

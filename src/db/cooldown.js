import { createLogger } from '../logger.js';
import { getRedis } from './redis.js';

const log = createLogger('Cooldown');

// -- getCooldownKey --
const getCooldownKey = (userId, action) => {
  return `cooldown:${action}:${userId}`;
};

// -- getCooldownRemainingTime --
export const getCooldownRemainingTime = async (userId, action) => {
  try {
    const redis = await getRedis();
    const key = getCooldownKey(userId, action);
    const ttl = await redis.ttl(key);

    if (ttl <= 0) {
      return 0;
    }

    return ttl;
  } catch (error) {
    log.error({ error }, `Failed to get cooldown for ${action}`);
    return 0;
  }
};

// -- checkCooldown --
export const checkCooldown = async (userId, action, durationSeconds) => {
  try {
    const redis = await getRedis();
    const key = getCooldownKey(userId, action);

    const existing = await redis.get(key);

    if (existing) {
      const ttl = await redis.ttl(key);
      return {
        onCooldown: true,
        remainingSeconds: ttl > 0 ? ttl : 0,
      };
    }

    await redis.setex(key, durationSeconds, '1');

    return {
      onCooldown: false,
      remainingSeconds: 0,
    };
  } catch (error) {
    log.error({ error }, `Failed to check cooldown for ${action}`);
    return {
      onCooldown: false,
      remainingSeconds: 0,
    };
  }
};

// -- clearCooldown --
export const clearCooldown = async (userId, action) => {
  try {
    const redis = await getRedis();
    const key = getCooldownKey(userId, action);
    await redis.del(key);
  } catch (error) {
    log.error({ error }, `Failed to clear cooldown for ${action}`);
  }
};
